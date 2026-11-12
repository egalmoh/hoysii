import test from 'node:test';
import assert from 'node:assert/strict';
import { localD1 } from './support/d1.js';
import worker from '../src/index.js';

test('localhost admin setup, partner invitation and separate sessions work without relaxing production origins', async () => {
  const DB = localD1();
  const mail = [];
  const env = {
    DB,
    BETTER_AUTH_URL: 'http://localhost:8787',
    BETTER_AUTH_SECRET: 'local-traveler-secret-more-than-thirty-two-characters',
    ADMIN_AUTH_SECRET: 'local-admin-secret-more-than-thirty-two-characters',
    PARTNER_AUTH_SECRET: 'local-partner-secret-more-than-thirty-two-characters',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PANEL_URL: 'http://localhost:3000',
    PARTNER_PANEL_URL: 'http://localhost:3001',
    PARTNER_LOCAL_ORIGINS: 'http://localhost:3001',
    TRUSTED_ORIGINS: 'http://localhost:3000,http://localhost:3001,http://localhost:8081,hoysii://',
    SEND_EMAIL: { async send(message) { mail.push(message); } },
  };
  const request = (path, origin, { body, cookie, method = body ? 'POST' : 'GET' } = {}) => worker.fetch(new Request(`${env.BETTER_AUTH_URL}${path}`, {
    method,
    headers: { origin, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }), env);
  const cookieOf = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  try {
    await DB.exec("INSERT INTO hotels(id,name,city) VALUES('local-hotel','Local Hotel','Mogadishu'),('other-hotel','Other Hotel','Garowe')");
    const admin = env.ADMIN_PANEL_URL;
    const partner = env.PARTNER_PANEL_URL;
    const setup = await request('/v1/admin/setup/request', admin, { body: {} });
    assert.equal(setup.status, 200);
    const token = mail.at(-1).text.match(/#token=([A-Za-z0-9_-]+)/)[1];
    const credentials = { email: env.ADMIN_EMAIL, password: 'LocalAdminTesting123!' };
    assert.equal((await request('/v1/admin/setup/complete', admin, { body: { token, password: credentials.password } })).status, 201);
    const verificationURL = new URL(mail.at(-1).text.match(/http:\/\/\S+/)[0]);
    assert.equal(verificationURL.origin, env.BETTER_AUTH_URL);
    assert.equal((await request(`${verificationURL.pathname}${verificationURL.search}`, admin)).status, 302);
    const signedIn = await request('/api/admin-auth/sign-in/email', admin, { body: credentials });
    assert.equal(signedIn.status, 200, await signedIn.clone().text());
    assert.doesNotMatch(signedIn.headers.get('set-cookie'), /; Secure/i, 'HTTP localhost cookies must be usable');
    assert.match(signedIn.headers.get('set-cookie'), /HttpOnly/i);
    const adminCookie = cookieOf(signedIn);
    assert.equal((await request('/v1/admin/hotels', admin, { cookie: adminCookie })).status, 200);
    const invitation = await request('/v1/admin/partners', admin, { cookie: adminCookie, body: { email: 'partner@example.com', hotel_id: 'local-hotel' } });
    assert.equal(invitation.status, 201);
    assert.match(mail.at(-1).text, /http:\/\/localhost:3001/);
    const partnerCredentials = { email: 'partner@example.com', password: 'LocalPartnerTesting123!' };
    assert.equal((await request('/api/partner-auth/sign-up/email', partner, { body: { ...partnerCredentials, name: 'Local Partner' } })).status, 200);
    assert.equal((await request('/api/partner-auth/sign-in/email', partner, { body: partnerCredentials })).status, 403);
    const otp = mail.at(-1).text.match(/\b\d{6}\b/)[0];
    assert.equal((await request('/api/partner-auth/email-otp/verify-email', partner, { body: { email: partnerCredentials.email, otp } })).status, 200);
    const partnerSignIn = await request('/api/partner-auth/sign-in/email', partner, { body: partnerCredentials });
    assert.equal(partnerSignIn.status, 200, await partnerSignIn.clone().text());
    const partnerCookie = cookieOf(partnerSignIn);
    const hotels = await request('/v1/partner/hotels', partner, { cookie: partnerCookie });
    assert.equal(hotels.status, 200);
    assert.deepEqual((await hotels.json()).map(hotel => hotel.id), ['local-hotel']);
    const deniedHotel = await request('/v1/partner/hotels/other-hotel', partner, { cookie: partnerCookie });
    assert.equal(deniedHotel.status, 404);
    assert.equal((await deniedHotel.json()).error, 'Hotel not found or access denied.');
    assert.equal((await request('/v1/admin/hotels', admin, { cookie: partnerCookie })).status, 401);
    assert.equal((await request('/v1/partner/me', partner, { cookie: adminCookie })).status, 401);
    for (const [path, allowed, denied] of [
      ['/api/admin-auth/sign-in/email', admin, partner],
      ['/api/partner-auth/sign-in/email', partner, admin],
      ['/api/auth/sign-in/email', 'http://localhost:8081', admin],
    ]) {
      assert.equal((await request(path, allowed, { method: 'OPTIONS' })).headers.get('access-control-allow-origin'), allowed);
      assert.equal((await request(path, denied, { method: 'OPTIONS' })).headers.get('access-control-allow-origin'), null);
    }
    const production = { ...env, BETTER_AUTH_URL: 'https://api.hoysii.com', ADMIN_PANEL_URL: 'https://admin.hoysii.com', PARTNER_PANEL_URL: 'https://partners.hoysii.com', PARTNER_LOCAL_ORIGINS: '', TRUSTED_ORIGINS: 'https://admin.hoysii.com,https://hoysii.com' };
    for (const path of ['/api/admin-auth/sign-in/email', '/api/partner-auth/sign-in/email']) {
      const response = await worker.fetch(new Request(`https://api.hoysii.com${path}`, { method: 'OPTIONS', headers: { origin: 'http://localhost:3000' } }), production);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
  } finally { DB.close(); }
});
