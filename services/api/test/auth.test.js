import test from 'node:test';
import assert from 'node:assert/strict';
import { localD1 } from './support/d1.js';
import { createAuth, createAdminAuth } from '../src/auth.js';
import worker from '../src/index.js';
import { readFileSync } from 'node:fs';

test('traveler web origins support credentialed email auth and reject unrelated origins', async () => {
  const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  const DB = localD1();
  const sent = [];
  const env = {
    DB,
    BETTER_AUTH_URL: 'https://api.hoysii.com',
    BETTER_AUTH_SECRET: 'traveler-test-secret-at-least-thirty-two-characters',
    ADMIN_AUTH_SECRET: 'independent-admin-test-secret-at-least-thirty-two-characters',
    TRUSTED_ORIGINS: config.match(/"TRUSTED_ORIGINS":\s*"([^"]+)"/)[1],
    SEND_EMAIL: { async send(message) { sent.push(message); } },
  };
  const request = (path, origin, body, cookie) => worker.fetch(new Request(`https://api.hoysii.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { origin, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }), env);
  try {
    for (const origin of ['https://hoysii.com', 'https://www.hoysii.com']) {
      const preflight = await worker.fetch(new Request('https://api.hoysii.com/v1/bookings', {
        method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-idempotency-key' },
      }), env);
      assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
      assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
      assert.match(preflight.headers.get('access-control-allow-headers'), /X-Idempotency-Key/i);

      const email = origin.includes('www.') ? 'web-www@example.com' : 'web-apex@example.com';
      const credentials = { email, password: 'SecurePass123!' };
      assert.equal((await request('/api/auth/sign-up/email', origin, { ...credentials, name: 'Web Traveler' })).status, 200);
      assert.equal((await request('/api/auth/sign-in/email', origin, credentials)).status, 403);
      const otp = sent.at(-1).text.match(/\b\d{6}\b/)[0];
      assert.equal((await request('/api/auth/email-otp/verify-email', origin, { email, otp })).status, 200);
      const signin = await request('/api/auth/sign-in/email', origin, credentials);
      assert.equal(signin.status, 200);
      assert.equal(signin.headers.get('access-control-allow-origin'), origin);
      const setCookie = signin.headers.get('set-cookie');
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /Secure/i);
      const cookie = setCookie.split(';')[0];
      const session = await request('/api/auth/get-session', origin, undefined, cookie);
      assert.equal((await session.json()).user.email, email);
      assert.equal((await request('/v1/trips', origin, undefined, cookie)).status, 200);
      assert.equal((await request('/v1/admin/hotels', origin, undefined, cookie)).status, 401);
      assert.equal((await request('/api/auth/sign-out', origin, {}, cookie)).status, 200);
      assert.equal(await (await request('/api/auth/get-session', origin, undefined, cookie)).json(), null);
    }
    const untrusted = await request('/api/auth/sign-in/email', 'https://hoysii.com.attacker.example', { email: 'web-apex@example.com', password: 'SecurePass123!' });
    assert.equal(untrusted.status, 403);
    assert.equal(untrusted.headers.get('access-control-allow-origin'), null);
  } finally {
    DB.close();
  }
});

async function post(auth, path, body, origin = 'hoysii://') {
  const response = await auth.handler(new Request(`https://api.hoysii.com${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}

test('traveler email code verifies and signs in without creating an admin account', async () => {
  const DB = localD1();
  const sent = [];
  const env = {
    DB,
    BETTER_AUTH_URL: 'https://api.hoysii.com',
    BETTER_AUTH_SECRET: 'traveler-test-secret-at-least-thirty-two-characters',
    ADMIN_AUTH_SECRET: 'independent-admin-test-secret-at-least-thirty-two-characters',
    TRUSTED_ORIGINS: 'hoysii://,https://admin.hoysii.com',
    SEND_EMAIL: { async send(message) { sent.push(message); } },
  };
  try {
    const auth = createAuth(env);
    const signup = await post(auth, '/api/auth/sign-up/email', { name: 'Traveler', email: 'traveler@example.com', password: 'SecurePass123!' });
    assert.equal(signup.status, 200, JSON.stringify(signup.body));
    assert.equal(sent.length, 0, 'signup response must not claim a code was sent for an existing email');

    const signinBeforeVerify = await post(auth, '/api/auth/sign-in/email', { email: 'traveler@example.com', password: 'SecurePass123!' });
    assert.equal(signinBeforeVerify.status, 403);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /\b\d{6}\b/);
    assert.doesNotMatch(sent[0].text, /https:\/\//);
    const resend = await post(auth, '/api/auth/sign-in/email', { email: 'traveler@example.com', password: 'SecurePass123!' });
    assert.equal(resend.status, 403);
    assert.equal(sent.length, 2);
    assert.equal(sent[0].text.match(/\b\d{6}\b/)[0], sent[1].text.match(/\b\d{6}\b/)[0], 'resend must not invalidate a delayed email');
    const code = sent.at(-1).text.match(/\b\d{6}\b/)[0];

    const verified = await post(auth, '/api/auth/email-otp/verify-email', { email: 'traveler@example.com', otp: code });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(verified.body.status, true);
    assert.ok(verified.cookie);

    const duplicateSignup = await post(auth, '/api/auth/sign-up/email', { name: 'Traveler Again', email: 'traveler@example.com', password: 'DifferentPass123!' });
    assert.equal(duplicateSignup.status, 200);
    assert.equal(sent.length, 2, 'existing verified account must not lead the app to wait for a nonexistent code');

    const signin = await post(auth, '/api/auth/sign-in/email', { email: 'traveler@example.com', password: 'SecurePass123!' });
    assert.equal(signin.status, 200, JSON.stringify(signin.body));
    assert.equal(signin.body.user.email, 'traveler@example.com');

    const admin = createAdminAuth(env);
    const adminSignin = await post(admin, '/api/admin-auth/sign-in/email', { email: 'traveler@example.com', password: 'SecurePass123!' }, 'https://admin.hoysii.com');
    assert.notEqual(adminSignin.status, 200);

    const resetRequest = await post(auth, '/api/auth/email-otp/request-password-reset', { email: 'traveler@example.com' });
    assert.equal(resetRequest.status, 200, JSON.stringify(resetRequest.body));
    const resetCode = sent.at(-1).text.match(/\b\d{6}\b/)[0];
    const reset = await post(auth, '/api/auth/email-otp/reset-password', { email: 'traveler@example.com', otp: resetCode, password: 'ReplacementPass123!' });
    assert.equal(reset.status, 200, JSON.stringify(reset.body));
    const newSignin = await post(auth, '/api/auth/sign-in/email', { email: 'traveler@example.com', password: 'ReplacementPass123!' });
    assert.equal(newSignin.status, 200, JSON.stringify(newSignin.body));
  } finally {
    DB.close();
  }
});

test('traveler sign-in reports email service failure and can resend the same code', async () => {
  const DB = localD1();
  const sent = [];
  let rejectEmail = true;
  const env = {
    DB,
    BETTER_AUTH_URL: 'https://api.hoysii.com',
    BETTER_AUTH_SECRET: 'traveler-test-secret-at-least-thirty-two-characters',
    TRUSTED_ORIGINS: 'hoysii://',
    SEND_EMAIL: { async send(message) {
      if (rejectEmail) throw Object.assign(new Error('Provider rejected the message'), { code: 'E_DELIVERY_FAILED' });
      sent.push(message);
      return { messageId: 'accepted-test-message' };
    } },
  };
  const request = async (path, body) => {
    const response = await worker.fetch(new Request(`https://api.hoysii.com${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'hoysii://' },
      body: JSON.stringify(body),
    }), env);
    return { status: response.status, body: await response.json() };
  };
  try {
    const signup = await request('/api/auth/sign-up/email', { name: 'Traveler', email: 'traveler@example.com', password: 'SecurePass123!' });
    assert.equal(signup.status, 200);
    assert.equal(sent.length, 0);

    const unverifiedSignin = await request('/api/auth/sign-in/email', { email: 'traveler@example.com', password: 'SecurePass123!' });
    assert.equal(unverifiedSignin.status, 502);
    assert.equal(unverifiedSignin.body.code, 'EMAIL_SEND_FAILED');

    rejectEmail = false;
    const resend = await request('/api/auth/sign-in/email', { email: 'traveler@example.com', password: 'SecurePass123!' });
    assert.equal(resend.status, 403, JSON.stringify(resend.body));
    assert.equal(resend.body.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /expires in 15 minutes/);
    const code = sent[0].text.match(/\b\d{6}\b/)[0];
    const verified = await request('/api/auth/email-otp/verify-email', { email: 'traveler@example.com', otp: code });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));

    rejectEmail = true;
    const failedReset = await request('/api/auth/email-otp/request-password-reset', { email: 'traveler@example.com' });
    assert.equal(failedReset.status, 502);
    assert.equal(failedReset.body.code, 'EMAIL_SEND_FAILED');
  } finally {
    DB.close();
  }
});

test('hotel manager details are private while authenticated admins retain access', async () => {
  const DB = localD1();
  const env = {
    DB,
    BETTER_AUTH_URL: 'https://api.hoysii.com',
    BETTER_AUTH_SECRET: 'traveler-test-secret-at-least-thirty-two-characters',
    ADMIN_AUTH_SECRET: 'independent-admin-test-secret-at-least-thirty-two-characters',
    ADMIN_EMAIL: 'admin@example.com',
    TRUSTED_ORIGINS: 'hoysii://,https://admin.hoysii.com',
    SEND_EMAIL: { async send() {} },
  };
  const request = (path, cookie) => worker.fetch(new Request(`https://api.hoysii.com${path}`, {
    headers: cookie ? { cookie } : {},
  }), env);
  try {
    await DB.exec(`ALTER TABLE hotels ADD COLUMN internal_note TEXT;
      INSERT INTO hotels (id, name, city, images, amenities, starting_price_cents, manager_name, manager_email, manager_phone, internal_note)
      VALUES ('hotel-1', 'Test Hotel', 'Mogadishu', '["https://example.com/hotel.jpg"]', '["WiFi"]', 6000, 'Private Manager', 'manager@example.com', '+252000000000', 'Private operations note');
      INSERT INTO rooms (id, hotel_id, name, price_cents) VALUES ('room-1', 'hotel-1', 'Double', 6000);`);

    for (const path of ['/v1/hotels', '/v1/hotels?city=Mogadishu&check_in=2026-12-01&check_out=2026-12-03', '/v1/hotels/hotel-1']) {
      const response = await request(path);
      assert.equal(response.status, 200);
      const body = await response.json();
      const hotel = Array.isArray(body) ? body[0] : body.hotel;
      assert.equal(hotel.name, 'Test Hotel');
      assert.equal(hotel.starting_price, 60);
      assert.deepEqual(hotel.images, ['https://example.com/hotel.jpg']);
      assert.deepEqual(hotel.amenities, ['WiFi']);
      for (const field of ['manager_name', 'manager_email', 'manager_phone', 'internal_note']) {
        assert.equal(Object.hasOwn(hotel, field), false, `${path} must not expose ${field}`);
      }
    }

    for (const path of ['/v1/admin/hotels', '/v1/admin/hotels/hotel-1']) {
      assert.equal((await request(path)).status, 401);
    }

    const traveler = createAuth(env);
    await post(traveler, '/api/auth/sign-up/email', { name: 'Traveler', email: 'traveler@example.com', password: 'SecurePass123!' });
    await DB.prepare('UPDATE "user" SET emailVerified = 1 WHERE email = ?').bind('traveler@example.com').run();
    const travelerSignin = await post(traveler, '/api/auth/sign-in/email', { email: 'traveler@example.com', password: 'SecurePass123!' });
    assert.equal(travelerSignin.status, 200);
    for (const path of ['/v1/admin/hotels', '/v1/admin/hotels/hotel-1']) {
      assert.equal((await request(path, travelerSignin.cookie.split(';')[0])).status, 401);
    }

    const admin = createAdminAuth(env);
    await post(admin, '/api/admin-auth/sign-up/email', { name: 'Admin', email: env.ADMIN_EMAIL, password: 'AdminSecurePass123!' }, 'https://admin.hoysii.com');
    await DB.prepare('UPDATE admin_user SET emailVerified = 1 WHERE email = ?').bind(env.ADMIN_EMAIL).run();
    const signin = await post(admin, '/api/admin-auth/sign-in/email', { email: env.ADMIN_EMAIL, password: 'AdminSecurePass123!' }, 'https://admin.hoysii.com');
    assert.equal(signin.status, 200, JSON.stringify(signin.body));
    const cookie = signin.cookie.split(';')[0];
    for (const path of ['/v1/admin/hotels', '/v1/admin/hotels/hotel-1']) {
      const response = await request(path, cookie);
      assert.equal(response.status, 200);
      const body = await response.json();
      const hotel = Array.isArray(body) ? body[0] : body.hotel;
      assert.equal(hotel.manager_name, 'Private Manager');
      assert.equal(hotel.manager_email, 'manager@example.com');
      assert.equal(hotel.manager_phone, '+252000000000');
      assert.equal(Object.hasOwn(hotel, 'internal_note'), false);
      if (!Array.isArray(body)) assert.equal(body.rooms[0].id, 'room-1');
    }
    assert.equal((await request('/v1/admin/hotels/missing', cookie)).status, 404);
  } finally {
    DB.close();
  }
});
