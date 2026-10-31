import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createAuth, createAdminAuth } from '../src/auth.js';
import worker from '../src/index.js';

function localD1() {
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of ['0001_hoysii.sql', '0003_admin_auth.sql', '0004_traveler_management.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
  }
  return {
    close: () => sqlite.close(),
    async exec(sql) { sqlite.exec(sql); return { count: 1, duration: 0 }; },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.all())); },
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
        async first() { return statement.get(...parameters) || null; },
        async all() {
          if (/^(?:insert|update|delete)\b/i.test(sql) && !/\breturning\b/i.test(sql)) {
            const result = statement.run(...parameters);
            return { results: [], meta: { changes: result.changes, last_row_id: result.lastInsertRowid }, success: true };
          }
          return { results: statement.all(...parameters), meta: { changes: 0 }, success: true };
        },
        async run() { return { meta: { changes: statement.run(...parameters).changes }, success: true }; },
      };
    },
  };
}

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
