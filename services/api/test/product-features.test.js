import test from "node:test";
import assert from "node:assert/strict";
import { localD1 } from "./support/d1.js";
import { createAdminAuth, createAuth, createPartnerAuth } from "../src/auth.js";
import { createBooking, today } from "../src/booking-service.js";
import { settlePayment } from "../src/operations.js";
import { addDays } from "../src/availability.js";
import worker from "../src/index.js";

async function fixture() {
  const DB = localD1();
  const sent = [];
  const env = {
    DB,
    BETTER_AUTH_URL: "https://api.hoysii.com",
    BETTER_AUTH_SECRET: "independent-traveler-secret-for-testing-123",
    ADMIN_AUTH_SECRET: "independent-admin-secret-for-testing-123456",
    PARTNER_AUTH_SECRET: "independent-hotel-partner-secret-testing-123",
    ADMIN_EMAIL: "admin@example.com",
    PARTNER_PANEL_URL: "https://partners.hoysii.com",
    TRUSTED_ORIGINS: "https://hoysii.com,https://admin.hoysii.com",
    SEND_EMAIL: {
      async send(message) {
        sent.push(message);
      },
    },
  };
  await DB.exec(`INSERT INTO hotels(id,name,city,manager_email,images) VALUES('a','Hotel A','Mogadishu','a@example.com','[]'),('b','Hotel B','Garowe','b@example.com','[]');
    INSERT INTO rooms(id,hotel_id,name,price_cents,total_units,capacity_adults) VALUES('a-room','a','Double',5000,2,2),('b-room','b','Suite',6000,1,2);
    INSERT INTO partner_memberships(id,email,hotel_id,created_by) VALUES('assigned-a','partner@example.com','a','admin');`);
  async function api(
    path,
    {
      cookie,
      origin = /^\/(v1\/admin|api\/admin-auth)\//.test(path)
        ? "https://admin.hoysii.com"
        : /^\/(v1\/partner|api\/partner-auth)\//.test(path)
          ? "https://partners.hoysii.com"
          : "https://hoysii.com",
      method = "GET",
      body,
    } = {},
  ) {
    const response = await worker.fetch(
      new Request(`https://api.hoysii.com${path}`, {
        method,
        headers: {
          origin,
          ...(cookie ? { cookie } : {}),
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      env,
    );
    const data = await response.json();
    return { status: response.status, data, response };
  }
  async function identity(kind, email) {
    const creator =
      kind === "partner"
        ? createPartnerAuth
        : kind === "admin"
          ? createAdminAuth
          : createAuth;
    const auth = creator(env);
    const base =
      kind === "partner"
        ? "/api/partner-auth"
        : kind === "admin"
          ? "/api/admin-auth"
          : "/api/auth";
    const origin =
      kind === "partner"
        ? env.PARTNER_PANEL_URL
        : kind === "admin"
          ? "https://admin.hoysii.com"
          : "https://hoysii.com";
    const post = async (path, body) =>
      auth.handler(
        new Request(`${env.BETTER_AUTH_URL}${base}${path}`, {
          method: "POST",
          headers: { origin, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    const signup = await post("/sign-up/email", {
      email,
      name: `${kind} Name`,
      password: "SecurePassword123!",
    });
    assert.equal(signup.status, 200, await signup.text());
    const table =
      kind === "partner"
        ? "partner_user"
        : kind === "admin"
          ? "admin_user"
          : "user";
    await DB.prepare(`UPDATE "${table}" SET emailVerified=1 WHERE email=?`)
      .bind(email)
      .run();
    const response = await post("/sign-in/email", {
      email,
      password: "SecurePassword123!",
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    return {
      cookie: response.headers
        .getSetCookie()
        .map((s) => s.split(";")[0])
        .join("; "),
      user: data.user,
    };
  }
  const book = async (user, room = "a-room") =>
    createBooking(
      env,
      user,
      {
        room_id: room,
        check_in_date: addDays(today(), 10),
        check_out_date: addDays(today(), 12),
        adults: 1,
        children: 0,
        payment_provider: "waafi",
      },
      crypto.randomUUID(),
    );
  const pay = async (booking) =>
    settlePayment(env, booking.id, {
      provider: "manual",
      reference: crypto.randomUUID(),
      amount_cents: Math.round(booking.total_price * 100),
      currency: "USD",
      source: "manual",
      actor: "admin",
      note: "Verified funds received",
    });
  return { DB, env, sent, api, identity, book, pay };
}

test("partner signup requires an invitation and OTP, with independent accounts and origins", async () => {
  const f = await fixture();
  try {
    let response = await f.api("/api/partner-auth/sign-up/email", {
      method: "POST",
      body: {
        name: "Stranger",
        email: "stranger@example.com",
        password: "SecurePassword123!",
      },
    });
    // Better Auth deliberately returns a generic success for rejected signup to prevent account enumeration.
    assert.ok([200, 403].includes(response.status));
    assert.equal(
      (
        await f.DB.prepare(
          "SELECT COUNT(*) n FROM partner_user WHERE email='stranger@example.com'",
        ).first()
      ).n,
      0,
    );
    response = await f.api("/api/partner-auth/sign-up/email", {
      method: "POST",
      body: {
        name: "Manager",
        email: "partner@example.com",
        password: "SecurePassword123!",
      },
    });
    assert.equal(response.status, 200);
    response = await f.api("/api/partner-auth/sign-in/email", {
      method: "POST",
      body: { email: "partner@example.com", password: "SecurePassword123!" },
    });
    assert.equal(response.status, 403);
    assert.equal(response.data.code, "EMAIL_NOT_VERIFIED");
    assert.match(f.sent[0].subject, /hotel portal/);
    const otp = f.sent[0].text.match(/\b\d{6}\b/)[0];
    response = await f.api("/api/partner-auth/email-otp/verify-email", {
      method: "POST",
      body: { email: "partner@example.com", otp },
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    const cookie = response.response.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; ");
    assert.match(cookie, /hoysii-partner/);
    assert.equal((await f.api("/v1/partner/hotels", { cookie })).status, 200);
    assert.equal((await f.api("/v1/me", { cookie })).status, 401);
    assert.equal((await f.api("/v1/admin/dashboard", { cookie })).status, 401);
    assert.equal(
      (await f.DB.prepare('SELECT COUNT(*) n FROM "user"').first()).n,
      0,
    );
    assert.equal(
      (await f.DB.prepare("SELECT COUNT(*) n FROM admin_user").first()).n,
      0,
    );
    response = await f.api("/api/partner-auth/sign-in/email", {
      method: "POST",
      origin: "https://partners.hoysii.com.attacker.example",
      body: { email: "partner@example.com", password: "SecurePassword123!" },
    });
    assert.equal(response.status, 403);
    assert.equal(
      response.response.headers.get("access-control-allow-origin"),
      null,
    );
  } finally {
    f.DB.close();
  }
});

test("partner permissions cover every hotel resource, prevent admin access and revoke immediately", async () => {
  const f = await fixture();
  try {
    const partner = await f.identity("partner", "partner@example.com");
    const traveler = await f.identity("traveler", "traveler@example.com");
    const admin = await f.identity("admin", f.env.ADMIN_EMAIL);
    const own = await f.book(traveler.user),
      other = await f.book(traveler.user, "b-room");
    await f.pay(own);
    await f.pay(other);
    const list = await f.api("/v1/partner/hotels", { cookie: partner.cookie });
    assert.deepEqual(
      list.data.map((h) => h.id),
      ["a"],
    );
    const reservations = await f.api("/v1/partner/hotels/a/reservations", {
      cookie: partner.cookie,
    });
    assert.equal(reservations.data.length, 1);
    for (const key of [
      "payment_status",
      "total_cents",
      "guest_email",
      "transaction_reference",
      "policy_snapshot",
    ])
      assert.equal(Object.hasOwn(reservations.data[0], key), false);
    for (const [path, method, body] of [
      ["/v1/partner/hotels/b", "GET"],
      ["/v1/partner/hotels/b", "PATCH", { name: "Hacked" }],
      ["/v1/partner/hotels/b/reservations", "GET"],
      ["/v1/partner/hotels/b/payouts", "GET"],
      ["/v1/partner/hotels/b/rooms", "POST", {}],
      ["/v1/partner/rooms/b-room", "PATCH", { price: 1 }],
      ["/v1/partner/rooms/b-room", "DELETE"],
      ["/v1/partner/rooms/b-room/blocks", "POST", {}],
      ["/v1/partner/rooms/b-room/calendar", "GET"],
      [
        `/v1/partner/bookings/${other.id}/acknowledgement`,
        "POST",
        { status: "declined", note: "Other hotel" },
      ],
    ])
      assert.equal(
        (await f.api(path, { cookie: partner.cookie, method, body })).status,
        404,
        path,
      );
    assert.equal(
      (await f.api("/v1/admin/hotels", { cookie: partner.cookie })).status,
      401,
    );
    assert.equal(
      (await f.api("/v1/partner/hotels", { cookie: traveler.cookie })).status,
      401,
    );
    assert.equal(
      (await f.api("/v1/partner/hotels", { cookie: admin.cookie })).status,
      401,
    );
    assert.equal(
      (
        await f.api("/v1/partner/hotels/a", {
          cookie: partner.cookie,
          method: "PATCH",
          origin: "https://hoysii.com",
          body: { name: "Hacked" },
        })
      ).status,
      403,
    );
    let response = await f.api("/v1/partner/hotels/a", {
      cookie: partner.cookie,
      method: "PATCH",
      body: { name: "Hotel A edited", is_verified: true, rating: 5 },
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.equal(
      (
        await f.DB.prepare(
          "SELECT is_verified FROM hotels WHERE id='a'",
        ).first()
      ).is_verified,
      0,
    );
    response = await f.api(`/v1/partner/bookings/${own.id}/acknowledgement`, {
      cookie: partner.cookie,
      method: "POST",
      body: {
        status: "declined",
        note: "Unable to fulfill, please arrange replacement",
      },
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.deepEqual(response.data, { ok: true });
    const b = await f.DB.prepare(
      "SELECT booking_status,hotel_ack_status FROM bookings WHERE id=?",
    )
      .bind(own.id)
      .first();
    assert.deepEqual(
      { ...b },
      { booking_status: "confirmed", hotel_ack_status: "declined" },
    );
    assert.equal(
      (
        await f.DB.prepare(
          "SELECT COUNT(*) n FROM booking_exceptions WHERE kind='hotel_declined'",
        ).first()
      ).n,
      1,
    );
    response = await f.api("/v1/admin/partners/assigned-a", {
      cookie: admin.cookie,
      origin: "https://admin.hoysii.com",
      method: "PATCH",
      body: { active: false },
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await f.api("/v1/partner/hotels", { cookie: partner.cookie })).status,
      401,
    );
  } finally {
    f.DB.close();
  }
});

test("partner inventory edits retain overselling constraints and checkout-night semantics", async () => {
  const f = await fixture();
  try {
    const p = await f.identity("partner", "partner@example.com"),
      u = await f.identity("traveler", "traveler@example.com");
    const b = await f.book(u.user);
    await f.pay(b);
    const options = {
      cookie: p.cookie,
      method: "POST",
      body: {
        start_date: addDays(today(), 10),
        end_date: addDays(today(), 12),
        units: 1,
        reason: "Outside reservation",
      },
    };
    let result = await f.api("/v1/partner/rooms/a-room/blocks", options);
    assert.equal(result.status, 201);
    const blockId = result.data.id;
    result = await f.api(
      "/v1/partner/rooms/a-room/calendar?from=" +
        addDays(today(), 10) +
        "&to=" +
        addDays(today(), 13),
      { cookie: p.cookie },
    );
    assert.deepEqual(
      result.data.map((d) => d.available),
      [0, 0, 2],
    );
    assert.equal(
      (
        await f.api("/v1/partner/rooms/a-room", {
          cookie: p.cookie,
          method: "PATCH",
          body: { total_units: 1 },
        })
      ).status,
      409,
    );
    assert.equal(
      (await f.api("/v1/partner/rooms/a-room/blocks", options)).status,
      409,
    );
    const otherPartnerEmail = "other-partner@example.com";
    await f.DB.prepare(
      "INSERT INTO partner_memberships(id,email,hotel_id,created_by) VALUES('assigned-b',?,'b','admin')",
    )
      .bind(otherPartnerEmail)
      .run();
    const other = await f.identity("partner", otherPartnerEmail);
    assert.equal(
      (
        await f.api(`/v1/partner/inventory-blocks/${blockId}`, {
          cookie: other.cookie,
          method: "DELETE",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await f.api("/v1/partner/rooms/a-room", {
          cookie: p.cookie,
          method: "DELETE",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.api(`/v1/partner/inventory-blocks/${blockId}`, {
          cookie: p.cookie,
          method: "DELETE",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.api("/v1/partner/rooms/a-room", {
          cookie: p.cookie,
          method: "PATCH",
          body: { price: 70 },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.DB.prepare("SELECT nightly_cents FROM bookings WHERE id=?")
          .bind(b.id)
          .first()
      ).nightly_cents,
      5000,
    );
  } finally {
    f.DB.close();
  }
});

test("reviews require owned paid stays, remain unique, hide safely and expose no private identity", async () => {
  const f = await fixture();
  try {
    const user = await f.identity("traveler", "traveler@example.com"),
      other = await f.identity("traveler", "other@example.com"),
      admin = await f.identity("admin", f.env.ADMIN_EMAIL);
    const b = await f.book(user.user);
    const path = `/v1/bookings/${b.id}/review`;
    const body = { rating: 4, comment: "A comfortable and pleasant stay." };
    assert.equal(
      (await f.api(path, { cookie: user.cookie, method: "POST", body })).status,
      403,
    );
    await f.pay(b);
    assert.equal(
      (await f.api(path, { cookie: other.cookie, method: "POST", body }))
        .status,
      403,
    );
    assert.equal(
      (
        await f.api("/v1/bookings/preview-123/review", {
          cookie: user.cookie,
          method: "POST",
          body,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.api(path, {
          cookie: user.cookie,
          method: "POST",
          body: { ...body, rating: 6 },
        })
      ).status,
      400,
    );
    assert.equal(
      (await f.api(path, { cookie: user.cookie, method: "POST", body })).status,
      200,
    );
    assert.equal(
      (
        await f.api(path, {
          cookie: user.cookie,
          method: "POST",
          body: { ...body, rating: 5 },
        })
      ).status,
      200,
    );
    let publicData = (await f.api("/v1/hotels/a/reviews")).data;
    assert.equal(publicData.count, 1);
    assert.equal(publicData.average, 5);
    assert.equal(publicData.reviews[0].author, "traveler");
    assert.deepEqual(
      Object.keys(publicData.reviews[0]).sort(),
      ["id", "rating", "comment", "created_at", "author"].sort(),
    );
    const id = publicData.reviews[0].id;
    assert.equal(
      (
        await f.api(`/v1/admin/reviews/${id}`, {
          cookie: admin.cookie,
          origin: "https://admin.hoysii.com",
          method: "PATCH",
          body: { hidden: true, note: "Review under moderation" },
        })
      ).status,
      200,
    );
    assert.equal((await f.api("/v1/hotels/a/reviews")).data.count, 0);
    await f.api(path, { cookie: user.cookie, method: "POST", body });
    assert.equal((await f.api("/v1/hotels/a/reviews")).data.count, 0);
    assert.equal(
      (await f.api("/v1/me/reviews", { cookie: other.cookie })).data.length,
      0,
    );
    assert.equal(
      (await f.api("/v1/me/reviews", { cookie: user.cookie })).data[0]
        .booking_id,
      b.id,
    );
  } finally {
    f.DB.close();
  }
});

test("dashboard counts actual ledger entries and partner payout view excludes admin notes", async () => {
  const f = await fixture();
  try {
    const u = await f.identity("traveler", "traveler@example.com"),
      a = await f.identity("admin", f.env.ADMIN_EMAIL),
      p = await f.identity("partner", "partner@example.com");
    const paid = await f.book(u.user);
    await f.pay(paid);
    await f.book(u.user, "b-room");
    let result = await f.api("/v1/admin/dashboard", { cookie: a.cookie });
    assert.equal(result.status, 200);
    assert.equal(result.data.received_cents, 11000);
    assert.equal(result.data.net_received_cents, 11000);
    assert.equal(result.data.bookings, 2);
    await f.DB.prepare(
      "INSERT INTO refunds(id,booking_id,amount_cents,currency,status,reason) VALUES('refund',?,1000,'USD','completed','Manual refund')",
    )
      .bind(paid.id)
      .run();
    const options = {
      cookie: a.cookie,
      origin: "https://admin.hoysii.com",
      method: "POST",
      body: {
        hotel_id: "a",
        amount: "80.25",
        period_start: "2026-01-01",
        period_end: "2026-01-31",
        note: "Private finance note",
      },
    };
    result = await f.api("/v1/admin/payouts", options);
    assert.equal(result.status, 201, JSON.stringify(result.data));
    const id = result.data.id;
    assert.equal(
      (await f.api("/v1/admin/dashboard", { cookie: a.cookie })).data
        .paid_out_cents,
      0,
    );
    assert.equal(
      (
        await f.api(`/v1/admin/payouts/${id}`, {
          cookie: a.cookie,
          origin: "https://admin.hoysii.com",
          method: "PATCH",
          body: {
            status: "paid",
            reference: "BANK-TRANSFER-123",
            note: "Funds sent outside Hoysii",
          },
        })
      ).status,
      200,
    );
    result = await f.api("/v1/admin/dashboard", { cookie: a.cookie });
    assert.equal(result.data.net_received_cents, 10000);
    assert.equal(result.data.paid_out_cents, 8025);
    const rows = (
      await f.api("/v1/partner/hotels/a/payouts", { cookie: p.cookie })
    ).data;
    assert.equal(rows[0].reference, "BANK-TRANSFER-123");
    assert.equal(Object.hasOwn(rows[0], "note"), false);
    assert.equal(Object.hasOwn(rows[0], "recorded_by"), false);
    assert.equal(
      (
        await f.api(`/v1/admin/payouts/${id}`, {
          cookie: a.cookie,
          origin: "https://admin.hoysii.com",
          method: "PATCH",
          body: {
            status: "paid",
            reference: "ANOTHER",
            note: "Should not be recorded twice",
          },
        })
      ).status,
      409,
    );
    assert.equal(
      (await f.api("/v1/admin/dashboard", { cookie: u.cookie })).status,
      401,
    );
  } finally {
    f.DB.close();
  }
});

test("basic profile updates preserve identity, validate input and allow clearing phone", async () => {
  const f = await fixture();
  try {
    const u = await f.identity("traveler", "traveler@example.com");
    for (const phone of ["+252 12345678", ""])
      assert.equal(
        (
          await f.api("/v1/me", {
            cookie: u.cookie,
            origin: "https://hoysii.com",
            method: "PATCH",
            body: {
              full_name: "Updated Name",
              phone_number: phone,
              email: "attacker@example.com",
            },
          })
        ).status,
        200,
      );
    const profile = (await f.api("/v1/me", { cookie: u.cookie })).data;
    assert.equal(profile.profile.full_name, "Updated Name");
    assert.equal(profile.profile.phone_number, null);
    assert.equal(profile.user.email, "traveler@example.com");
    assert.equal(
      (
        await f.api("/v1/me", {
          cookie: u.cookie,
          method: "PATCH",
          body: { full_name: "" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.api("/v1/me", {
          cookie: u.cookie,
          method: "PATCH",
          body: { phone_number: "not-a-phone" },
        })
      ).status,
      400,
    );
  } finally {
    f.DB.close();
  }
});

test("saved hotels are idempotent and private to each traveler", async () => {
  const f = await fixture();
  try {
    const u = await f.identity("traveler", "traveler@example.com");
    const other = await f.identity("traveler", "other@example.com");
    assert.equal(
      (await f.api("/v1/me/saved-hotels/a", { method: "POST" })).status,
      401,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await f.api("/v1/me/saved-hotels/a", {
            cookie: u.cookie,
            method: "POST",
          })
        ).status,
        200,
      );
    assert.deepEqual(
      (await f.api("/v1/me/saved-hotels", { cookie: u.cookie })).data.map(
        (h) => h.id,
      ),
      ["a"],
    );
    assert.deepEqual(
      (await f.api("/v1/me/saved-hotels", { cookie: other.cookie })).data,
      [],
    );
    await f.api("/v1/me/saved-hotels/a", {
      cookie: other.cookie,
      method: "DELETE",
    });
    assert.equal(
      (await f.api("/v1/me/saved-hotels", { cookie: u.cookie })).data.length,
      1,
    );
    assert.equal(
      (
        await f.api("/v1/me/saved-hotels/missing", {
          cookie: u.cookie,
          method: "POST",
        })
      ).status,
      404,
    );
    await f.api("/v1/me/saved-hotels/a", {
      cookie: u.cookie,
      method: "DELETE",
    });
    assert.deepEqual(
      (await f.api("/v1/me/saved-hotels", { cookie: u.cookie })).data,
      [],
    );
  } finally {
    f.DB.close();
  }
});

test("assigned hotel can acknowledge and complete a paid stay; reviews follow booking state", async () => {
  const f = await fixture();
  try {
    const p = await f.identity("partner", "partner@example.com");
    const u = await f.identity("traveler", "traveler@example.com");
    const b = await f.book(u.user);
    await f.pay(b);
    const action = (type, status) =>
      f.api(`/v1/partner/bookings/${b.id}/${type}`, {
        cookie: p.cookie,
        method: "POST",
        body: { status, note: "Hotel staff verified this update" },
      });
    assert.equal((await action("stay", "completed")).status, 409);
    assert.equal((await action("acknowledgement", "acknowledged")).status, 200);
    assert.equal(
      (
        await f.DB.prepare("SELECT booking_status FROM bookings WHERE id=?")
          .bind(b.id)
          .first()
      ).booking_status,
      "confirmed",
    );
    assert.equal((await action("stay", "checked_in")).status, 200);
    assert.equal((await action("stay", "completed")).status, 200);
    const review = await f.api(`/v1/bookings/${b.id}/review`, {
      cookie: u.cookie,
      method: "POST",
      body: { rating: 5, comment: "Very good service during this stay." },
    });
    assert.equal(review.status, 200);
    assert.equal((await f.api("/v1/hotels/a/reviews")).data.count, 1);
    await f.DB.prepare(
      "UPDATE bookings SET booking_status='cancelled' WHERE id=?",
    )
      .bind(b.id)
      .run();
    assert.equal((await f.api("/v1/hotels/a/reviews")).data.count, 0);
  } finally {
    f.DB.close();
  }
});

test("partner password reset uses its own OTP and revokes old sessions without touching travelers", async () => {
  const f = await fixture();
  try {
    const p = await f.identity("partner", "partner@example.com");
    const u = await f.identity("traveler", "partner@example.com");
    const reset = await f.api(
      "/api/partner-auth/email-otp/request-password-reset",
      { method: "POST", body: { email: "partner@example.com" } },
    );
    assert.equal(reset.status, 200, JSON.stringify(reset.data));
    const code = f.sent.at(-1).text.match(/\b\d{6}\b/)[0];
    const changed = await f.api("/api/partner-auth/email-otp/reset-password", {
      method: "POST",
      body: {
        email: "partner@example.com",
        otp: code,
        password: "ChangedPartnerPass123!",
      },
    });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
    assert.equal(
      (await f.api("/v1/partner/hotels", { cookie: p.cookie })).status,
      401,
    );
    assert.equal((await f.api("/v1/me", { cookie: u.cookie })).status, 200);
    const signin = await f.api("/api/partner-auth/sign-in/email", {
      method: "POST",
      body: {
        email: "partner@example.com",
        password: "ChangedPartnerPass123!",
      },
    });
    assert.equal(signin.status, 200, JSON.stringify(signin.data));
  } finally {
    f.DB.close();
  }
});

test("browser origins remain separated even when all three session cookies exist", async () => {
  const f = await fixture();
  try {
    const a = await f.identity("admin", f.env.ADMIN_EMAIL),
      p = await f.identity("partner", "partner@example.com"),
      u = await f.identity("traveler", "traveler@example.com");
    const cookie = [a.cookie, p.cookie, u.cookie].join("; ");
    for (const [path, origin] of [
      ["/v1/admin/dashboard", "https://hoysii.com"],
      ["/v1/admin/dashboard", "https://partners.hoysii.com"],
      ["/v1/partner/hotels", "https://admin.hoysii.com"],
      ["/v1/me", "https://partners.hoysii.com"],
      ["/v1/me", "https://admin.hoysii.com"],
    ]) {
      const response = await f.api(path, { cookie, origin });
      assert.equal(response.status, 403, `${origin} cannot read ${path}`);
      assert.equal(
        response.response.headers.get("access-control-allow-origin"),
        null,
      );
    }
    for (const path of ["/v1/admin/dashboard", "/v1/partner/hotels", "/v1/me"])
      assert.equal((await f.api(path, { cookie })).status, 200);
    const rejected = await f.api("/v1/me", {
      cookie,
      origin: "https://partners.hoysii.com",
      method: "PATCH",
      body: { full_name: "Unwanted change" },
    });
    assert.equal(rejected.status, 403);
  } finally {
    f.DB.close();
  }
});
