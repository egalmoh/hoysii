import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import { importPKCS8, SignJWT } from 'jose';
import { db } from './db.js';

function trustedOrigins(env) {
  return (env.TRUSTED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
}

export async function appleClientSecret(clientId, teamId, keyId, privateKeyPem) {
  const privateKey = await importPKCS8(privateKeyPem.replace(/\\n/g, '\n'), 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(privateKey);
}

export function createAuth(env) {
  const socialProviders = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }
  if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
    socialProviders.apple = async () => {
      const clientSecret = await appleClientSecret(env.APPLE_CLIENT_ID, env.APPLE_TEAM_ID, env.APPLE_KEY_ID, env.APPLE_PRIVATE_KEY);
      return {
        clientId: env.APPLE_CLIENT_ID,
        clientSecret,
        ...(env.APPLE_APP_BUNDLE_IDENTIFIER ? { appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER } : {}),
      };
    };
  }

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      ...trustedOrigins(env),
      ...(socialProviders.apple ? ['https://appleid.apple.com'] : []),
    ],
    database: db(env),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendAuthEmail(env, user.email, 'Reset your Hoysii password', `Reset your Hoysii password: ${url}`),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => sendAuthEmail(env, user.email, 'Verify your Hoysii email', `Verify your Hoysii email: ${url}`),
    },
    socialProviders,
    plugins: [expo()],
  });
}

export function createAdminAuth(env) {
  if (!env.ADMIN_AUTH_SECRET) throw new Error('The ADMIN_AUTH_SECRET is not configured.');
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/admin-auth',
    secret: env.ADMIN_AUTH_SECRET,
    trustedOrigins: trustedOrigins(env).filter((origin) => origin.startsWith('http://localhost:') || origin.startsWith('https://admin.')),
    database: db(env),
    user: { modelName: 'admin_user' },
    session: { modelName: 'admin_session' },
    account: { modelName: 'admin_account' },
    verification: { modelName: 'admin_verification' },
    advanced: { cookiePrefix: 'hoysii-admin' },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendAuthEmail(env, user.email, 'Reset your Hoysii admin password', `Reset your Hoysii admin password: ${url}`),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      sendVerificationEmail: async ({ user, url }) => sendAuthEmail(env, user.email, 'Verify your Hoysii admin email', `Verify your Hoysii admin email: ${url}`),
    },
  });
}

export async function sendAuthEmail(env, to, subject, text) {
  if (!env.SEND_EMAIL) throw new Error('The SEND_EMAIL binding is not configured.');
  const from = env.AUTH_EMAIL_FROM || 'no-reply@auth.hoysii.com';
  await env.SEND_EMAIL.send({ from, to, subject, text });
}
