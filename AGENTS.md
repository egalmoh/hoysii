# Hoysii Codex Context

Hoysii is a diaspora-first accommodation booking platform for travelers going to Somalia.

## Core journey
Discover → Search → Compare → Book → Confirm → Check-in → Stay → Review

## Main product surfaces
1. Public website / SEO
2. Traveler booking app
3. Hotel partner portal
4. Internal admin / operations dashboard

## Current tech stack
- JavaScript and JSX for product code; React 19 and React Native 0.81.
- Expo SDK 54 for the traveler app on iOS, Android, and web, with Expo Router 6 routes under `apps/traveler/app/`.
- Next.js 16 for the admin panel under `apps/admin/` and hotel portal under `apps/partners/`, each built through OpenNext for its own Cloudflare Worker.
- A separate Cloudflare API Worker under `services/api/` provides traveler and admin routes, D1 data, and R2 hotel media.
- Better Auth uses separate traveler, admin and hotel-partner accounts, sessions, cookies, and secrets. Hotel access requires an active account-to-hotel assignment on every partner API request. The traveler app uses Expo SecureStore for its session.
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

## Existing cancellation rule
- Preserve free cancellation until 24 hours before check-in, with a deadline that updates when the selected dates change.
- After the cutoff, refund the total paid minus the saved first-night room rate. Do not replace this with a percentage penalty or generic support text without an explicit product change request.
- New bookings must show and save the same rule in the app and API. Existing bookings retain their saved terms.

## Traveler MVP
- Search
- Hotel results
- Hotel details
- Checkout + payment
- Booking confirmation
- Trip page
- Basic profile settings and saved hotels
- Filters and sorting
- Support
- Reviews

## Admin MVP
- Dashboard
- Bookings
- Arrivals
- Hotels
- Customers
- Payments
- Exceptions

## Hotel portal MVP
- Partner invitation, separate sign-in and account-to-hotel assignments
- Reservations and internal acknowledgement within 30 minutes
- Rooms, nightly rates, unit counts and inventory blocks
- Property profile, amenities, photos and stay times
- Check-in / check-out updates
- Viewing manually recorded payout status

## Current launch boundaries
- Keep the existing admin Verified checkbox/badges; the owner checks them during hotel onboarding. Do not add hotel inspections or a separate Hoysii Verified subsystem.
- Customer support stays on WhatsApp. Do not add a support-ticket system for launch.
- Preserve the existing mock-payment screen preview until provider APIs arrive. It creates no saved reservation, payment, Trip or hotel/admin record.
- A real recorded payment confirms the traveler immediately. Hotel acknowledgement remains internal; a decline or overdue response creates an operations issue without changing the customer confirmation flow.
- Reviews require an owned, saved, paid confirmed/checked-in/completed booking. No review can be created from a mock preview.
- Flights, airport pickup, drivers, apartments and experiences remain in `docs/later.md`.
- Read `docs/MVP_SYSTEMS.md` for the implemented interfaces, scope and owner release steps.

## Current repo structure
```text
apps/
  traveler/
  admin/
  partners/
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
