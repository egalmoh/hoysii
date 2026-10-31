# Hoysii

This repository keeps the traveler app, admin panel, and API together as separate projects. Each has its own dependencies, lockfile, build, and deployment. They communicate through the API; they do not share admin and traveler sessions.

| Project | Source | Runs as |
| --- | --- | --- |
| Traveler app | `apps/traveler/` | Expo on iOS, Android, and web |
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

Cloudflare Git builds should point `hoysii-api` at this repository with root directory `services/api`, and `hoysii-admin` at this repository with root directory `apps/admin`. The API deploy command is `npx wrangler deploy`. The admin build command is `npm run build:cloudflare`, followed by `npx wrangler deploy`. These are two distinct Workers with separate runtime secrets and routes. The traveler web and native releases have their own build configuration; moving the Expo source to `apps/traveler` means their project root must be updated to that directory.

The existing standalone admin checkout remains available until its Git build connection has been switched and the new build verified. Do not point both Workers at the same project root. Changing Git build connections and production deployments is a separate release step; this repository reorganization does not change the live services by itself.
