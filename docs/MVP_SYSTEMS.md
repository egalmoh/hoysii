# Current MVP systems — 2 November 2026

The owner explicitly approved the three product screenshots and their annotations as the current scope, including the full basic hotel portal. This document supersedes older flight/driver/transfer plans. Unrelated future work stays in `later.md`.

## Implemented interfaces

| Surface | Current additions |
| --- | --- |
| Traveler — Expo iOS / Android / web | Profile settings (name, optional phone, read-only verified email), Notifications removed, saved hotels, search price/amenity/Verified filters and price/name sorting, reviews for owned paid confirmed/checked-in/completed bookings, published guest reviews on hotel pages |
| Hoysii admin — `apps/admin` | Consolidated operational/recorded-finance overview at `/`; existing hotel manager moved intact to `/hotels`; partner invitations and hotel assignments; review hide/restore with reason; manual payout records |
| Hotel portal — `apps/partners` | Invitation-only separate Better Auth accounts, email code verification/password reset, assigned hotels, paid reservations, hotel acknowledgement/decline, check-in/completion, room CRUD, rates/unit counts/guest capacity, per-night remaining units, outside-booking/maintenance blocks, property/contact/amenity/photo/stay-time editing, payout-status viewing |

The existing admin Verified checkbox and badges remain. No inspections workflow or separate Hoysii Verified subsystem is added. Property edits in the partner portal cannot set verification, rating or cancellation terms. Support stays on WhatsApp.

The owner-requested 15-hotel stakeholder catalog is prepared separately in [HOTEL_CATALOG.md](HOTEL_CATALOG.md), with 30 simulated room types and checked source photos. Its properties are test-only, unverified, hidden outside server testing mode, and require the owner's schema/media/data import after the matching Git deployments. The traveler desktop header uses the supplied branded wordmark.

## Accounts and hotel assignments

A hotel assignment connects an invited partner email to a hotel ID. Example: `manager@example.com → Hotel A`. The same partner may have several assignments, but every hotel, reservation, room, block and payout request is checked against active assignments. Hotel A access never implies Hotel B access. Changing access revokes partner sessions immediately.

Travelers use `/api/auth` and traveler tables/cookies/secrets. Staff use `/api/admin-auth` and admin tables/cookies/secrets. Partners use `/api/partner-auth` and partner tables/cookies/`PARTNER_AUTH_SECRET`. An admin can assign hotels but cannot use an admin session as a partner session. Browser origins are scoped to the matching API surface, including when the same browser holds all three session cookies. Partner signup creates an account only for invited emails; the partner chooses their own password. Better Auth may return a generic signup response for uninvited addresses to prevent account enumeration.

Partners receive guest name, stay dates, room/guest counts and operational response/status fields. They do not receive traveler auth records, email/phone, payment/receipt details, internal notes or exceptions. Payout responses omit staff notes. Public review authors show first name only, never email or booking references.

## Booking/payment boundaries

The current stakeholder mode saves shared `is_test` bookings in the existing D1 database. All signed-in travelers can complete simulated checkout while the API's `STAKEHOLDER_TESTING` flag is `true`. Travelers see the normal confirmation, Trips, receipt and stay-progress interfaces; admin and the assigned hotel see the same booking with a test marker. Test inventory pools, funds and reviews remain separate from live data, and no test reservation emails are sent. Earlier account-scoped AsyncStorage mocks remain historical device-local records; new checkout no longer uses them. See `STAKEHOLDER_TESTING.md` for migration 0007, exact release steps and the stakeholder walkthrough.

The real backend path is ready for a future payment adapter: an actual recorded payment confirms the traveler immediately, starts the internal 30-minute acknowledgement timer and makes the paid booking visible to staff and the assigned hotel. A hotel decline raises an exception without changing the traveler's confirmed display. Hoysii operations handles replacement/refund. Gateway initiation/settlement/refund integration and live provider testing remain deferred until actual APIs are available.

Payout entries are records of separately arranged transfers: scheduled → paid/cancelled, with an actual transaction reference required for paid. They do not send money, calculate commission or automatically settle hotels. The dashboard sums successful USD payment ledger entries and completed refunds. Net received means payments minus completed refunds, not profit or a bank balance; paid payouts are displayed separately. Unreconciled historical bookings without ledger entries are excluded.

## Reviews and search

One review per saved booking, with 1–5 stars and 10–1,000 characters. The owning traveler can edit it; editing cannot unhide a moderated review. Cancelled/refunded/non-owned/unpaid bookings and historical device-local mocks are ineligible. Server-saved stakeholder bookings can exercise isolated test reviews while testing is enabled. Public lists/averages include visible reviews still tied to an eligible booking at that hotel. Reviews of confirmed bookings are labelled as from booked guests, not as proof the stay was already completed.

Search filters operate on the API's returned matching hotels after date/guest availability filtering. The existing recommended order remains the default. Global date selection continues allowing future dates; the chosen room/property inventory determines availability. Filtering/saving does not reserve a room.

## API additions

| Route | Access |
| --- | --- |
| `GET/PATCH /v1/me` | Traveler profile; email cannot be changed by this endpoint |
| `GET /v1/me/reviews` | Own eligible stays and existing reviews |
| `POST /v1/bookings/:id/review` | Own eligible stay; create/edit |
| `GET /v1/hotels/:id/reviews?offset=0` | Public, 20 reviews per page, rating/count |
| `GET /v1/me/saved-hotels` | Own saved hotels |
| `POST/DELETE /v1/me/saved-hotels/:hotelId` | Save/remove own favorite |
| `GET /v1/admin/dashboard` | Staff overview |
| `GET/POST /v1/admin/partners` | Staff list/assign/invite/resend invitation |
| `PATCH /v1/admin/partners/:assignmentId` | Enable/disable hotel access and revoke sessions |
| `GET /v1/admin/reviews`, `PATCH /v1/admin/reviews/:id` | Staff moderation |
| `GET/POST /v1/admin/payouts`, `PATCH /v1/admin/payouts/:id` | Staff manual payout records |
| `GET /v1/partner/me`, `GET /v1/partner/hotels` | Partner identity and active assignments |
| `GET/PATCH /v1/partner/hotels/:id` | Assigned property details / room list |
| `GET /v1/partner/hotels/:id/reservations` | Assigned property's paid reservations |
| `POST /v1/partner/bookings/:id/acknowledgement` | Acknowledge or decline with note |
| `POST /v1/partner/bookings/:id/stay` | Check-in / completed transition with note |
| `POST /v1/partner/hotels/:id/rooms`, `PATCH/DELETE /v1/partner/rooms/:id` | Assigned hotel room types; historic rooms cannot be deleted |
| `GET /v1/partner/rooms/:id/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` | Per-night remaining units, up to 62 days; checkout excluded |
| `GET/POST /v1/partner/rooms/:id/blocks`, `DELETE /v1/partner/inventory-blocks/:id` | Outside bookings / maintenance closures |
| `POST /v1/partner/media` | JPEG/PNG/WebP/AVIF to R2, up to 8 MB |
| `GET /v1/partner/hotels/:id/payouts` | Assigned hotel's manual payout status |

## Owner release steps — no manual Codex deployment

### Traveler web installation (PWA)

At web widths of 768px and above, the traveler app uses one shared header with Hoysii branding, centered destination/date/guest search, and Trips/Profile navigation on the same row. It adds no host links or category navigation. Explore and search results use compact square hotel cards in responsive columns, with the existing recommended carousel and Popular Stays inventory. Search editing opens the same modal at a bounded desktop width. Hotel details, checkout, payments, confirmation, Trips and profile use readable content widths. Below 768px the existing mobile navigation/search layout remains; native iOS/Android retain their original layout. These are presentation changes only: availability, rates, cancellation rules, authentication and stakeholder payment behaviour are unchanged.

The traveler web export includes a manifest, home-screen icons from the existing Hoysii brand mark, Apple home-screen metadata and a web-only **Install Hoysii** option on the Profile/Log in tab. Supporting Android/desktop browsers show their native install prompt when available; iPhone/iPad users receive Share → Add to Home Screen instructions. The option disappears in an installed standalone window. Native iOS/Android layouts remain unchanged.

This is an online PWA: search, availability, authentication and bookings still use the existing API. No service worker or offline response cache is added, so availability/account responses are not saved for offline replay. The existing Cloudflare traveler Git build (`npm run build:web` in `apps/traveler`) copies `public/` into the exported site. Push/merge through the owner's normal release process; no database migration, new secret or separate PWA hosting is required. After deployment, verify installation and standalone launch on Android Chrome and iPhone Safari at `https://hoysii.com`. Local preview can check the manifest, assets and UI; it does not prove physical-phone installation.

### Other systems

1. Apply **`0006_partner_reviews_dashboard.sql`** to the existing D1 database before the matching API/admin/traveler release. From `services/api`, the owner runs `npx wrangler d1 migrations apply hoysii --remote`. Review the SQL first. It adds tables and retains existing records. Codex has not run this against production.
2. Add a new random **`PARTNER_AUTH_SECRET`** (at least 32 characters) to the API Worker's secrets in Cloudflare. Never reuse traveler/admin secrets. Code config includes `PARTNER_PANEL_URL=https://partners.hoysii.com`, which also supplies the exact partner CORS/trusted origin. Existing bindings/secrets remain needed.
3. Push the branch and merge through your normal GitHub PR process. Existing API/admin/traveler Cloudflare Git integrations update those services; Codex does not push or deploy.
4. In Cloudflare, connect a new **`hoysii-partners`** Worker to the same GitHub repository with root **`apps/partners`**, production branch `main`, build **`npm run build:cloudflare`**, Git deploy command **`npx wrangler deploy`**, and domain **`partners.hoysii.com`**. This deploy command is a Git-build setting, not a manual Codex action. Set public build variable `NEXT_PUBLIC_API_URL=https://api.hoysii.com`. The portal Worker has no auth secret, D1 or R2 binding; only the API holds those.
5. Native app changes require the normal mobile release/update process separately. Existing installed apps do not update when Cloudflare deploys.
6. After Git deployments, sign into admin, assign a partner email to its hotel, accept the invitation in the partner portal and verify its code. Check rates/blocks against traveler search; test acknowledgement/check-in/completion on an appropriate real recorded booking. Stakeholder checkout now creates a shared test booking for these steps; a real money transfer remains unimplemented.

For local development: run `npm ci` then `npm run dev` in `apps/partners` (port 3001). Set `NEXT_PUBLIC_API_URL` in an ignored `.env.local` for a local API if needed. Set `PARTNER_LOCAL_ORIGINS=http://localhost:3001` only in the local API's ignored `.dev.vars`; never broaden production origins for convenience. Existing automated API tests use in-memory SQLite and mock email acceptance, with no production writes or external email deliveries.

“Live authentication testing” means exercising the deployed website and native app with real email delivery, codes, sign-in/out, password reset and restored sessions; provider OAuth needs actual Google/Apple configuration. Local tests/builds do not guarantee inbox delivery or prove Apple sign-in is configured. Production browser/inbox checks remain an owner release step.
