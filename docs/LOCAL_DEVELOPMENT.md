# Test admin and hotel partners locally

Run these commands from the repository root (`/Users/cigaal/Documents/hoysii/hoysii`), not from an individual app folder. Use Node.js 22.16 or newer. Each project's dependencies must already be installed with its own lockfile (`npm ci` in `services/api`, `apps/admin` and `apps/partners`).

## First-time setup

```sh
node scripts/dev-local.mjs --setup
```

This applies the existing migrations to Wrangler's local D1 emulator, then imports the 15 stakeholder hotels, 30 simulated room types and their photos into local D1/R2. It never uses `--remote`, creates no Cloudflare database and does not overwrite existing hotel records. Run it again after pulling new migrations; do not delete `.wrangler` to update the database.

The launcher creates an ignored `services/api/.env.development.local` with three independent auth secrets, local origins and stakeholder testing enabled. It preserves existing `.dev.vars` and production configuration. Existing local secrets stay stable between restarts. To change the local admin email, edit `ADMIN_EMAIL` in `.env.development.local` before creating the account, then restart.

## Start testing

```sh
node scripts/dev-local.mjs
```

Keep that Terminal window running. One command starts the real API Worker and both websites, with the websites explicitly connected to the local API:

| Service | URL |
| --- | --- |
| Admin | http://localhost:3000 |
| Hotel partners | http://localhost:3001 |
| API | http://localhost:8787 |

Use `localhost` consistently, rather than mixing it with `127.0.0.1` or a LAN IP. Stop old servers on ports 3000, 3001 and 8787 first. Press Ctrl+C to stop all three. The launcher waits for the API before starting the websites and reports port/startup failures.

These are the actual application screens and API handlers, not a static UI preview. Local accounts, bookings and photos are stored on your computer under `services/api/.wrangler/`; they are separate from live data and survive restarts. Your live account password and hotel assignments are not automatically copied locally.

## Create your local accounts

1. Open http://localhost:3000/admin/setup and request the setup link. The terminal displays the configured local admin email.
2. Local email is captured by Wrangler, not delivered to a real inbox. Open the local email file whose path Wrangler prints in the terminal, then copy its `localhost` setup link into your browser.
3. Choose your local admin password, then open the verification link from the next captured email. Sign in at http://localhost:3000/admin. If the account already exists, use its local credentials; the setup page intentionally does not create another admin or send a replacement setup link.
4. In Admin → Partners, invite an email to one of the local hotels.
5. At http://localhost:3001, select **Accept an invitation**, create the separate partner account and enter the verification code from Wrangler's captured email. Partners only see their assigned local hotels.

Keep the local email files private: they contain setup/reset links and verification codes. Wrangler may clean its temporary mail files when the server stops, so use links/codes during the same session.

## Other development options

`npm run dev` in `services/api` starts only the local API with the same local settings. You may then run `npm run dev` separately in each management app. In development, both apps default to `http://localhost:8787`; an explicit `NEXT_PUBLIC_API_URL` overrides that default. The all-in-one command overrides stale app env values for you. Production builds continue to use `https://api.hoysii.com` unless their existing public build variable explicitly sets another URL.

The traveler app is not started or reconfigured by this command. To include it in a local three-system test, set `EXPO_PUBLIC_API_URL=http://localhost:8787` in its ignored env file, restart Expo, and use its web target on http://localhost:8081. A physical phone cannot reach your computer through the phone's `localhost`.

No deployment or production migration is needed for this local setup. Google/Apple sign-in, real email delivery and real payment gateways require their separately configured integrations; local stakeholder checkout simulates payments.
