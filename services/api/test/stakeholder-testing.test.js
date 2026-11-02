import test from "node:test";
import assert from "node:assert/strict";
import { localD1 } from "./support/d1.js";
import { createAdminAuth, createAuth, createPartnerAuth } from "../src/auth.js";
import { createBooking, today } from "../src/booking-service.js";
import { settlePayment } from "../src/operations.js";
import { addDays } from "../src/availability.js";
import worker from "../src/index.js";
import { processJobs } from "../src/operations.js";

async function fixture() {
  const DB = localD1();
  const sent = [];
  const env = {
    STAKEHOLDER_TESTING: "true",
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

const simulate = (f, guest, id) => f.api(`/v1/bookings/${id}/payments`, {cookie:guest.cookie, method:'POST', body:{}});
const count = async (f, table) => (await f.DB.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n;

test('stakeholder checkout connects traveler, admin and assigned partner through stay completion and isolated reviews', async () => {
  const f = await fixture();
  try {
    const guest = await f.identity('traveler','guest@example.com');
    const admin = await f.identity('admin','admin@example.com');
    const partner = await f.identity('partner','partner@example.com');
    const emailCount = f.sent.length;
    const created = await f.api('/v1/bookings', {cookie:guest.cookie, method:'POST', body:{room_id:'a-room', check_in_date:addDays(today(),10), check_out_date:addDays(today(),12), adults:1, children:0, payment_provider:'waafi', idempotency_key:'stakeholder-checkout'}});
    assert.equal(created.status,201, JSON.stringify(created.data));
    assert.equal(created.data.is_test,true);
    const id = created.data.id;
    const paid = await simulate(f,guest,id);
    assert.equal(paid.status,200, JSON.stringify(paid.data));
    assert.equal(paid.data.booking_status,'confirmed');
    assert.equal(paid.data.payment_status,'paid');
    assert.equal(paid.data.hotel_ack_status,undefined);
    assert.equal(paid.data.internal_status,undefined);
    assert.equal(paid.data.payments,undefined);
    assert.equal((await f.api(`/v1/admin/bookings/${id}`,{cookie:admin.cookie})).data.hotel_ack_status,'pending');
    assert.equal((await simulate(f,guest,id)).status,200);
    assert.equal(await count(f,'payments'),1);
    assert.equal(await count(f,'receipts'),1);
    const receipt = await f.api(`/v1/bookings/${id}/receipt`,{cookie:guest.cookie});
    assert.equal(receipt.data.is_test,true);
    assert.equal(receipt.data.source,'simulation');
    assert.equal(receipt.data.provider,'waafi');
    assert.match(receipt.data.transaction_reference,/^TEST-/);
    assert.equal((await f.api('/v1/trips',{cookie:guest.cookie})).data[0].id,id);
    assert.equal((await f.api('/v1/admin/bookings',{cookie:admin.cookie})).data[0].is_test,true);
    let rows = (await f.api('/v1/partner/hotels/a/reservations',{cookie:partner.cookie})).data;
    assert.equal(rows[0].id,id);
    assert.equal(rows[0].is_test,1);
    for (const [action,status] of [['acknowledgement','acknowledged'],['stay','checked_in'],['stay','completed']]) {
      const result = await f.api(`/v1/partner/bookings/${id}/${action}`,{cookie:partner.cookie,method:'POST',body:{status,note:'Stakeholder journey test'}});
      assert.equal(result.status,200,JSON.stringify(result.data));
    }
    const trip = (await f.api('/v1/trips',{cookie:guest.cookie})).data[0];
    assert.equal(trip.stay_status,'completed');
    assert.equal(trip.booking_status,'confirmed');
    assert.equal((await f.api(`/v1/bookings/${id}/review`,{cookie:guest.cookie,method:'POST',body:{rating:5,comment:'Testing the full stakeholder experience.'}})).status,200);
    assert.equal((await f.api('/v1/hotels/a/reviews')).data.count,0);
    assert.equal((await f.api('/v1/me/test-reviews?hotel_id=a',{cookie:guest.cookie})).data.length,1);
    assert.equal((await f.api('/v1/admin/reviews',{cookie:admin.cookie})).data[0].is_test,1);
    const dashboard = (await f.api('/v1/admin/dashboard',{cookie:admin.cookie})).data;
    assert.equal(dashboard.test_bookings,1);
    assert.equal(dashboard.received_cents,0);
    assert.equal(dashboard.published_reviews,0);
    assert.equal(await count(f,'notifications'),0);
    await processJobs(f.env);
    assert.equal(f.sent.length,emailCount);
  } finally { f.DB.close(); }
});

test('simulated settlement requires an owned test booking and server mode; client success flags cannot pay a real booking', async () => {
  const f=await fixture();
  try {
    const a=await f.identity('traveler','a@example.com'), b=await f.identity('traveler','b@example.com');
    const booking=await f.book(a.user);
    assert.equal((await f.api(`/v1/bookings/${booking.id}/payments`,{method:'POST',body:{paid:true}})).status,401);
    assert.ok([403,404].includes((await simulate(f,b,booking.id)).status));
    f.env.STAKEHOLDER_TESTING='false';
    assert.equal((await simulate(f,a,booking.id)).status,503);
    await assert.rejects(settlePayment(f.env,booking.id,{provider:'stakeholder_test',source:'simulation'}),/not enabled/);
    const real=await f.book(b.user);
    f.env.STAKEHOLDER_TESTING='true';
    assert.equal((await f.api(`/v1/bookings/${real.id}/payments`,{cookie:b.cookie,method:'POST',body:{paid:true,is_test:true}})).status,409);
    await assert.rejects(settlePayment(f.env,real.id,{provider:'stakeholder_test',source:'simulation'}),/not enabled/);
    assert.equal(await count(f,'payments'),0);
    await assert.rejects(f.DB.prepare('UPDATE bookings SET is_test=0 WHERE id=?').bind(booking.id).run(),/immutable/);
    f.env.STAKEHOLDER_TESTING='true';
    const forged=await f.api('/v1/bookings',{cookie:a.cookie,method:'POST',body:{is_test:false,room_id:'a-room',check_in_date:addDays(today(),20),check_out_date:addDays(today(),21),idempotency_key:'forged-mode'}});
    assert.equal(forged.status,400);
  } finally {f.DB.close();}
});

test('test holds, confirmations and inventory blocks never consume live inventory; both pools still prevent overselling', async () => {
  const f=await fixture();
  try {
    const guest=await f.identity('traveler','guest@example.com'), admin=await f.identity('admin','admin@example.com');
    await f.DB.exec("UPDATE rooms SET total_units=1 WHERE id='a-room'");
    const mock=await f.book(guest.user);
    assert.equal((await simulate(f,guest,mock.id)).status,200);
    f.env.STAKEHOLDER_TESTING='false';
    const real=await f.book(guest.user);
    assert.equal(real.is_test,false);
    f.env.STAKEHOLDER_TESTING='true';
    await assert.rejects(f.book(guest.user),/available|inventory/);
    await f.DB.exec("UPDATE rooms SET total_units=1 WHERE id='a-room'");
    const from=addDays(today(),20),to=addDays(today(),22);
    const block=await f.api('/v1/admin/rooms/a-room/blocks',{cookie:admin.cookie,method:'POST',body:{start_date:from,end_date:to,units:1,reason:'Stakeholder test closure'}});
    assert.equal(block.status,201,JSON.stringify(block.data));
    let available=(await f.api(`/v1/rooms/a-room/availability?check_in=${from}&check_out=${to}`)).data.available;
    assert.equal(available,false);
    f.env.STAKEHOLDER_TESTING='false';
    available=(await f.api(`/v1/rooms/a-room/availability?check_in=${from}&check_out=${to}`)).data.available;
    assert.equal(available,true);
    assert.equal((await f.api(`/v1/admin/inventory-blocks/${block.data.id}`,{cookie:admin.cookie,method:'DELETE'})).status,404);
  } finally {f.DB.close();}
});

test('simulated cancellation, refund and payout progress stays out of real finance and email', async () => {
  const f=await fixture();
  try {
    const guest=await f.identity('traveler','guest@example.com'), admin=await f.identity('admin','admin@example.com');
    const emailCount=f.sent.length;
    const booking=await f.book(guest.user);
    await simulate(f,guest,booking.id);
    const cancelled=await f.api(`/v1/admin/bookings/${booking.id}/cancel`,{cookie:admin.cookie,method:'POST',body:{note:'Stakeholder cancellation test'}});
    assert.equal(cancelled.status,200,JSON.stringify(cancelled.data));
    assert.equal(cancelled.data.refund.amount_cents,Math.round(booking.total_price*100));
    const id=cancelled.data.refund.id;
    for(const status of ['approved','completed']) assert.equal((await f.api(`/v1/admin/refunds/${id}`,{cookie:admin.cookie,method:'PATCH',body:{status,note:'Simulated refund test'}})).status,200);
    const payout=await f.api('/v1/admin/payouts',{cookie:admin.cookie,method:'POST',body:{hotel_id:'a',amount:100,period_start:addDays(today(),1),period_end:addDays(today(),2),note:'Simulated hotel payout'}});
    assert.equal(payout.status,201,JSON.stringify(payout.data));
    assert.equal((await f.api(`/v1/admin/payouts/${payout.data.id}`,{cookie:admin.cookie,method:'PATCH',body:{status:'paid',note:'Simulated payout completion'}})).status,200);
    const dashboard=(await f.api('/v1/admin/dashboard',{cookie:admin.cookie})).data;
    assert.equal(dashboard.received_cents,0);assert.equal(dashboard.refunded_cents,0);assert.equal(dashboard.paid_out_cents,0);
    assert.equal(await count(f,'notifications'),0);
    await processJobs(f.env);assert.equal(f.sent.length,emailCount);
  } finally {f.DB.close();}
});

test('test overdue exceptions remain internal, partner hotel assignments still isolate test bookings, and expired holds cannot settle', async () => {
  const f=await fixture();
  try {
    const guest=await f.identity('traveler','guest@example.com');
    await f.DB.exec("INSERT INTO partner_memberships(id,email,hotel_id,created_by) VALUES('other','other@example.com','b','admin')");
    const partner=await f.identity('partner','other@example.com');
    const booking=await f.book(guest.user);
    await simulate(f,guest,booking.id);
    assert.equal((await f.api(`/v1/partner/bookings/${booking.id}/acknowledgement`,{cookie:partner.cookie,method:'POST',body:{status:'acknowledged',note:'Attempt on another property'}})).status,404);
    await f.DB.prepare("UPDATE bookings SET hotel_ack_due_at=datetime('now','-1 minute') WHERE id=?").bind(booking.id).run();
    // Even an accidentally queued notification for a test stay must never be delivered.
    await f.DB.prepare("INSERT INTO notifications(id,booking_id,kind,recipient,subject,body) VALUES('trap',?,'test','hotel@example.com','Test','Do not send')").bind(booking.id).run();
    const baseline=f.sent.length;
    await processJobs(f.env);
    assert.equal(f.sent.length,baseline);
    assert.equal((await f.DB.prepare("SELECT COUNT(*) n FROM booking_exceptions WHERE booking_id=? AND kind='hotel_ack_overdue'").bind(booking.id).first()).n,1);
    const second=await f.book(guest.user);
    await f.DB.prepare("UPDATE bookings SET hold_expires_at=datetime('now','-1 minute') WHERE id=?").bind(second.id).run();
    assert.equal((await simulate(f,guest,second.id)).status,409);
    assert.equal(await count(f,'payments'),1);
  } finally {f.DB.close();}
});
