# Booking backend and release handoff

## Launch workflow

The traveler sees **Booking confirmed as soon as payment is recorded successfully**. Hotel acknowledgement is a separate internal state. It does not delay customer confirmation. If the room cannot be fulfilled, Hoysii handles replacement or refund through operations.

The implementation uses the existing API Worker, D1, Better Auth, email binding and admin app. No Premier Bank or Waafi gateway is connected. `payments.js` intentionally has no enabled provider or production mock. Unconfigured payment initiation returns `503 PAYMENT_PROVIDER_NOT_CONFIGURED`. There is no unsigned public payment-success callback.

## Release steps — performed by the owner

1. Before merging the code to the production branch, apply `services/api/migrations/0005_booking_operations.sql` to the existing D1 database. From `services/api`, the owner can run `npx wrangler d1 migrations apply hoysii --remote`. This is a production database write and is not run by Codex as part of the handoff.
2. Merge the API and admin changes together through the GitHub PR process. Their existing Cloudflare Git integrations build and deploy the two Workers. The API configuration includes a once-per-minute Cron Trigger.
3. Release the traveler JavaScript changes through the app's distribution process. Cloudflare deployment of the API/admin does not update an installed native app. No new native module is introduced by this change.
4. Check actual hotel notification emails, room quantities, rates, cancellation terms and check-in/out times before accepting a real stay. Public listings expose approved hotel fields only; manager contacts remain admin-only.

Migrations 0001–0004 were already applied at the earlier migration handoff. **0005 is new and has only been checked locally.** It adds columns, tables, indexes and inventory constraints. It retains existing accounts, bookings and legacy tables. Historical prices/terms are not reconstructed from today's hotel settings: older bookings without snapshots require manual reconciliation and cannot be settled through the new payment action.

During the schema/code rollout, avoid editing room stock or recording payments from an older admin build. The migration must precede the API release; verify both API and admin deployments before resuming those actions.

## Booking and inventory rules

- Prices are calculated on the server in integer USD cents. The existing checkout service fee is 10% of the nightly subtotal, rounded to the nearest cent. Quotes, booking totals and receipts use the same calculation.
- Each booking saves a stable `HYS-…` reference, guest counts, room and hotel snapshots, nightly rate, fee, currency and the agreed cancellation policy. Later rate/property edits do not rewrite it.
- A room hold lasts 15 minutes. Both availability queries and database constraints ignore expired unpaid holds even if the scheduled cleanup has not run yet.
- Each room row represents a room type with `total_units`. Occupancy is counted for every night in `[check_in, check_out)`; checkout itself does not consume a night.
- Inventory blocks represent closed rooms and outside reservations. They consume a stated number of units. Database triggers reject conflicting blocks, reservations, reassignment and stock reductions.
- General search allows future dates. Availability filtering happens in search results and the selected property's/room's calendar.
- Retrying the same booking request returns the same reservation. Reusing its key for a different room, dates or guest counts is rejected.

## Payment and receipt rules

An authenticated admin can record a genuinely received manual payment with exact amount/currency, provider name, transaction reference and supporting note. This records receipt of funds; it does not transfer funds. It replaces the old unqualified "Mark as Paid" operation.

Payment recording atomically creates the payment ledger entry, receipt snapshot, reservation update, activity entry and queued notifications. A provider/reference pair cannot pay two bookings, and a booking can have only one successful payment.

For delayed payments, inventory is checked again by database constraints. If the room is still free, the reservation is confirmed. If another reservation/closure now occupies it, funds and receipt are preserved while `recovery_required` and an exception flag Hoysii to act. Payment received after an unpaid cancellation creates a full refund request. It never silently takes another traveler's room.

Receipts are authenticated API records, not public files in R2. Travelers can retrieve only their own records. Receipt emails state receipt of payment; the email "sent" state means acceptance by the email provider, not a guarantee of inbox delivery.

When provider APIs arrive, implement their documented initiation, verification and refund operations behind `payments.js`. Verified settlement can call `settlePayment`; browser return URLs must never be accepted as proof of payment. Provider-specific signatures, event identifiers, failure handling, redirects/mobile prompts and refund behaviour still require their actual documentation and sandbox/live testing.

## Hotel acknowledgement and exceptions

- Payment starts a 30-minute hotel acknowledgement deadline and queues reservation details for the hotel's configured email plus an operations alert.
- Admin records acknowledgement or decline with a note. A future partner portal can use the same data and state transition rules; the portal itself remains in `later.md`.
- The scheduled handler raises an overdue exception, expires unpaid holds and retries queued notifications. Missing hotel contact details and exhausted delivery attempts are visible as exceptions.
- Operations can assign an exception, add notes, record the hotel's response, arrange a replacement at the customer's agreed total/terms, or cancel and start the refund workflow. Replacement should first be agreed with the traveler.
- Admin operations shows today's check-ins/check-outs, acknowledgement deadlines, open exceptions and refunds requiring action. Times use `Africa/Mogadishu`.

## Cancellation and refunds

Hotel policy settings include text, free-cancellation hours and the percentage penalty after the cutoff. Leave the free-cancellation window unset when the terms need manual review. Do not enter a percentage that contradicts the hotel's policy text. The agreed policy and cutoff are saved on booking; customer cancellation estimates use the request time rather than penalizing the customer for staff processing delay.

Cancellation releases stock. It does not mark money refunded. Refunds move through requested → approved → processing/completed, with failed → approved for a retry. Completing a manual refund requires its real transfer reference and a note. No gateway refund is sent without a provider adapter. Full and partial refunds update the payment status only after completion.

## API routes

| Route | Access / purpose |
| --- | --- |
| `GET /v1/rooms/:id/quote?check_in=…&check_out=…` | Public, current price/fee and cancellation terms |
| `POST /v1/bookings` | Traveler, creates a temporary hold and immutable booking snapshot |
| `GET /v1/bookings/:id` | Owning traveler, saved trip data and safe cancellation/refund progress |
| `POST /v1/bookings/:id/payments` | Owning traveler, provider initiation; currently returns not configured |
| `GET /v1/bookings/:id/receipt` | Owning traveler, payment receipt |
| `POST /v1/bookings/:id/cancellation` | Owning traveler, records a request and policy estimate |
| `GET /v1/admin/operations` | Admin, daily stays, deadlines, exceptions and refunds |
| `GET /v1/admin/bookings/:id` | Admin, full operational detail and activity |
| `POST /v1/admin/bookings/:id/payment` | Admin, records verified receipt of manual funds |
| `POST /v1/admin/bookings/:id/acknowledgement` | Admin, hotel acknowledgement/decline |
| `POST /v1/admin/bookings/:id/notes` | Admin, activity note |
| `POST /v1/admin/bookings/:id/reassign` | Admin, replacement room with capacity check |
| `POST /v1/admin/bookings/:id/cancel` | Admin, cancellation decision and refund due |
| `POST /v1/admin/bookings/:id/stay` | Admin, check-in/completion |
| `PATCH /v1/admin/refunds/:id` | Admin, refund transition and manual completion evidence |
| `PATCH /v1/admin/exceptions/:id` | Admin, owner, notes and resolution |
| `PATCH /v1/admin/rooms/:id` | Admin, name, rate, guest capacity and unit count |
| `GET/POST /v1/admin/rooms/:id/blocks` | Admin, list/add outside reservations and closed inventory |
| `DELETE /v1/admin/inventory-blocks/:id` | Admin, releases a stock block |

Admin writes require the independent admin session and a configured admin/localhost origin. Traveler sessions cannot access them. Traveler responses exclude internal hotel acknowledgement states and staff notes.

## Local validation

Run `npm test` and `npm run check` inside `services/api`; tests use in-memory SQLite with foreign keys, real migrations and transactional batches. They send no real emails and contact no payment provider. Admin checks are `npm run lint` and `npm run build:cloudflare`. Traveler bundles can be checked with `npx expo export --platform all --output-dir <temporary-folder>`.

Notification sending uses leases and retries with backoff, stopping after eight attempts. The outbox provides at-least-once sending: a crash after external email acceptance but before recording success can result in a duplicate email. Payment and receipt creation remain idempotent. Operations can see failed messages and contact the traveler/hotel manually.
