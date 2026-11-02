import { all, db, first, run } from "./db.js";
import { createPartnerAuth, partnerOrigins, sendAuthEmail } from "./auth.js";
import { adminOperations } from "./operations.js";
import { ACTIVE_BOOKING_FILTER, addDays } from "./availability.js";
import { reject, today, validDate, validRange } from "./booking-service.js";

const json = Response.json;
const text = (value) => (typeof value === "string" ? value.trim() : "");
const eligible =
  "b.booking_status IN ('confirmed','checked_in','completed') AND b.payment_status IN ('paid','partially_refunded')";
const decodeList = (value) => {
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
};

export async function saveProfile(env, user, body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    reject("Send a JSON object.");
  const database = db(env);
  const previous = await first(
    database,
    "SELECT * FROM profiles WHERE user_id=?",
    user.id,
  );
  const name =
    body.full_name === undefined
      ? previous?.full_name || user.name
      : text(body.full_name);
  const phone =
    body.phone_number === undefined
      ? previous?.phone_number || ""
      : text(body.phone_number);
  if (
    !name ||
    name.length > 120 ||
    phone.length > 50 ||
    (phone && !/^[+\d\s().-]{5,50}$/.test(phone))
  )
    reject("Enter your name and a valid optional phone number.");
  await database.batch([
    database
      .prepare(
        "INSERT INTO profiles (user_id,full_name,phone_number) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,phone_number=excluded.phone_number,updated_at=CURRENT_TIMESTAMP",
      )
      .bind(user.id, name, phone || null),
    database
      .prepare('UPDATE "user" SET name=?,updatedAt=? WHERE id=?')
      .bind(name, Date.now(), user.id),
  ]);
  return json({ full_name: name, phone_number: phone || null });
}

export async function publicReviews(request, env, url) {
  const match = url.pathname.match(/^\/v1\/hotels\/([^/]+)\/reviews$/);
  if (!match || request.method !== "GET") return null;
  const database = db(env);
  if (!(await first(database, "SELECT id FROM hotels WHERE id=?", match[1])))
    reject("Hotel not found.", 404);
  const aggregate = await first(
    database,
    `SELECT COUNT(*) AS count, ROUND(AVG(r.rating),1) AS average FROM reviews r JOIN bookings b ON b.id=r.booking_id WHERE r.hotel_id=? AND r.hidden=0 AND b.hotel_id=r.hotel_id AND ${eligible}`,
    match[1],
  );
  const offset = Number(url.searchParams.get("offset") || 0);
  if (!Number.isSafeInteger(offset) || offset < 0)
    reject("Invalid review page.");
  const records = await all(
    database,
    `SELECT r.id,r.rating,r.comment,r.created_at,u.name FROM reviews r JOIN "user" u ON u.id=r.user_id JOIN bookings b ON b.id=r.booking_id WHERE r.hotel_id=? AND r.hidden=0 AND b.hotel_id=r.hotel_id AND ${eligible} ORDER BY r.created_at DESC,r.id LIMIT 20 OFFSET ?`,
    match[1],
    offset,
  );
  return json({
    ...aggregate,
    reviews: records.map(({ name, ...r }) => ({
      ...r,
      author: text(name).split(/\s+/)[0] || "Traveler",
    })),
    next_offset:
      offset + records.length < aggregate.count
        ? offset + records.length
        : null,
  });
}

export async function travelerFeatures(request, env, url, user) {
  const database = db(env);
  if (url.pathname === "/v1/me/saved-hotels" && request.method === "GET") {
    const rows = await all(
      database,
      "SELECT h.id,h.name,h.city,h.images FROM saved_hotels s JOIN hotels h ON h.id=s.hotel_id WHERE s.user_id=? ORDER BY s.created_at DESC,h.id",
      user.id,
    );
    return json(
      rows.map((row) => ({ ...row, images: decodeList(row.images) })),
    );
  }
  const saved = url.pathname.match(/^\/v1\/me\/saved-hotels\/([^/]+)$/);
  if (saved && ["POST", "DELETE"].includes(request.method)) {
    if (request.method === "POST") {
      if (
        !(await first(database, "SELECT id FROM hotels WHERE id=?", saved[1]))
      )
        reject("Hotel not found.", 404);
      await run(
        database,
        "INSERT INTO saved_hotels(user_id,hotel_id) VALUES(?,?) ON CONFLICT(user_id,hotel_id) DO NOTHING",
        user.id,
        saved[1],
      );
    } else
      await run(
        database,
        "DELETE FROM saved_hotels WHERE user_id=? AND hotel_id=?",
        user.id,
        saved[1],
      );
    return json({ ok: true });
  }
  if (url.pathname === "/v1/me/reviews" && request.method === "GET") {
    return json(
      await all(
        database,
        `SELECT b.id AS booking_id,b.reference,b.hotel_id,b.check_in_date,b.check_out_date,b.booking_status,h.name AS hotel_name,r.id AS review_id,r.rating,r.comment,r.hidden FROM bookings b JOIN hotels h ON h.id=b.hotel_id LEFT JOIN reviews r ON r.booking_id=b.id WHERE b.user_id=? AND ${eligible} ORDER BY b.check_in_date DESC`,
        user.id,
      ),
    );
  }
  const match = url.pathname.match(/^\/v1\/bookings\/([^/]+)\/review$/);
  if (!match || request.method !== "POST") return null;
  const booking = await first(
    database,
    `SELECT b.id,b.hotel_id FROM bookings b WHERE b.id=? AND b.user_id=? AND ${eligible}`,
    match[1],
    user.id,
  );
  if (!booking)
    reject("Reviews require your own paid, confirmed or completed stay.", 403);
  const body = await requestBody(request);
  const comment = text(body.comment);
  if (
    !Number.isInteger(body.rating) ||
    body.rating < 1 ||
    body.rating > 5 ||
    [...comment].length < 10 ||
    comment.includes("\0") ||
    comment.length > 1000
  )
    reject("Choose 1–5 stars and write 10–1,000 characters.");
  // Editing a hidden review cannot evade moderation. One review per saved booking.
  const result = await run(
    database,
    `INSERT INTO reviews(id,booking_id,user_id,hotel_id,rating,comment)
     SELECT ?,b.id,b.user_id,b.hotel_id,?,? FROM bookings b WHERE b.id=? AND b.user_id=? AND ${eligible}
     ON CONFLICT(booking_id) DO UPDATE SET hotel_id=excluded.hotel_id,rating=excluded.rating,comment=excluded.comment,updated_at=CURRENT_TIMESTAMP`,
    crypto.randomUUID(),
    body.rating,
    comment,
    booking.id,
    user.id,
  );
  if (!result.meta.changes)
    reject("This stay is no longer eligible for a review.", 409);
  return json({ ok: true });
}

export async function dashboard(env) {
  const database = db(env);
  const day = today();
  const summary = await first(
    database,
    `SELECT
    (SELECT COUNT(*) FROM hotels) AS hotels,
    (SELECT COALESCE(SUM(total_units),0) FROM rooms) AS rooms,
    (SELECT COUNT(*) FROM "user") AS travelers,
    (SELECT COUNT(*) FROM bookings) AS bookings,
    (SELECT COUNT(*) FROM bookings WHERE payment_status IN ('paid','partially_refunded') AND booking_status IN ('confirmed','checked_in')) AS active_stays,
    (SELECT COUNT(*) FROM bookings WHERE hotel_ack_status='pending' AND booking_status='confirmed') AS awaiting_acknowledgement,
    (SELECT COUNT(*) FROM bookings WHERE hotel_ack_status='pending' AND booking_status='confirmed' AND datetime(hotel_ack_due_at)<=datetime('now')) AS overdue_acknowledgements,
    (SELECT COUNT(*) FROM booking_exceptions WHERE status='open') AS open_exceptions,
    (SELECT COUNT(*) FROM refunds WHERE status NOT IN ('completed','rejected')) AS pending_refunds,
    (SELECT COALESCE(SUM(amount_cents),0) FROM payments WHERE status='succeeded' AND currency='USD') AS received_cents,
    (SELECT COALESCE(SUM(amount_cents),0) FROM refunds WHERE status='completed' AND currency='USD') AS refunded_cents,
    (SELECT COALESCE(SUM(amount_cents),0) FROM hotel_payouts WHERE status='paid') AS paid_out_cents,
    (SELECT COUNT(*) FROM reviews r JOIN bookings b ON b.id=r.booking_id WHERE r.hidden=0 AND r.hotel_id=b.hotel_id AND ${eligible}) AS published_reviews`,
  );
  const days = await all(
    database,
    `SELECT id,reference,check_in_date,check_out_date,booking_status,hotel_ack_status,hotel_ack_due_at,hotel_snapshot FROM bookings WHERE payment_status IN ('paid','partially_refunded') AND booking_status IN ('confirmed','checked_in') AND (check_in_date=? OR check_out_date=?) ORDER BY check_in_date,id`,
    day,
    day,
  );
  return {
    day,
    currency: "USD",
    ...summary,
    net_received_cents: summary.received_cents - summary.refunded_cents,
    arrivals: days.filter((b) => b.check_in_date === day),
    departures: days.filter((b) => b.check_out_date === day),
  };
}

export async function adminFeatures(request, env, url, admin) {
  const database = db(env);
  if (request.method === "GET" && url.pathname === "/v1/admin/dashboard")
    return json(await dashboard(env));
  if (url.pathname === "/v1/admin/reviews" && request.method === "GET")
    return json(
      await all(
        database,
        "SELECT r.*,h.name AS hotel_name,b.reference FROM reviews r JOIN hotels h ON h.id=r.hotel_id JOIN bookings b ON b.id=r.booking_id ORDER BY r.created_at DESC LIMIT 500",
      ),
    );
  const review = url.pathname.match(/^\/v1\/admin\/reviews\/([^/]+)$/);
  if (review && request.method === "PATCH") {
    const body = await requestBody(request);
    if (
      typeof body.hidden !== "boolean" ||
      text(body.note).length < 3 ||
      text(body.note).length > 1000
    )
      reject("Select visibility and add a moderation reason.");
    const result = await run(
      database,
      "UPDATE reviews SET hidden=?,moderation_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      Number(body.hidden),
      text(body.note),
      review[1],
    );
    if (!result.meta.changes) reject("Review not found.", 404);
    return json({ ok: true });
  }
  if (url.pathname === "/v1/admin/partners" && request.method === "GET")
    return json(
      await all(
        database,
        `SELECT m.*,h.name AS hotel_name,u.id AS user_id,u.name,u.emailVerified FROM partner_memberships m JOIN hotels h ON h.id=m.hotel_id LEFT JOIN partner_user u ON u.email=m.email COLLATE NOCASE ORDER BY m.email,h.name`,
      ),
    );
  if (url.pathname === "/v1/admin/partners" && request.method === "POST") {
    const body = await requestBody(request);
    const email = text(body.email).toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      !(await first(
        database,
        "SELECT id FROM hotels WHERE id=?",
        text(body.hotel_id),
      ))
    )
      reject("Choose a hotel and a valid partner email.");
    const id = crypto.randomUUID();
    await run(
      database,
      "INSERT INTO partner_memberships(id,email,hotel_id,created_by) VALUES(?,?,?,?) ON CONFLICT(email,hotel_id) DO UPDATE SET active=1",
      id,
      email,
      body.hotel_id,
      admin.id,
    );
    // Invitation remains available if email fails; the admin can resend it explicitly.
    let email_sent = true;
    try {
      await sendAuthEmail(
        env,
        email,
        "Your Hoysii hotel portal invitation",
        `You have been assigned a hotel in Hoysii. Open ${env.PARTNER_PANEL_URL || "https://partners.hoysii.com"} and create a hotel partner account with ${email}. Choose your own password and verify your email. Traveler and admin accounts are separate.`,
      );
    } catch {
      email_sent = false;
    }
    return json({ ok: true, email_sent }, { status: 201 });
  }
  const member = url.pathname.match(/^\/v1\/admin\/partners\/([^/]+)$/);
  if (member && request.method === "PATCH") {
    const body = await requestBody(request);
    if (typeof body.active !== "boolean")
      reject("Specify whether access is active.");
    const row = await first(
      database,
      "SELECT email FROM partner_memberships WHERE id=?",
      member[1],
    );
    if (!row) reject("Assignment not found.", 404);
    await database.batch([
      database
        .prepare("UPDATE partner_memberships SET active=? WHERE id=?")
        .bind(Number(body.active), member[1]),
      // Revoke current sessions when permissions change, even if other hotels remain assigned.
      database
        .prepare(
          "DELETE FROM partner_session WHERE userId IN (SELECT id FROM partner_user WHERE email=? COLLATE NOCASE)",
        )
        .bind(row.email),
    ]);
    return json({ ok: true });
  }
  if (url.pathname === "/v1/admin/payouts" && request.method === "GET")
    return json(
      await all(
        database,
        "SELECT p.*,h.name AS hotel_name FROM hotel_payouts p JOIN hotels h ON h.id=p.hotel_id ORDER BY p.created_at DESC LIMIT 500",
      ),
    );
  if (url.pathname === "/v1/admin/payouts" && request.method === "POST") {
    const body = await requestBody(request);
    const amount = Math.round(Number(body.amount) * 100);
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      !validPeriod(body.period_start, body.period_end) ||
      text(body.note).length < 3 ||
      text(body.note).length > 1000 ||
      !(await first(
        database,
        "SELECT id FROM hotels WHERE id=?",
        text(body.hotel_id),
      ))
    )
      reject("Choose a hotel, positive USD amount, valid period and note.");
    const id = crypto.randomUUID();
    await run(
      database,
      "INSERT INTO hotel_payouts(id,hotel_id,amount_cents,status,period_start,period_end,note,recorded_by) VALUES(?,?,?,'scheduled',?,?,?,?)",
      id,
      body.hotel_id,
      amount,
      body.period_start,
      body.period_end,
      text(body.note),
      admin.id,
    );
    return json({ id }, { status: 201 });
  }
  const payout = url.pathname.match(/^\/v1\/admin\/payouts\/([^/]+)$/);
  if (payout && request.method === "PATCH") {
    const body = await requestBody(request);
    if (
      !["paid", "cancelled"].includes(body.status) ||
      text(body.note).length < 3 ||
      text(body.note).length > 1000 ||
      (body.status === "paid" &&
        (text(body.reference).length < 3 || text(body.reference).length > 150))
    )
      reject(
        "Record a status, note and transaction reference for paid payouts.",
      );
    const result = await run(
      database,
      "UPDATE hotel_payouts SET status=?,reference=?,note=?,recorded_by=?,paid_at=CASE WHEN ?='paid' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=? AND status='scheduled'",
      body.status,
      body.status === "paid" ? text(body.reference) : null,
      text(body.note),
      admin.id,
      body.status,
      payout[1],
    );
    if (!result.meta.changes)
      reject("Payout not found or already finalized.", 409);
    return json({ ok: true });
  }
  return null;
}

async function membership(database, email, hotelId) {
  if (
    !(await first(
      database,
      "SELECT id FROM partner_memberships WHERE email=? COLLATE NOCASE AND hotel_id=? AND active=1",
      email,
      hotelId,
    ))
  )
    reject("Hotel not found or access denied.", 404);
}
const partnerBookingFields = `b.id,b.reference,b.hotel_id,b.room_id,b.check_in_date,b.check_out_date,b.guests,b.adults,b.children,b.booking_status,b.hotel_ack_status,b.hotel_ack_due_at,b.hotel_ack_at,b.checked_in_at,b.completed_at,r.name AS room_name,COALESCE(p.full_name,u.name) AS guest_name`;

export async function partnerRoutes(request, env, url, uploadMedia) {
  if (!url.pathname.startsWith("/v1/partner/")) return null;
  if (!env.PARTNER_AUTH_SECRET)
    reject("Hotel portal sign in is not configured yet.", 503);
  const database = db(env);
  const session = await createPartnerAuth(env).api.getSession({
    headers: request.headers,
  });
  if (!session?.user?.emailVerified)
    reject("Partner sign in is required.", 401);
  const user = session.user;
  if (
    !(await first(
      database,
      "SELECT id FROM partner_memberships WHERE email=? COLLATE NOCASE AND active=1 LIMIT 1",
      user.email,
    ))
  )
    reject("Hotel access is not active.", 403);
  if (
    (request.headers.get("origin") &&
      !partnerOrigins(env).includes(request.headers.get("origin"))) ||
    (!request.headers.get("origin") &&
      !["GET", "HEAD"].includes(request.method))
  )
    reject("A trusted hotel portal origin is required.", 403);
  if (url.pathname === "/v1/partner/me" && request.method === "GET")
    return json({ user: { id: user.id, name: user.name, email: user.email } });
  if (url.pathname === "/v1/partner/hotels" && request.method === "GET")
    return json(
      await all(
        database,
        "SELECT h.id,h.name,h.city FROM hotels h JOIN partner_memberships m ON m.hotel_id=h.id WHERE m.email=? COLLATE NOCASE AND m.active=1 ORDER BY h.name",
        user.email,
      ),
    );
  if (url.pathname === "/v1/partner/media" && request.method === "POST")
    return uploadMedia(request, env, url);
  const hotel = url.pathname.match(
    /^\/v1\/partner\/hotels\/([^/]+)(?:\/(reservations|rooms|payouts))?$/,
  );
  if (hotel) {
    const id = hotel[1];
    await membership(database, user.email, id);
    if (hotel[2] === "reservations" && request.method === "GET")
      return json(
        await all(
          database,
          `SELECT ${partnerBookingFields} FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN "user" u ON u.id=b.user_id LEFT JOIN profiles p ON p.user_id=u.id WHERE b.hotel_id=? AND b.payment_status IN ('paid','partially_refunded') ORDER BY b.check_in_date DESC`,
          id,
        ),
      );
    if (hotel[2] === "payouts" && request.method === "GET")
      return json(
        await all(
          database,
          "SELECT id,amount_cents,currency,status,period_start,period_end,reference,created_at,paid_at FROM hotel_payouts WHERE hotel_id=? ORDER BY created_at DESC",
          id,
        ),
      );
    if (!hotel[2] && request.method === "GET") {
      const property = await first(
        database,
        "SELECT id,name,city,description,address,images,amenities,manager_name,manager_email,manager_phone,check_in_time,check_out_time FROM hotels WHERE id=?",
        id,
      );
      for (const key of ["address", "images", "amenities"])
        property[key] = decodeList(property[key]);
      const rooms = await all(
        database,
        "SELECT * FROM rooms WHERE hotel_id=? ORDER BY name",
        id,
      );
      return json({
        hotel: property,
        rooms: rooms.map((r) => ({
          ...r,
          images: decodeList(r.images),
          amenities: decodeList(r.amenities),
          price: r.price_cents / 100,
        })),
      });
    }
    if (!hotel[2] && request.method === "PATCH") {
      const body = await requestBody(request);
      const current = await first(
        database,
        "SELECT * FROM hotels WHERE id=?",
        id,
      );
      const fields = [
        "name",
        "description",
        "manager_name",
        "manager_email",
        "manager_phone",
        "check_in_time",
        "check_out_time",
      ];
      const values = fields.map((key) =>
        body[key] === undefined ? current[key] : text(body[key]),
      );
      if (
        !values[0] ||
        values[0].length > 120 ||
        (values[1] || "").length > 5000 ||
        values.slice(2, 5).some((v) => (v || "").length > 254) ||
        (values[3] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[3])) ||
        values.slice(5).some((v) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
      )
        reject("Enter valid property details and 24-hour check-in/out times.");
      const lists = ["address", "images", "amenities"].map((key) =>
        body[key] === undefined ? decodeList(current[key]) : body[key],
      );
      if (
        lists.some(
          (v) =>
            !Array.isArray(v) ||
            v.length > 30 ||
            v.some((s) => typeof s !== "string" || s.length > 2048),
        ) ||
        lists[1].some((s) => !/^https:\/\//.test(s))
      )
        reject("Use valid property lists and photos uploaded to Hoysii.");
      await run(
        database,
        `UPDATE hotels SET ${fields.map((f) => `${f}=?`).join(",")},address=?,images=?,amenities=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        ...values,
        ...lists.map((v) => JSON.stringify(v)),
        id,
      );
      return json({ ok: true });
    }
    if (hotel[2] === "rooms" && request.method === "POST") {
      const body = await requestBody(request);
      const values = roomInput(body);
      const roomId = crypto.randomUUID();
      await run(
        database,
        "INSERT INTO rooms(id,hotel_id,name,price_cents,total_units,capacity_adults,bed_size,amenities,images) VALUES(?,?,?,?,?,?,?,?,?)",
        roomId,
        id,
        ...values,
      );
      return json({ id: roomId }, { status: 201 });
    }
  }
  const room = url.pathname.match(
    /^\/v1\/partner\/rooms\/([^/]+)(?:\/(blocks|calendar))?$/,
  );
  if (room) {
    const record = await first(
      database,
      "SELECT * FROM rooms WHERE id=?",
      room[1],
    );
    if (!record) reject("Room not found.", 404);
    await membership(database, user.email, record.hotel_id);
    if (room[2] === "calendar" && request.method === "GET") {
      const from = url.searchParams.get("from") || today();
      if (!validDate(from)) reject("Choose a valid calendar start date.");
      const to = url.searchParams.get("to") || addDays(from, 30);
      if (
        !validRange(from, to) ||
        (Date.parse(to) - Date.parse(from)) / 86400000 > 62
      )
        reject("Choose a valid period up to 62 days.");
      const days = await all(
        database,
        `WITH RECURSIVE nights(day) AS (SELECT ? UNION ALL SELECT date(day,'+1 day') FROM nights WHERE day<date(?,'-1 day'))
        SELECT day,? - (SELECT COUNT(*) FROM bookings b WHERE b.room_id=? AND b.check_in_date<=day AND b.check_out_date>day AND ${ACTIVE_BOOKING_FILTER}) - (SELECT COALESCE(SUM(i.units),0) FROM inventory_blocks i WHERE i.room_id=? AND i.start_date<=day AND i.end_date>day) AS available FROM nights`,
        from,
        to,
        record.total_units,
        record.id,
        record.id,
      );
      return json(days);
    }
    if (!room[2] && request.method === "PATCH") {
      const body = await requestBody(request);
      const values = roomInput({
        ...record,
        price: record.price_cents / 100,
        images: decodeList(record.images),
        amenities: decodeList(record.amenities),
        ...body,
      });
      await run(
        database,
        "UPDATE rooms SET name=?,price_cents=?,total_units=?,capacity_adults=?,bed_size=?,amenities=?,images=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ...values,
        record.id,
      );
      return json({ ok: true });
    }
    if (!room[2] && request.method === "DELETE") {
      if (
        await first(
          database,
          "SELECT id FROM bookings WHERE room_id=? UNION SELECT id FROM legacy_bookings WHERE room_id=? LIMIT 1",
          record.id,
          record.id,
        )
      )
        reject(
          "A room with booking history cannot be deleted. Close unavailable dates instead.",
          409,
        );
      await run(database, "DELETE FROM rooms WHERE id=?", record.id);
      return json({ ok: true });
    }
    if (room[2] === "blocks" && ["GET", "POST"].includes(request.method)) {
      const mapped = new URL(url);
      mapped.pathname = `/v1/admin/rooms/${record.id}/blocks`;
      return adminOperations(request, env, mapped, {
        id: `partner:${user.id}`,
      });
    }
  }
  const block = url.pathname.match(
    /^\/v1\/partner\/inventory-blocks\/([^/]+)$/,
  );
  if (block && request.method === "DELETE") {
    const record = await first(
      database,
      "SELECT r.hotel_id FROM inventory_blocks i JOIN rooms r ON r.id=i.room_id WHERE i.id=?",
      block[1],
    );
    if (!record) reject("Inventory block not found.", 404);
    await membership(database, user.email, record.hotel_id);
    await run(database, "DELETE FROM inventory_blocks WHERE id=?", block[1]);
    return json({ ok: true });
  }
  const booking = url.pathname.match(
    /^\/v1\/partner\/bookings\/([^/]+)\/(acknowledgement|stay)$/,
  );
  if (booking && request.method === "POST") {
    const record = await first(
      database,
      "SELECT hotel_id FROM bookings WHERE id=?",
      booking[1],
    );
    if (!record) reject("Reservation not found.", 404);
    await membership(database, user.email, record.hotel_id);
    const mapped = new URL(url);
    mapped.pathname = `/v1/admin/bookings/${booking[1]}/${booking[2]}`;
    await adminOperations(request, env, mapped, {
      id: `partner:${user.id}`,
      partnerEmail: user.email,
    });
    // Do not return the admin detail: it includes internal notes, payments and exceptions.
    return json({ ok: true });
  }
  return json({ error: "Partner route not found." }, { status: 404 });
}

function roomInput(body) {
  const name = text(body.name);
  const rate = Math.round(Number(body.price) * 100);
  const units = Number(body.total_units);
  const guests = Number(body.capacity_adults);
  const images = body.images || [];
  const amenities = body.amenities || [];
  if (
    !name ||
    name.length > 120 ||
    !Number.isSafeInteger(rate) ||
    rate <= 0 ||
    !Number.isInteger(units) ||
    units < 1 ||
    units > 10000 ||
    !Number.isInteger(guests) ||
    guests < 1 ||
    guests > 20 ||
    !Array.isArray(images) ||
    images.length > 30 ||
    images.some(
      (s) => typeof s !== "string" || !/^https:\/\//.test(s) || s.length > 2048,
    ) ||
    !Array.isArray(amenities) ||
    amenities.length > 30 ||
    amenities.some((s) => typeof s !== "string" || s.length > 120) ||
    text(body.bed_size).length > 120
  )
    reject("Enter valid room details, rate, units and guest capacity.");
  return [
    name,
    rate,
    units,
    guests,
    text(body.bed_size) || null,
    JSON.stringify(amenities),
    JSON.stringify(images),
  ];
}

function validPeriod(start, end) {
  return validDate(start) && validDate(end) && start <= end;
}

async function requestBody(request) {
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body))
    reject("Send a JSON object.");
  return body;
}
