# Hoysii Codex Context

Hoysii is a diaspora-first accommodation booking platform for travelers going to Somalia.

## Core journey
Discover → Search → Compare → Book → Confirm → Add Flight → Prepare → Arrive → Airport Transfer → Check-in → Stay → Review / Rebook

## Main product surfaces
1. Public website / SEO
2. Traveler booking app
3. Hotel partner portal
4. Internal admin / operations dashboard

## Current tech stack
- JavaScript and JSX for product code; React 19 and React Native 0.81.
- Expo SDK 54 for the traveler app on iOS, Android, and web, with Expo Router 6 routes under `apps/traveler/app/`.
- Next.js 16 for the admin panel under `apps/admin/`, deployed through OpenNext on its own Cloudflare Worker.
- A separate Cloudflare API Worker under `services/api/` provides traveler and admin routes, D1 data, and R2 hotel media.
- Better Auth uses separate traveler and admin accounts, sessions, cookies, and secrets. The traveler app uses Expo SecureStore for its session.
- React Native Web for the traveler web target.
- React Native `StyleSheet` and the Inter font for the current UI styling.
- React Native Reanimated and Lottie for motion and animation.
- npm with an independent `package-lock.json` in each project; this repository does not yet use shared npm workspaces.
- Public client configuration is supplied through `EXPO_PUBLIC_*` environment variables.

Do not replace or materially expand this stack without explicit user approval.

## Distribution
- Google Search + SEO
- TikTok / Instagram UGC
- Meta ads
- Influencers
- Retargeting
- Referrals
- Travel agencies as a secondary channel

## Product principles
- Trust is more important than maximum inventory.
- Verified, accurate hotel information matters.
- Avoid stale room availability.
- Customer flows should be simple and mobile-first.
- Admin tools should prioritize exceptions and arrivals.
- Hoysii owns customer problems when a hotel or driver fails.
- The customer should not coordinate separately with the hotel, driver, and support.
- SEO pages and booking should feel like one product.

## MVP focus
Start narrow, with Mogadishu as the first major destination.

## Traveler MVP
- Search
- Hotel results
- Hotel details
- Checkout + payment
- Booking confirmation
- Trip page
- Flight number + date
- Airport pickup
- Driver details including vehicle and license plate
- Support
- Reviews

## Admin MVP
- Dashboard
- Bookings
- Arrivals
- Hotels
- Transfers
- Customers
- Payments
- Exceptions

## Hotel portal MVP
- Reservations
- Availability
- Rooms
- Property profile

## Current repo structure
```text
apps/
  traveler/
  admin/
  partners/ (later)
services/
  api/
packages/
  (shared code only when needed)
```

Read the files in `docs/` before implementing major product flows.

The working name is Hoysii. Alternative names such as Somstays, Dega, or Hooy should not replace product identifiers unless explicitly requested.

## Implementation authorization
- This rule applies to every project under `/Users/cigaal/Documents/hoysii/hoysii`, the existing standalone `/Users/cigaal/Documents/hoysii/hoysii-admin` checkout during migration, and the software and connected services they use.
- Never implement anything unless the user explicitly and clearly tells you exactly which change to implement. Do not infer implementation permission from a discussion, an analysis request, or agreement with a recommendation.
- Default to read-only discussion, analysis, planning, diagnosis, and review.
- Do not create, edit, delete, rename, or generate project files unless the user clearly asks to implement that specific change.
- Do not install or update dependencies, run migrations or generators, change configuration or schemas, or apply suggested fixes without the same explicit authorization.
- A request to explain, recommend, inspect, research, review, or propose a plan is not permission to implement.
- Implementation permission applies only to the specific task for which it was given. Require a fresh, clear implementation request for each new task; do not carry authorization forward from an earlier request.
- The same explicit authorization is required for builds or commands that generate project files, database writes, deployments, and changes to connected services. When implementation scope is unclear, continue read-only analysis and ask for clarification before making changes.

## Deployment handoff
- Do not deploy Hoysii manually or push changes to GitHub. This applies to the traveler app, API Worker, admin panel, and other Hoysii surfaces.
- After an explicitly requested implementation, complete appropriate local checks, then tell the user the changes are ready for them to push to GitHub. The user handles the push. Cloudflare-connected services should build/deploy through their configured GitHub integration; identify any surface, such as a native app build, that needs a different release step.
- Do not run production migrations or make production service changes as part of this handoff. State clearly if a migration or manual production step is needed before the new code can work.
