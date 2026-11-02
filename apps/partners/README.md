# Hoysii hotel partner portal

Next.js/OpenNext frontend for invited hotel teams. Calls the existing Hoysii API; no database or authentication secrets belong in this project. Accounts and API permissions are independent of staff and travelers.

Run `npm ci`, then `npm run dev` (port 3001). Build locally with `npm run build:cloudflare`; lint with `npm run lint`. Configure the public API base through `NEXT_PUBLIC_API_URL` if needed. Production defaults to `https://api.hoysii.com`.

See [MVP systems and owner release steps](../../docs/MVP_SYSTEMS.md) for migration 0006, the API's independent partner secret, hotel invitations, route permissions, and Cloudflare Git hosting. The new production Worker/Git connection/domain is not created by adding this folder. Do not manually deploy or push: the owner handles GitHub and connected builds.
