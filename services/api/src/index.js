import { createAdminAuth, createAuth, sendAuthEmail } from './auth.js';
import { all, db, first, run } from './db.js';
import { ACTIVE_BOOKING_FILTER, INSERT_BOOKING_SQL, addDays, citySearchTerms, PAYMENT_HOLD_MINUTES, roomAvailable, unavailableDates } from './availability.js';

const json = (body, status = 200) => Response.json(body, { status });
const cents = (value) => Math.round(Number(value) * 100);
const dollars = (value) => Number(value || 0) / 100;

function list(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return value.split(',').map((s) => s.trim()).filter(Boolean); }
}

function hotel(row) {
  if (!row) return null;
  // Public responses must not inherit manager contacts or future internal columns.
  return {
    id: row.id, name: row.name, city: row.city, location: row.city,
    description: row.description, google_map_link: row.google_map_link,
    starting_price_cents: row.starting_price_cents, starting_price: dollars(row.starting_price_cents),
    is_verified: Boolean(row.is_verified), address: list(row.address), images: list(row.images),
    amenities: list(row.amenities), payment_methods: list(row.payment_methods), security_features: list(row.security_features),
    rating: row.rating, created_at: row.created_at, updated_at: row.updated_at,
  };
}

function adminHotel(row) {
  if (!row) return null;
  return { ...hotel(row), manager_name: row.manager_name, manager_email: row.manager_email, manager_phone: row.manager_phone };
}

function room(row) {
  if (!row) return null;
  return { ...row, price: dollars(row.price_cents), amenities: list(row.amenities), images: list(row.images) };
}

function booking(row) {
  if (!row) return null;
  const result = { ...row, total_price: dollars(row.total_cents) };
  if (row.hotel_name) result.hotels = hotel({ id: row.hotel_id, name: row.hotel_name, city: row.hotel_city, address: row.hotel_address, images: row.hotel_images, starting_price_cents: row.hotel_starting_price_cents });
  if (row.room_name) result.rooms = room({ id: row.room_id, name: row.room_name, price_cents: row.room_price_cents, images: row.room_images });
  if (row.guest_name) result.users = { full_name: row.guest_name, phone_number: row.phone_number };
  return result;
}

function cors(request, env) {
  const origin = request.headers.get('origin');
  const trusted = (env.TRUSTED_ORIGINS || '').split(',').map((s) => s.trim());
  return {
    ...(origin && trusted.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie, X-Idempotency-Key',
    Vary: 'Origin',
  };
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors(request, env))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function error(message, status = 400) { return json({ error: message }, status); }
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}
function validStay(start, end) { return validDate(start) && validDate(end) && start < end; }
function validMoney(value) { return Number.isFinite(Number(value)) && cents(value) >= 0; }

async function overlappingBookings(database, start, end) {
  return all(database, `SELECT b.room_id, b.check_in_date, b.check_out_date FROM bookings b WHERE b.check_in_date < ? AND b.check_out_date > ? AND ${ACTIVE_BOOKING_FILTER}`, end, start);
}

function stayFilter(url) {
  const checkIn = url.searchParams.get('check_in');
  const checkOut = url.searchParams.get('check_out');
  if (!checkIn && !checkOut) return { dates: null };
  if (!validStay(checkIn, checkOut) || (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000 > 365) return { error: error('Choose valid check-in and check-out dates within one year.') };
  return { dates: { checkIn, checkOut } };
}

async function currentUser(request, env) {
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  const control = await first(db(env), 'SELECT is_blocked FROM traveler_controls WHERE email = ? COLLATE NOCASE', session.user.email);
  return control?.is_blocked ? null : session.user;
}

async function requireUser(request, env) {
  const user = await currentUser(request, env);
  return user ? { user } : { response: error('Sign in is required.', 401) };
}

async function requireAdmin(request, env) {
  const session = await createAdminAuth(env).api.getSession({ headers: request.headers });
  const user = session?.user;
  if (!user) return { response: error('Admin sign in is required.', 401) };
  if (!env.ADMIN_EMAIL || user.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
    return { response: error('Admin access is required.', 403) };
  }
  return { user };
}

async function tokenHash(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function adminSetupRoutes(request, env, url) {
  if (!url.pathname.startsWith('/v1/admin/setup/')) return null;
  if (request.method !== 'POST') return error('Not found.', 404);
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const panelURL = env.ADMIN_PANEL_URL?.replace(/\/$/, '');
  if (!email || !panelURL || !env.SEND_EMAIL || !env.ADMIN_AUTH_SECRET) return error('Admin setup is not configured.', 503);
  const database = db(env);
  const now = Math.floor(Date.now() / 1000);

  if (url.pathname === '/v1/admin/setup/request') {
    const existing = await first(database, 'SELECT id FROM admin_user WHERE email = ? COLLATE NOCASE', email);
    if (existing) return json({ ok: true });
    const pending = await first(database, 'SELECT created_at FROM admin_setup WHERE email = ?', email);
    if (pending && pending.created_at > now - 900) return json({ ok: true });
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const hash = await tokenHash(token);
    await run(database, 'INSERT INTO admin_setup (email, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at, expires_at = excluded.expires_at', email, hash, now, now + 1800);
    try {
      await sendAuthEmail(env, email, 'Set up your Hoysii admin account', `Open this link to set your Hoysii admin password. It expires in 30 minutes: ${panelURL}/admin/setup#token=${token}`);
    } catch (cause) {
      await run(database, 'DELETE FROM admin_setup WHERE email = ? AND token_hash = ?', email, hash);
      throw cause;
    }
    return json({ ok: true });
  }

  if (url.pathname === '/v1/admin/setup/complete') {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || password.length < 12 || password.length > 128) return error('Use a valid setup link and a password of 12 to 128 characters.');
    const hash = await tokenHash(token);
    const pending = await first(database, 'SELECT email FROM admin_setup WHERE token_hash = ? AND expires_at > ?', hash, now);
    if (!pending || pending.email !== email) return error('This setup link is invalid or expired.', 400);
    const existing = await first(database, 'SELECT id FROM admin_user WHERE email = ? COLLATE NOCASE', email);
    if (existing) return error('The admin account already exists.', 409);
    const consumed = await run(database, 'DELETE FROM admin_setup WHERE token_hash = ? AND expires_at > ?', hash, now);
    if (!consumed.meta?.changes) return error('This setup link is invalid or expired.', 400);
    await createAdminAuth(env).api.signUpEmail({ body: { name: 'Hoysii Admin', email, password, callbackURL: `${panelURL}/admin` } });
    return json({ ok: true, message: 'Check your email to verify the admin account.' }, 201);
  }
  return error('Not found.', 404);
}

async function publicRoutes(request, env, url) {
  const database = db(env);
  if (request.method === 'GET' && url.pathname === '/v1/hotels') {
    const stay = stayFilter(url);
    if (stay.error) return stay.error;
    const city = url.searchParams.get('city');
    const cityTerms = city ? citySearchTerms(city) : [];
    let records = city
      ? await all(database, `SELECT * FROM hotels WHERE ${cityTerms.map(() => 'city LIKE ? COLLATE NOCASE').join(' OR ')} ORDER BY is_verified DESC, rating DESC, name`, ...cityTerms.map((term) => `%${term}%`))
      : await all(database, 'SELECT * FROM hotels ORDER BY is_verified DESC, rating DESC, name');
    if (stay.dates) {
      const adults = Number(url.searchParams.get('adults') || 1);
      if (!Number.isInteger(adults) || adults < 1 || adults > 20) return error('Guest count is invalid.');
      const rooms = await all(database, 'SELECT * FROM rooms WHERE capacity_adults >= ?', adults);
      const bookings = await overlappingBookings(database, stay.dates.checkIn, stay.dates.checkOut);
      const availableHotels = new Set(rooms.filter((item) => roomAvailable(item, bookings, stay.dates.checkIn, stay.dates.checkOut)).map((item) => item.hotel_id));
      records = records.filter((item) => availableHotels.has(item.id));
    }
    return json(records.map(hotel));
  }

  const hotelMatch = url.pathname.match(/^\/v1\/hotels\/([^/]+)$/);
  if (request.method === 'GET' && hotelMatch) {
    const stay = stayFilter(url);
    if (stay.error) return stay.error;
    const property = hotel(await first(database, 'SELECT * FROM hotels WHERE id = ?', hotelMatch[1]));
    if (!property) return error('Hotel not found.', 404);
    let rooms = await all(database, 'SELECT * FROM rooms WHERE hotel_id = ? ORDER BY price_cents', hotelMatch[1]);
    if (stay.dates) {
      const adults = Number(url.searchParams.get('adults') || 1);
      if (!Number.isInteger(adults) || adults < 1 || adults > 20) return error('Guest count is invalid.');
      const bookings = await overlappingBookings(database, stay.dates.checkIn, stay.dates.checkOut);
      rooms = rooms.filter((item) => item.capacity_adults >= adults && roomAvailable(item, bookings, stay.dates.checkIn, stay.dates.checkOut));
    }
    rooms = rooms.map(room);
    return json({ hotel: property, rooms });
  }

  if (request.method === 'GET' && url.pathname === '/v1/availability/calendar') {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!validDate(from) || !validDate(to) || from > to || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 61) return error('Choose a valid calendar range of up to 62 days.');
    const roomId = url.searchParams.get('room_id');
    const city = url.searchParams.get('city');
    const adults = Number(url.searchParams.get('adults') || 1);
    if (!Number.isInteger(adults) || adults < 1 || adults > 20) return error('Guest count is invalid.');
    const cityTerms = city ? citySearchTerms(city) : [];
    const rooms = roomId
      ? await all(database, 'SELECT * FROM rooms WHERE id = ? AND capacity_adults >= ?', roomId, adults)
      : city
        ? await all(database, `SELECT r.* FROM rooms r JOIN hotels h ON h.id = r.hotel_id WHERE (${cityTerms.map(() => 'h.city LIKE ? COLLATE NOCASE').join(' OR ')}) AND r.capacity_adults >= ?`, ...cityTerms.map((term) => `%${term}%`), adults)
        : await all(database, 'SELECT * FROM rooms WHERE capacity_adults >= ?', adults);
    const bookings = await overlappingBookings(database, from, addDays(to, 1));
    return json({ unavailable_dates: unavailableDates(rooms, bookings, from, to) });
  }

  const availabilityMatch = url.pathname.match(/^\/v1\/rooms\/([^/]+)\/availability$/);
  if (request.method === 'GET' && availabilityMatch) {
    const stay = stayFilter(url);
    if (stay.error || !stay.dates) return stay.error || error('Choose check-in and check-out dates.');
    const selected = await first(database, 'SELECT * FROM rooms WHERE id = ?', availabilityMatch[1]);
    if (!selected) return error('Room not found.', 404);
    const bookings = await overlappingBookings(database, stay.dates.checkIn, stay.dates.checkOut);
    return json({ available: roomAvailable(selected, bookings, stay.dates.checkIn, stay.dates.checkOut) });
  }

  const mediaMatch = url.pathname.match(/^\/v1\/media\/(hotels\/[a-f0-9-]+\.(?:jpg|png|webp|avif))$/);
  if (request.method === 'GET' && mediaMatch) {
    if (!env.HOTEL_MEDIA) return error('Media storage is unavailable.', 503);
    const object = await env.HOTEL_MEDIA.get(mediaMatch[1]);
    if (!object) return error('Image not found.', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=86400');
    return new Response(object.body, { headers });
  }
  return null;
}

async function userRoutes(request, env, url) {
  if (!['/v1/me', '/v1/trips', '/v1/bookings'].includes(url.pathname)) return null;
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const database = db(env);

  if (request.method === 'GET' && url.pathname === '/v1/me') {
    const profile = await first(database, 'SELECT full_name, phone_number FROM profiles WHERE user_id = ?', auth.user.id);
    return json({ user: auth.user, profile: profile || {} });
  }
  if (request.method === 'PATCH' && url.pathname === '/v1/me') {
    const body = await request.json();
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : auth.user.name;
    const phone = typeof body.phone_number === 'string' ? body.phone_number.trim() : null;
    await run(database, 'INSERT INTO profiles (user_id, full_name, phone_number) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET full_name = excluded.full_name, phone_number = COALESCE(excluded.phone_number, profiles.phone_number), updated_at = CURRENT_TIMESTAMP', auth.user.id, fullName, phone);
    return json({ ok: true });
  }
  if (request.method === 'GET' && url.pathname === '/v1/trips') {
    const records = await all(database, `SELECT b.*, h.name AS hotel_name, h.city AS hotel_city, h.address AS hotel_address, h.images AS hotel_images, h.starting_price_cents AS hotel_starting_price_cents, r.name AS room_name, r.price_cents AS room_price_cents, r.images AS room_images FROM bookings b JOIN hotels h ON h.id = b.hotel_id JOIN rooms r ON r.id = b.room_id WHERE b.user_id = ?`, auth.user.id);
    const legacy = auth.user.emailVerified
      ? await all(database, `SELECT b.*, h.name AS hotel_name, h.city AS hotel_city, h.address AS hotel_address, h.images AS hotel_images, h.starting_price_cents AS hotel_starting_price_cents, r.name AS room_name, r.price_cents AS room_price_cents, r.images AS room_images FROM legacy_bookings b JOIN legacy_users u ON u.id = b.user_id JOIN hotels h ON h.id = b.hotel_id JOIN rooms r ON r.id = b.room_id WHERE u.email = ? COLLATE NOCASE`, auth.user.email)
      : [];
    return json([...records, ...legacy].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(booking));
  }
  if (request.method === 'POST' && url.pathname === '/v1/bookings') {
    const body = await request.json();
    if (!body.room_id || !validStay(body.check_in_date, body.check_out_date) || (Date.parse(`${body.check_out_date}T00:00:00Z`) - Date.parse(`${body.check_in_date}T00:00:00Z`)) / 86400000 > 365) return error('Choose a room and valid stay dates within one year.');
    const guests = Number(body.guests || 1);
    if (!Number.isInteger(guests) || guests < 1 || guests > 20) return error('Guest count is invalid.');
    const key = request.headers.get('X-Idempotency-Key') || body.idempotency_key;
    if (!key || typeof key !== 'string' || key.length > 100) return error('An idempotency key is required.');
    const existing = await first(database, 'SELECT * FROM bookings WHERE idempotency_key = ? AND user_id = ?', key, auth.user.id);
    if (existing) {
      if (existing.booking_status === 'payment_pending' && existing.payment_status === 'pending') {
        const hold = await first(database, `SELECT datetime(?) <= datetime('now', '-${PAYMENT_HOLD_MINUTES} minutes') AS expired`, existing.created_at);
        if (hold?.expired) return error('This unpaid room hold expired. Please try booking again.', 409);
      }
      return json(booking(existing));
    }
    const selected = await first(database, 'SELECT * FROM rooms WHERE id = ?', body.room_id);
    if (!selected) return error('Room not found.', 404);
    if (Number(body.adults || guests) > selected.capacity_adults) return error('This room cannot accommodate that many adults.');
    const nights = Math.round((Date.parse(`${body.check_out_date}T00:00:00Z`) - Date.parse(`${body.check_in_date}T00:00:00Z`)) / 86400000);
    const total = selected.price_cents * nights;
    const bookingId = crypto.randomUUID();
    try {
      const result = await run(database, INSERT_BOOKING_SQL, body.check_in_date, body.check_out_date, bookingId, auth.user.id, body.check_in_date, body.check_out_date, guests, total, body.payment_provider || null, key, body.room_id);
      if (!result.meta?.changes) return error('This room is no longer available for those dates.', 409);
    } catch (cause) {
      const retry = await first(database, 'SELECT * FROM bookings WHERE idempotency_key = ? AND user_id = ?', key, auth.user.id);
      if (retry) return json(booking(retry));
      throw cause;
    }
    return json({ id: bookingId, total_price: dollars(total), payment_status: 'pending', booking_status: 'payment_pending' }, 201);
  }
  return null;
}

function hotelValues(body) {
  return {
    name: String(body.name || '').trim(), city: String(body.city || '').trim(),
    address: JSON.stringify(list(body.address)), google_map_link: body.google_map_link || null,
    description: body.description || null, starting_price_cents: cents(body.starting_price || 0),
    images: JSON.stringify(list(body.images)), amenities: JSON.stringify(list(body.amenities)),
    manager_phone: body.manager_phone || null, manager_email: body.manager_email || null, manager_name: body.manager_name || null,
    is_verified: body.is_verified ? 1 : 0, rating: body.rating == null || body.rating === '' ? null : Number(body.rating),
    payment_methods: JSON.stringify(list(body.payment_methods)), security_features: JSON.stringify(list(body.security_features)),
  };
}

const deletedEmail = (id) => `deleted+${id}@hoysii.invalid`;

async function managedTraveler(database, id) {
  if (id.startsWith('invite:')) {
    const email = id.slice(7);
    const invite = await first(database, 'SELECT email, invited_at FROM traveler_controls WHERE email = ? COLLATE NOCASE', email);
    return invite?.invited_at ? { email: invite.email, kind: 'invite' } : null;
  }
  const current = await first(database, 'SELECT id, email FROM "user" WHERE id = ?', id);
  if (current && current.email !== deletedEmail(current.id)) return { ...current, kind: 'user' };
  const legacy = await first(database, 'SELECT id, email FROM legacy_users WHERE id = ?', id);
  return legacy && legacy.email !== deletedEmail(legacy.id) ? { ...legacy, kind: 'legacy' } : null;
}

async function travelerList(database) {
  const current = await all(database, `SELECT u.id, u.email, COALESCE(p.full_name, u.name) AS full_name, p.phone_number, u.createdAt AS created_at, COALESCE(c.is_blocked, 0) AS is_blocked, 'user' AS source FROM "user" u LEFT JOIN profiles p ON p.user_id = u.id LEFT JOIN traveler_controls c ON c.email = u.email COLLATE NOCASE WHERE u.email NOT LIKE 'deleted+%@hoysii.invalid'`);
  const legacy = await all(database, `SELECT l.id, l.email, l.full_name, l.phone_number, l.created_at, COALESCE(c.is_blocked, 0) AS is_blocked, 'legacy' AS source FROM legacy_users l LEFT JOIN traveler_controls c ON c.email = l.email COLLATE NOCASE WHERE l.email NOT LIKE 'deleted+%@hoysii.invalid' AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.email = l.email COLLATE NOCASE)`);
  const invites = await all(database, `SELECT 'invite:' || c.email AS id, c.email, c.invited_name AS full_name, c.invited_phone AS phone_number, c.invited_at AS created_at, c.is_blocked, 'invited' AS source FROM traveler_controls c WHERE c.invited_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.email = c.email COLLATE NOCASE) AND NOT EXISTS (SELECT 1 FROM legacy_users l WHERE l.email = c.email COLLATE NOCASE)`);
  return [...current, ...legacy, ...invites].map((user) => ({ ...user, is_blocked: Boolean(user.is_blocked) })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function deleteTraveler(database, email) {
  const current = await first(database, 'SELECT id FROM "user" WHERE email = ? COLLATE NOCASE', email);
  const legacy = await first(database, 'SELECT id FROM legacy_users WHERE email = ? COLLATE NOCASE', email);
  const statements = [];
  if (current) {
    const hasBooking = await first(database, 'SELECT 1 AS found FROM bookings WHERE user_id = ? LIMIT 1', current.id);
    statements.push(database.prepare('DELETE FROM session WHERE userId = ?').bind(current.id));
    statements.push(database.prepare('DELETE FROM account WHERE userId = ?').bind(current.id));
    statements.push(database.prepare('DELETE FROM profiles WHERE user_id = ?').bind(current.id));
    statements.push(hasBooking
      ? database.prepare('UPDATE "user" SET email = ?, name = ?, image = NULL, emailVerified = 0, updatedAt = ? WHERE id = ?').bind(deletedEmail(current.id), 'Deleted guest', Date.now(), current.id)
      : database.prepare('DELETE FROM "user" WHERE id = ?').bind(current.id));
  }
  if (legacy) {
    const hasBooking = await first(database, 'SELECT 1 AS found FROM legacy_bookings WHERE user_id = ? LIMIT 1', legacy.id);
    statements.push(hasBooking
      ? database.prepare('UPDATE legacy_users SET email = ?, full_name = ?, phone_number = NULL, clerk_id = ?, role = NULL WHERE id = ?').bind(deletedEmail(legacy.id), 'Deleted guest', `deleted:${legacy.id}`, legacy.id)
      : database.prepare('DELETE FROM legacy_users WHERE id = ?').bind(legacy.id));
  }
  statements.push(database.prepare('DELETE FROM traveler_controls WHERE email = ? COLLATE NOCASE').bind(email));
  await database.batch(statements);
}

async function adminRoutes(request, env, url) {
  if (!url.pathname.startsWith('/v1/admin/')) return null;
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const database = db(env);

  if (request.method === 'GET' && url.pathname === '/v1/admin/session') return json({ user: auth.user });
  if (request.method === 'GET' && url.pathname === '/v1/admin/hotels') {
    return json((await all(database, 'SELECT * FROM hotels ORDER BY created_at DESC')).map(adminHotel));
  }
  if (request.method === 'GET' && url.pathname === '/v1/admin/users') {
    return json(await travelerList(database));
  }
  if (request.method === 'POST' && url.pathname === '/v1/admin/users') {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const phone = typeof body.phone_number === 'string' ? body.phone_number.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 120 || phone.length > 50) return error('Enter a valid email, name, and optional phone number.');
    const exists = await first(database, 'SELECT 1 AS found FROM "user" WHERE email = ? COLLATE NOCASE UNION SELECT 1 FROM legacy_users WHERE email = ? COLLATE NOCASE UNION SELECT 1 FROM traveler_controls WHERE email = ? COLLATE NOCASE LIMIT 1', email, email, email);
    if (exists) return error('This traveler already exists or has an invitation.', 409);
    await run(database, 'INSERT INTO traveler_controls (email, invited_name, invited_phone, invited_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', email, name, phone || null);
    try {
      await sendAuthEmail(env, email, 'You are invited to Hoysii', `Hoysii has invited you to create a traveler account. Open the Hoysii app and sign up with ${email}. You will choose your own password and verify your email before booking.`);
    } catch (cause) {
      await run(database, 'DELETE FROM traveler_controls WHERE email = ? COLLATE NOCASE AND invited_at IS NOT NULL', email);
      throw cause;
    }
    return json({ ok: true, email }, 201);
  }
  const userMatch = url.pathname.match(/^\/v1\/admin\/users\/([^/]+)$/);
  if (userMatch && ['PATCH', 'DELETE'].includes(request.method)) {
    const target = await managedTraveler(database, decodeURIComponent(userMatch[1]));
    if (!target) return error('Traveler not found.', 404);
    if (request.method === 'DELETE') {
      await deleteTraveler(database, target.email);
      return json({ ok: true });
    }
    const body = await request.json().catch(() => ({}));
    if (Object.hasOwn(body, 'is_blocked')) {
      if (typeof body.is_blocked !== 'boolean') return error('Block status must be true or false.');
      await run(database, 'INSERT INTO traveler_controls (email, is_blocked) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET is_blocked = excluded.is_blocked, updated_at = CURRENT_TIMESTAMP', target.email, Number(body.is_blocked));
      if (body.is_blocked) await run(database, 'DELETE FROM session WHERE userId IN (SELECT id FROM "user" WHERE email = ? COLLATE NOCASE)', target.email);
      return json({ ok: true });
    }
    const name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const phone = typeof body.phone_number === 'string' ? body.phone_number.trim() : '';
    if (!name || name.length > 120 || phone.length > 50) return error('Enter a name and optional phone number.');
    const current = await first(database, 'SELECT id FROM "user" WHERE email = ? COLLATE NOCASE', target.email);
    const statements = [];
    if (current) {
      statements.push(database.prepare('UPDATE "user" SET name = ?, updatedAt = ? WHERE id = ?').bind(name, Date.now(), current.id));
      statements.push(database.prepare('INSERT INTO profiles (user_id, full_name, phone_number) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET full_name = excluded.full_name, phone_number = excluded.phone_number, updated_at = CURRENT_TIMESTAMP').bind(current.id, name, phone || null));
    }
    statements.push(database.prepare('UPDATE legacy_users SET full_name = ?, phone_number = ? WHERE email = ? COLLATE NOCASE').bind(name, phone || null, target.email));
    statements.push(database.prepare('UPDATE traveler_controls SET invited_name = ?, invited_phone = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ? COLLATE NOCASE AND invited_at IS NOT NULL').bind(name, phone || null, target.email));
    await database.batch(statements);
    return json({ ok: true });
  }
  if (request.method === 'GET' && url.pathname === '/v1/admin/bookings') {
    const current = await all(database, `SELECT b.*, COALESCE(p.full_name, u.name) AS guest_name, p.phone_number, h.name AS hotel_name, r.name AS room_name FROM bookings b JOIN "user" u ON u.id = b.user_id LEFT JOIN profiles p ON p.user_id = u.id JOIN hotels h ON h.id = b.hotel_id JOIN rooms r ON r.id = b.room_id`);
    const legacy = await all(database, `SELECT b.*, u.full_name AS guest_name, u.phone_number, h.name AS hotel_name, r.name AS room_name FROM legacy_bookings b JOIN legacy_users u ON u.id = b.user_id JOIN hotels h ON h.id = b.hotel_id JOIN rooms r ON r.id = b.room_id`);
    return json([...current, ...legacy].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(booking));
  }
  if (request.method === 'POST' && url.pathname === '/v1/admin/hotels') {
    const body = await request.json();
    if (!body.name || !body.city || !validMoney(body.starting_price || 0)) return error('Hotel name, city, and a valid starting price are required.');
    const item = hotelValues(body);
    const hotelId = body.id || crypto.randomUUID();
    const statements = [database.prepare(`INSERT INTO hotels (id, name, city, address, google_map_link, description, starting_price_cents, images, amenities, manager_phone, manager_email, manager_name, is_verified, rating, payment_methods, security_features) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(hotelId, ...Object.values(item))];
    for (const roomBody of body.rooms || []) {
      if (!roomBody.name || !validMoney(roomBody.price)) return error('Each room needs a name and valid price.');
      statements.push(database.prepare(`INSERT INTO rooms (id, hotel_id, name, price_cents, amenities, images, capacity_adults, bed_size, total_units) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(roomBody.id || crypto.randomUUID(), hotelId, roomBody.name, cents(roomBody.price), JSON.stringify(list(roomBody.amenities)), JSON.stringify(list(roomBody.images)), Number(roomBody.capacity_adults) || 2, roomBody.bed_size || null, Number(roomBody.total_units) || 1));
    }
    await database.batch(statements);
    return json({ id: hotelId }, 201);
  }
  const hotelMatch = url.pathname.match(/^\/v1\/admin\/hotels\/([^/]+)$/);
  if (hotelMatch && request.method === 'GET') {
    const property = adminHotel(await first(database, 'SELECT * FROM hotels WHERE id = ?', hotelMatch[1]));
    if (!property) return error('Hotel not found.', 404);
    const rooms = await all(database, 'SELECT * FROM rooms WHERE hotel_id = ? ORDER BY price_cents', hotelMatch[1]);
    return json({ hotel: property, rooms: rooms.map(room) });
  }
  if (hotelMatch && request.method === 'PATCH') {
    const body = await request.json();
    if (!body.name || !body.city || !validMoney(body.starting_price || 0)) return error('Hotel name, city, and a valid starting price are required.');
    const item = hotelValues(body);
    const result = await run(database, `UPDATE hotels SET name=?, city=?, address=?, google_map_link=?, description=?, starting_price_cents=?, images=?, amenities=?, manager_phone=?, manager_email=?, manager_name=?, is_verified=?, rating=?, payment_methods=?, security_features=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, ...Object.values(item), hotelMatch[1]);
    return result.meta?.changes ? json({ ok: true }) : error('Hotel not found.', 404);
  }
  if (hotelMatch && request.method === 'DELETE') {
    const result = await run(database, 'DELETE FROM hotels WHERE id = ?', hotelMatch[1]);
    return result.meta?.changes ? json({ ok: true }) : error('Hotel not found.', 404);
  }
  if (request.method === 'POST' && url.pathname === '/v1/admin/rooms') {
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];
    if (!items.length || items.some((item) => !item.hotel_id || !item.name || !validMoney(item.price))) return error('Each room needs a hotel, name, and valid price.');
    const statements = items.map((item) => database.prepare(`INSERT INTO rooms (id, hotel_id, name, price_cents, amenities, images, capacity_adults, bed_size, total_units) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), item.hotel_id, item.name, cents(item.price), JSON.stringify(list(item.amenities)), JSON.stringify(list(item.images)), Number(item.capacity_adults) || 2, item.bed_size || null, Number(item.total_units) || 1));
    await database.batch(statements);
    return json({ ok: true }, 201);
  }
  const roomMatch = url.pathname.match(/^\/v1\/admin\/rooms\/([^/]+)$/);
  if (roomMatch && request.method === 'DELETE') {
    const result = await run(database, 'DELETE FROM rooms WHERE id = ?', roomMatch[1]);
    return result.meta?.changes ? json({ ok: true }) : error('Room not found.', 404);
  }
  const bookingMatch = url.pathname.match(/^\/v1\/admin\/bookings\/([^/]+)\/payment$/);
  if (bookingMatch && request.method === 'PATCH') {
    const body = await request.json();
    if (!['paid', 'pending', 'refunded'].includes(body.payment_status)) return error('Invalid payment status.');
    const existing = await first(database, 'SELECT booking_status, payment_status, created_at FROM bookings WHERE id = ?', bookingMatch[1]);
    if (!existing) return error('Booking not found.', 404);
    if (body.payment_status === 'paid' && existing.booking_status === 'payment_pending' && existing.payment_status === 'pending') {
      const holdExpired = await first(database, `SELECT datetime(?) <= datetime('now', '-${PAYMENT_HOLD_MINUTES} minutes') AS expired`, existing.created_at);
      if (holdExpired?.expired) return error('The unpaid room hold expired. Recheck availability before recording payment.', 409);
    }
    const result = await run(database, `UPDATE bookings SET payment_status = ?, booking_status = CASE WHEN ? = 'paid' THEN 'hotel_confirmation_pending' ELSE booking_status END, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (? != 'paid' OR booking_status != 'payment_pending' OR payment_status != 'pending' OR created_at > datetime('now', '-${PAYMENT_HOLD_MINUTES} minutes'))`, body.payment_status, body.payment_status, bookingMatch[1], body.payment_status);
    return result.meta?.changes ? json({ ok: true }) : error('The unpaid room hold expired. Recheck availability before recording payment.', 409);
  }
  if (request.method === 'POST' && url.pathname === '/v1/admin/media') {
    if (!env.HOTEL_MEDIA) return error('R2 HOTEL_MEDIA binding is not configured.', 503);
    const form = await request.formData();
    const file = form.get('file');
    const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
    if (!file || !types[file.type] || file.size > 8 * 1024 * 1024) return error('Upload a JPEG, PNG, WebP, or AVIF image under 8 MB.');
    const key = `hotels/${crypto.randomUUID()}.${types[file.type]}`;
    await env.HOTEL_MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    return json({ url: `${url.origin}/v1/media/${key}` }, 201);
  }
  return null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/admin-auth')) {
        if (url.pathname.startsWith('/api/admin-auth/sign-up/')) return withCors(error('Admin signup is private.', 403), request, env);
        return withCors(await createAdminAuth(env).handler(request), request, env);
      }
      if (url.pathname.startsWith('/api/auth')) {
        let emailSendFailure;
        const auth = createAuth(env, { onEmailSendFailure: (cause) => { emailSendFailure = cause; } });
        const response = await auth.handler(request);
        if (emailSendFailure) {
          console.error('Traveler auth email was not accepted by the email service.', {
            code: emailSendFailure.code || 'UNKNOWN',
          });
          return withCors(json({
            code: 'EMAIL_SEND_FAILED',
            message: 'We could not send the email code. Please try again in a moment.',
          }, 502), request, env);
        }
        return withCors(response, request, env);
      }
      if (url.pathname === '/health') return withCors(json({ ok: true }), request, env);
      const response = await adminSetupRoutes(request, env, url) || await publicRoutes(request, env, url) || await userRoutes(request, env, url) || await adminRoutes(request, env, url) || error('Not found.', 404);
      return withCors(response, request, env);
    } catch (cause) {
      console.error(cause);
      return withCors(error('Request failed.', 500), request, env);
    }
  },
};
