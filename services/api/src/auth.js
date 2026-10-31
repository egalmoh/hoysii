import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { importPKCS8, SignJWT } from 'jose';
import { db, first, run } from './db.js';

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

export function createAuth(env, { onEmailSendFailure } = {}) {
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
    databaseHooks: {
      user: { create: {
        async before(user) {
          const control = await first(db(env), 'SELECT is_blocked FROM traveler_controls WHERE email = ? COLLATE NOCASE', user.email);
          if (control?.is_blocked) throw APIError.from('FORBIDDEN', { message: 'This account is blocked. Contact Hoysii support.' });
        },
        async after(user) {
          const invite = await first(db(env), 'SELECT invited_name, invited_phone FROM traveler_controls WHERE email = ? COLLATE NOCASE AND invited_at IS NOT NULL', user.email);
          if (!invite) return;
          await run(db(env), 'INSERT INTO profiles (user_id, full_name, phone_number) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET full_name = excluded.full_name, phone_number = excluded.phone_number, updated_at = CURRENT_TIMESTAMP', user.id, invite.invited_name || user.name, invite.invited_phone);
          await run(db(env), 'UPDATE traveler_controls SET invited_at = NULL, invited_name = NULL, invited_phone = NULL, updated_at = CURRENT_TIMESTAMP WHERE email = ? COLLATE NOCASE', user.email);
        },
      } },
      session: { create: { async before(session) {
        const control = await first(db(env), 'SELECT c.is_blocked FROM "user" u JOIN traveler_controls c ON c.email = u.email COLLATE NOCASE WHERE u.id = ?', session.userId);
        if (control?.is_blocked) throw APIError.from('FORBIDDEN', { message: 'This account is blocked. Contact Hoysii support.' });
      } } },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendAuthEmail(env, user.email, 'Reset your Hoysii password', `Reset your Hoysii password: ${url}`),
    },
    emailVerification: {
      // Signup intentionally gives the same response for new and existing emails.
      // The app follows it with password sign-in, which sends one code only when needed.
      sendOnSignUp: false,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
    },
    socialProviders,
    plugins: [
      expo(),
      emailOTP({
        overrideDefaultEmailVerification: true,
        disableSignUp: true,
        // Reuse an unexpired code so a delayed email is not invalidated by resend.
        storeOTP: 'encrypted',
        resendStrategy: 'reuse',
        expiresIn: 900,
        allowedAttempts: 5,
        rateLimit: { window: 60, max: 3 },
        sendVerificationOTP: async ({ email, otp, type }) => {
          const purpose = type === 'forget-password' ? 'reset your password' : type === 'email-verification' ? 'verify your email' : 'sign in';
          try {
            await sendAuthEmail(env, email, `Your Hoysii code: ${otp}`, `Your Hoysii code to ${purpose} is ${otp}. It expires in 15 minutes. If you did not request it, you can ignore this email.`);
          } catch (cause) {
            // The request handler will return a failure response. Better Auth otherwise
            // swallows send errors and returns success for the code request.
            if (onEmailSendFailure) {
              onEmailSendFailure(cause);
              return;
            }
            throw cause;
          }
        },
      }),
    ],
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
