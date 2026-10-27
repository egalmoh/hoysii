import { sql } from 'drizzle-orm';
import { createAuth } from './auth.js';
import { db } from './db.js';

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) },
});

const rows = (result) => result?.rows || result || [];
const one = (result) => rows(result)[0] || null;

function cors(request, env) {
  const origin = request.headers.get('origin');
  const trusted = (env.TRUSTED_ORIGINS || '').split(',').map((value) => value.trim());
  const allowOrigin = origin && trusted.includes(origin) ? origin : null;

  return {
    ...(allowOrigin ? { 'access-control-allow-origin': allowOrigin } : {}),
    'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, cookie',
    'access-control-allow-credentials': 'true',
    'vary': 'Origin',
  };
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors(request, env))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

function id() {
  return crypto.randomUUID();
}

function parseJson(value) {
  if (typeof value !== 'string') return value || [];
  try { return JSON.parse(value); } catch { return []; }
}

function hotel(row) {
  if (!row) return null;
  return {
    ...row,
    starting_price: Number(row.starting_price),
    rating: row.rating === null ? null : Number(row.rating),
    address: parseJson(row.address),
    images: parseJson(row.images),
    amenities: parseJson(row.amenities),
    payment_methods: parseJson(row.payment_methods),
    security_features: parseJson(row.security_features),
  };
}

function room(row) {
  if (!row) return null;
  return { ...row, price: Number(row.price), amenities: parseJson(row.amenities), images: parseJson(row.images) };
}

function booking(row) {
  if (!row) return null;
  return {
    ...row,
    total_price: Number(row.total_price),
    hotels: hotel({
      id: row.hotel_id,
      name: row.hotel_name,
      address: row.hotel_address,
      images: row.hotel_images,
    }),
    rooms: room({ id: row.room_id, name: row.room_name, price: row.room_price, images: row.room_images }),
  };
}

async function currentUser(request, env) {
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  return session?.user || null;
}

async function requireUser(request, env) {
  const user = await currentUser(request, env);
  return user ? { user } : { response: json({ error: 'Sign in is required.' }, { status: 401 }) };
}

async function requireAdmin(request, env) {
  const result = await requireUser(request, env);
  if (result.response) return result;
  if (!env.ADMIN_EMAIL || result.user.email !== env.ADMIN_EMAIL) {
    return { response: json({ error: 'Admin access is required.' }, { status: 403 }) };
  }
  return result;
}

function validDates(checkIn, checkOut) {
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start;
}

async function publicRoutes(request, env, url) {
  const database = db(env);

  if (request.method === 'GET' && url.pathname === '/v1/hotels') {
    const city = url.searchParams.get('city');
    const result = city
      ? await database.execute(sql`SELECT * FROM hotels WHERE lower(city) LIKE lower(${`%${city}%`}) ORDER BY is_verified DESC, rating DESC NULLS LAST, name`)
      : await database.execute(sql`SELECT * FROM hotels ORDER BY is_verified DESC, rating DESC NULLS LAST, name`);
    return json(rows(result).map(hotel));
  }

  const match = url.pathname.match(/^\/v1\/hotels\/([^/]+)$/);
  if (request.method === 'GET' && match) {
    const hotelResult = await database.execute(sql`SELECT * FROM hotels WHERE id = ${match[1]} LIMIT 1`);
    const property = hotel(one(hotelResult));
    if (!property) return json({ error: 'Hotel not found.' }, { status: 404 });
    const roomResult = await database.execute(sql`SELECT * FROM rooms WHERE hotel_id = ${match[1]} ORDER BY price`);
    return json({ hotel: property, rooms: rows(roomResult).map(room) });
  }

  return null;
}

async function userRoutes(request, env, url) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const database = db(env);

  if (request.method === 'GET' && url.pathname === '/v1/me') {
    const result = await database.execute(sql`SELECT full_name, phone_number FROM profiles WHERE user_id = ${auth.user.id} LIMIT 1`);
    return json({ user: auth.user, profile: one(result) || {} });
  }

  if (request.method === 'PATCH' && url.pathname === '/v1/me') {
    const body = await request.json();
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : null;
    const phone = typeof body.phone_number === 'string' ? body.phone_number.trim() : null;
    await database.execute(sql`
      INSERT INTO profiles (user_id, full_name, phone_number)
      VALUES (${auth.user.id}, ${fullName}, ${phone})
      ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, phone_number = EXCLUDED.phone_number, updated_at = now()
    `);
    return json({ ok: true });
  }

  if (request.method === 'GET' && url.pathname === '/v1/trips') {
    const result = await database.execute(sql`
      SELECT b.*, h.name AS hotel_name, h.address AS hotel_address, h.images AS hotel_images,
             r.name AS room_name, r.price AS room_price, r.images AS room_images
      FROM bookings b
      JOIN hotels h ON h.id = b.hotel_id
      JOIN rooms r ON r.id = b.room_id
      WHERE b.user_id = ${auth.user.id}
      ORDER BY b.created_at DESC
    `);
    return json(rows(result).map(booking));
  }

  if (request.method === 'POST' && url.pathname === '/v1/bookings') {
    const body = await request.json();
    if (!body.room_id || !body.check_in_date || !body.check_out_date || !validDates(body.check_in_date, body.check_out_date)) {
      return badRequest('Choose a room and valid check-in and check-out dates.');
    }

    const selectedRoom = one(await database.execute(sql`SELECT * FROM rooms WHERE id = ${body.room_id} LIMIT 1`));
    if (!selectedRoom) return json({ error: 'Room not found.' }, { status: 404 });
    const nights = Math.ceil((new Date(`${body.check_out_date}T00:00:00Z`) - new Date(`${body.check_in_date}T00:00:00Z`)) / 86400000);
    const total = Number(selectedRoom.price) * nights;
    const bookingId = id();

    await database.execute(sql`
      INSERT INTO bookings (id, user_id, hotel_id, room_id, check_in_date, check_out_date, total_price, payment_status, payment_provider, booking_status)
      VALUES (${bookingId}, ${auth.user.id}, ${selectedRoom.hotel_id}, ${selectedRoom.id}, ${body.check_in_date}, ${body.check_out_date}, ${total}, 'pending', ${body.payment_provider || null}, 'payment_pending')
    `);
    return json({ id: bookingId, total_price: total, payment_status: 'pending', booking_status: 'payment_pending' }, { status: 201 });
  }

  return null;
}

async function adminRoutes(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const database = db(env);

  if (request.method === 'GET' && url.pathname === '/v1/admin/hotels') {
    return json(rows(await database.execute(sql`SELECT * FROM hotels ORDER BY created_at DESC`)).map(hotel));
  }

  if (request.method === 'GET' && url.pathname === '/v1/admin/users') {
    const result = await database.execute(sql`
      SELECT u.id, u.email, u.name, u.created_at, p.phone_number, p.full_name
      FROM "user" u LEFT JOIN profiles p ON p.user_id = u.id ORDER BY u.created_at DESC
    `);
    return json(rows(result));
  }

  if (request.method === 'GET' && url.pathname === '/v1/admin/bookings') {
    const result = await database.execute(sql`
      SELECT b.*, coalesce(p.full_name, u.name) AS guest_name, p.phone_number, h.name AS hotel_name, r.name AS room_name
      FROM bookings b JOIN "user" u ON u.id = b.user_id LEFT JOIN profiles p ON p.user_id = u.id
      JOIN hotels h ON h.id = b.hotel_id JOIN rooms r ON r.id = b.room_id ORDER BY b.created_at DESC
    `);
    return json(rows(result).map((record) => ({ ...record, total_price: Number(record.total_price) })));
  }

  if (request.method === 'POST' && url.pathname === '/v1/admin/hotels') {
    const body = await request.json();
    if (!body.name || !body.city) return badRequest('Hotel name and city are required.');
    const hotelId = id();
    await database.execute(sql`
      INSERT INTO hotels (id, name, city, address, google_map_link, description, starting_price, images, amenities, manager_phone, manager_email, manager_name, is_verified, rating, payment_methods, security_features)
      VALUES (${hotelId}, ${body.name}, ${body.city}, ${JSON.stringify(body.address || [])}::jsonb, ${body.google_map_link || null}, ${body.description || null}, ${Number(body.starting_price) || 0}, ${JSON.stringify(body.images || [])}::jsonb, ${JSON.stringify(body.amenities || [])}::jsonb, ${body.manager_phone || null}, ${body.manager_email || null}, ${body.manager_name || null}, ${Boolean(body.is_verified)}, ${body.rating || null}, ${JSON.stringify(body.payment_methods || [])}::jsonb, ${JSON.stringify(body.security_features || [])}::jsonb)
    `);
    for (const item of body.rooms || []) {
      await database.execute(sql`
        INSERT INTO rooms (id, hotel_id, name, price, amenities, images, capacity_adults, bed_size, total_units)
        VALUES (${id()}, ${hotelId}, ${item.name}, ${Number(item.price) || 0}, ${JSON.stringify(item.amenities || [])}::jsonb, ${JSON.stringify(item.images || [])}::jsonb, ${Number(item.capacity_adults) || 2}, ${item.bed_size || null}, ${Number(item.total_units) || 1})
      `);
    }
    return json({ id: hotelId }, { status: 201 });
  }

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });

    try {
      if (url.pathname.startsWith('/api/auth')) {
        return withCors(await createAuth(env).handler(request), request, env);
      }

      if (url.pathname === '/health') return withCors(json({ ok: true }), request, env);

      const response = await publicRoutes(request, env, url)
        || await userRoutes(request, env, url)
        || await adminRoutes(request, env, url)
        || json({ error: 'Not found.' }, { status: 404 });
      return withCors(response, request, env);
    } catch (error) {
      console.error(error);
      return withCors(json({ error: 'Request failed.' }, { status: 500 }), request, env);
    }
  },
};
