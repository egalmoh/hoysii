# Hoysii Admin

This Next.js admin uses its own Better Auth account and session tables through the Hoysii Cloudflare Worker API. Traveler accounts cannot sign in to the admin. The admin does not connect to the database or R2 directly. Set `NEXT_PUBLIC_API_URL` to the Worker origin (see `.env.example`). The Worker checks the private `ADMIN_EMAIL` secret on every admin API request.

The admin is deployed on Cloudflare Workers at `https://admin.hoysii.com` using OpenNext. Its production bundle points to `https://api.hoysii.com`. For local development, set `NEXT_PUBLIC_API_URL=http://localhost:8787` in `.env.local`, run the local API, then run `npm run dev`.

For first-time access, open `/admin/setup`, request the one-time link sent to the configured admin email, set a separate admin password, and verify the email. Then sign in at `/admin`. The traveler app's signup does not create an admin account.

To redeploy, run `NEXT_PUBLIC_API_URL=https://api.hoysii.com npm run build:cloudflare` followed by `npm run deploy:cloudflare`. For API and data setup, see the [Worker README](../hoysii/worker/README.md).
