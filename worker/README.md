# Hoysii Cloudflare API

This Worker serves the traveler app and admin. They use separate Better Auth routes, account tables, session tables, cookies, and secrets in the same D1 database. D1 also stores hotels, rooms, profiles, and bookings. Hotel images are stored in R2. The app and admin use the Worker API rather than direct database credentials.

## Current deployment state

The `hoysii` D1 database and `hoysii-hotel-media` R2 bucket are provisioned. All three D1 migrations are applied remotely. The first two preserve 2 hotels, 4 rooms, 8 legacy users, 52 historical bookings, and 9 hotel images; `0003_admin_auth.sql` adds independent admin auth tables and an emailed setup-link table. Cloudflare DNS for `hoysii.com` is active. Workers Paid and Email Sending for `auth.hoysii.com` are enabled. The Worker is at `https://api.hoysii.com`, and the admin is at `https://admin.hoysii.com`. The app's local `.env` points to the production API; the admin's `.env.local` remains on the local Worker for development, while its deployed bundle points to production.

## Local development

1. Run `npm install` in this folder.
2. Copy `.dev.vars.example` to `.dev.vars` and set different random values for `BETTER_AUTH_SECRET` and `ADMIN_AUTH_SECRET` (at least 32 characters each). Set `ADMIN_EMAIL` to the email that will own the admin account and `ADMIN_PANEL_URL` to the local admin origin. Keep `.dev.vars` private.
3. Run `npx wrangler d1 migrations apply hoysii --local`.
4. Run `npm run dev`. Use `http://localhost:8787` as the local API origin.
5. Set `EXPO_PUBLIC_API_URL=http://localhost:8787` in the app's local `.env`, and `NEXT_PUBLIC_API_URL=http://localhost:8787` in the admin's local `.env.local`. Keep `localhost` consistent across the admin and API so browser cookies work. On a physical phone, use a reachable HTTPS API URL rather than `localhost`.

## Production setup

1. Authenticate with `npx wrangler login` using the Hoysii Cloudflare account. The D1 database and both migrations are already in place; do not create a second one.
2. The `hoysii-hotel-media` R2 bucket is already in place; do not create a second one.
3. Cloudflare DNS, Workers Paid, and Email Sending for `auth.hoysii.com` are already enabled. Keep the apex Google Workspace email records intact.
4. `BETTER_AUTH_SECRET`, `ADMIN_AUTH_SECRET`, `ADMIN_EMAIL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are private Worker secrets. The sender `no-reply@auth.hoysii.com` is configured in `wrangler.jsonc`. The Google OAuth **Web application** client uses redirect URI `https://api.hoysii.com/api/auth/callback/google`; a production API initiation request returned Google's authorization URL with that exact callback. The Google Auth Platform project is `hoysii-auth-2026`, still in Testing. Public publishing requires a working Hoysii homepage and privacy-policy page; `https://hoysii.com` currently returns 404. Apple sign-in requires `APPLE_CLIENT_ID` (Service ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` (the downloaded `.p8` key). Configure the Service ID for domain `api.hoysii.com` and return URL `https://api.hoysii.com/api/auth/callback/apple`; enable Sign in with Apple on the app ID `com.anonymous.hoysii`. Add those values as Worker secrets, not public Expo variables. The Worker signs Apple's short-lived client secret when needed. The current Apple account cannot access Certificates, Identifiers & Profiles, so Apple credentials and both live OAuth flows remain unverified.
5. Verify `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, and the `api.hoysii.com` custom domain in `wrangler.jsonc` match the deployed API and frontend origins.
6. Run `npx wrangler d1 migrations apply hoysii --remote` for any later migrations, then `npm run deploy`.
7. Keep the app's `EXPO_PUBLIC_API_URL` and admin production build's `NEXT_PUBLIC_API_URL` pointed to the deployed API. Rebuild the native app for distribution after validation. The Cloudflare admin deploy uses OpenNext.
8. Open `https://admin.hoysii.com/admin/setup` and request a one-time setup link. The link is sent only to the private `ADMIN_EMAIL` value. Open the link, set an admin-only password, verify the second email, then sign in at `https://admin.hoysii.com/admin`. Admin signup through `/api/admin-auth/sign-up/email` is blocked. Traveler accounts cannot access admin APIs, and admin accounts cannot access traveler account APIs.

Google and Apple sign-in use the API callbacks above and return to the app's `hoysii://` deep link. Test native OAuth in an iOS/Android development build or a release build. Expo Go uses an `exp://` callback, which the production Worker intentionally does not trust.

The legacy Supabase database contains 2 hotels, 4 rooms, 8 users, and 52 historical bookings. Migration `0002_legacy_history.sql` preserves the users and bookings separately from Better Auth accounts. Once the same email is verified in Better Auth, that traveler can view their historical trips. Run `scripts/import-legacy.mjs` from this directory with private `LEGACY_SUPABASE_URL` and `LEGACY_SUPABASE_SERVICE_KEY` environment variables after applying the D1 migrations. The script copies public hotel images to R2 and imports all four tables into D1. `HOYSII_API_URL` defaults to `https://api.hoysii.com`. Import is idempotent by record ID. The old Clerk accounts themselves are not transferred; travelers must create new Better Auth accounts and verify the matching email.

The former admin code contained a Supabase service-role key. Removing it from the current source does not revoke the credential or remove it from Git history. Rotate it in Supabase before relying on the new deployment.

This migration does not add a payment processor. A booking created through the API remains `payment_pending` until an authorized admin records payment. Do not interpret that state as evidence of money received or hotel acknowledgement.
