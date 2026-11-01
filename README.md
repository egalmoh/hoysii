# Hoysii

This repository keeps the traveler app, admin panel, and API together as separate projects. Each has its own dependencies, lockfile, build, and deployment. They communicate through the API; they do not share admin and traveler sessions.

| Project | Source | Runs as |
| --- | --- | --- |
| Traveler app | `apps/traveler/` | Expo on iOS/Android; `hoysii-web` Cloudflare Worker for web |
| Admin panel | `apps/admin/` | Next.js on the `hoysii-admin` Cloudflare Worker |
| API | `services/api/` | `hoysii-api` Cloudflare Worker, with D1 and R2 |

The hotel partner portal is planned for `apps/partners/` when it is implemented. Shared packages can be added under `packages/` when there is code worth sharing. The projects currently install independently because the Expo app and Next.js admin use different React versions; there is no root npm workspace or shared lockfile yet.

## Local development

Run commands inside the relevant project directory:

```sh
cd apps/traveler && npm install && npm start
cd apps/admin && npm install && npm run dev
cd services/api && npm install && npm run dev
```

Keep each project's private `.env`, `.env.local`, and `.dev.vars` out of Git. See [API setup](services/api/README.md) for local D1, authentication, email, and migration details. Product notes live in [docs](docs/).

## Deployment boundaries

All three Cloudflare Git integrations use `egalmoh/hoysii` with production branch `main`. Each project installs from its own lockfile.

| Worker | Root directory | Build command | Git integration deploy command | Domain |
| --- | --- | --- | --- | --- |
| `hoysii-web` | `apps/traveler` | `npm run build:web` | `npx wrangler deploy` | `hoysii.com`, `www.hoysii.com` |
| `hoysii-admin` | `apps/admin` | `npm run build:cloudflare` | `npx wrangler deploy` | `admin.hoysii.com` |
| `hoysii-api` | `services/api` | None | `npx wrangler deploy` | `api.hoysii.com` |

These deploy commands are settings for Cloudflare's Git integration, not instructions for Codex to run a manual deployment. The owner pushes and merges through GitHub. Native iOS/Android releases remain separate from the web deployment.

### Traveler web release

The web Worker serves the production Expo export in `dist/`, including a single-page fallback for direct links and refreshes. It has no database or authentication secret bindings. It calls the existing API, which owns D1, R2 and separate traveler/admin sessions. Set the public build variable `EXPO_PUBLIC_API_URL=https://api.hoysii.com` in the web Git build settings; this is also the app's default. Never put server secrets in an `EXPO_PUBLIC_*` variable.

Locally, run `npm run build:web`, then `npm run preview:web` from `apps/traveler` to inspect the production assets at `http://localhost:4173`. The public API only allows configured Hoysii origins; localhost is not equivalent to the production site for cross-origin authentication testing. Development payment previews are disabled in this production export.

The owner must merge the API allowed-origin change with the web release so both `https://hoysii.com` and `https://www.hoysii.com` can authenticate and call the API. No database migration is required. After the first successful Git build, verify the two custom domains in Cloudflare. If an old website CNAME conflicts, replace only that website record; preserve mail and other subdomains. Check live search, hotel/room views, direct-link refreshes, email verification/sign-in/sign-out and Trips. Real online payment remains unavailable until a payment provider is connected.

The existing standalone admin checkout remains available until its Git build connection has been switched and the new build verified. Do not point both Workers at the same project root. Changing Git build connections and production deployments is a separate release step; this repository reorganization does not change the live services by itself.
