import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { expo } from '@better-auth/expo';
import { db } from './db.js';
import { authSchema } from './schema.js';

function configuredProvider(clientId, clientSecret) {
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

function trustedOrigins(env) {
  return (env.TRUSTED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createAuth(env) {
  const socialProviders = {};
  const google = configuredProvider(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  const apple = configuredProvider(env.APPLE_CLIENT_ID, env.APPLE_CLIENT_SECRET);

  if (google) socialProviders.google = google;
  if (apple) socialProviders.apple = apple;

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: trustedOrigins(env),
    database: drizzleAdapter(db(env), { provider: 'pg', schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail(env, {
          to: user.email,
          subject: 'Reset your Hoysii password',
          text: `Reset your Hoysii password: ${url}`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail(env, {
          to: user.email,
          subject: 'Verify your Hoysii email',
          text: `Verify your Hoysii email: ${url}`,
        });
      },
    },
    socialProviders,
    plugins: [expo()],
  });
}

async function sendAuthEmail(env, { to, subject, text }) {
  if (!env.SEND_EMAIL) {
    throw new Error('The SEND_EMAIL binding is not configured.');
  }

  const from = env.AUTH_EMAIL_FROM || 'no-reply@hoysii.com';
  await env.SEND_EMAIL.send({ from, to, subject, text });
}
