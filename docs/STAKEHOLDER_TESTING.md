# Connected stakeholder testing — 2 November 2026

The owner approved connecting traveler, admin and hotel partner workflows, with simulated payments available to **all signed-in travelers during testing**. This is the normal Hoysii app and existing API/D1 database, not another app or deployed database.

## What works

Search → hotel/room → dates/guests → review price and original cancellation terms → select Waafi/Premiere Bank → Pay Securely → Booking confirmed → Trips → receipt. The API saves the same booking for the owner in admin and for the hotel's assigned partner. The partner acknowledges within 30 minutes, then records check-in and completion. The traveler sees stay progress and can exercise review creation/editing; admin can moderate those test reviews. Declines/overdue acknowledgements create internal exceptions without withdrawing the traveler's confirmed display. Admin can test replacement, cancellation, refund progress and manually recorded payout status.

The UI retains its existing design. Small test notices identify the simulation; there is no real provider authorization prompt or bank transaction. No payment credentials are collected by the simulator. Signing up, verifying email, signing in, profile settings, saved hotels and hotel/room management continue using their existing real account and data flows.

## Server control and boundaries

- `services/api/wrangler.jsonc` explicitly sets `STAKEHOLDER_TESTING` to the string `true` for this phase. Only the server selects booking mode. Web and native releases use the same API path, not a client development flag.
- New bookings, inventory blocks and payout records carry `is_test=1`. Existing records default to `0`. A booking's mode cannot be changed or promoted. The API rejects cross-mode management/payment actions.
- Simulated settlement is authenticated, restricted to the owning traveler and a test booking, and disabled when the flag is off. It uses the saved server amount, a stable `TEST-…` transaction reference and the existing atomic ledger/receipt/confirmation process. Repeated clicks do not duplicate payment or receipts. No public callback accepts “payment succeeded” for real bookings.
- Both inventory pools enforce per-night capacity, room holds and blocks. A test reservation or closure never consumes live room stock. Search and partner calendars show the currently selected server pool.
- Room/property information, nightly rates and unit counts are shared configuration, not simulated copies. Edits update the same hotel's data; stock/capacity reductions remain constrained by reservations in either pool. Use agreed demo properties when exercising those edits.
- Test payments/refunds/payouts never contribute to real dashboard money totals. Test receipts explicitly identify simulated funds. Completing a test refund/payout generates a test reference rather than evidence of a bank transfer.
- Test reviews require an owned, server-saved, paid confirmed/checked-in/completed test booking while testing is enabled. They can be viewed in the authenticated test-review section and moderated by admin; public reviews and rating averages always exclude them. A historical device-local mock cannot create one.
- Test bookings create no traveler/hotel/operations reservation emails. The notification sender also refuses accidentally queued test-booking messages. Authentication and explicitly requested partner invitations still use normal email delivery.
- Existing local mocks stay device-local in their separate Mock bookings section. New checkout does not create local mocks or upload old previews. Shared test bookings restore from the server across signed-in devices.

## Owner release steps

Codex has not pushed, deployed, applied production migrations, or created production test reservations.

1. Review `services/api/migrations/0007_stakeholder_testing.sql`. It adds test flags/indexes and updates inventory triggers; existing records remain real. Earlier migrations, including 0006, must be applied first.
2. Before the matching API release, run from Terminal:

   ```sh
   cd /Users/cigaal/Documents/hoysii/hoysii/services/api
   npx wrangler d1 migrations apply hoysii --remote
   ```

   This is an owner-run production migration. The prepared code has only been checked with the repository's local automated test harness.
3. Push your development branch and merge through your GitHub PR process. Cloudflare's existing Git integrations must deploy **API, traveler web, admin and partners**. Confirm the API deployment succeeds before testing checkout. The new traveler checkout requires `/v1/config` from the matching API release, so it will not silently create a reservation against an older API.
4. Confirm `https://api.hoysii.com/v1/config` reports `stakeholder_testing: true`. If a Cloudflare dashboard variable overrides the repository value, make it match intentionally. No new secrets or payment keys are needed.
5. Refresh the web app and panels. Run the current development app or use your normal mobile build/update process to distribute the new traveler JavaScript to native stakeholders. Cloudflare does not update installed native applications.
6. Invite the hotel's stakeholder email through admin and assign that account to the chosen hotel. Partner accounts and traveler accounts stay separate. Existing admin permissions are not expanded.

## Walkthrough after those deployments

1. Sign in as a traveler, choose an available room/dates and a payment method, and complete checkout. The page must show **Booking confirmed**, a normal HYS reference and a small stakeholder test notice.
2. Open Trips on the same or another signed-in device. Check the saved hotel, room, dates, guests, total and receipt. The receipt must identify test funds and a `TEST-…` transaction.
3. Open admin Bookings, select the Stakeholder tests filter and inspect the same HYS reference. Check the saved price/policy, pending acknowledgement and deadline. Real recorded-funds totals must remain unchanged.
4. Sign in to the assigned hotel portal, open Reservations and acknowledge the same booking. Record check-in, then completion. Another hotel's partner must not see or manage it.
5. Refresh traveler Trips. Check-in/completion should update; a completed stay belongs in Past stays. Open Review your stays, save a review and inspect its labelled test section on the hotel page. A signed-out visitor must not see that review or any rating change.
6. Use another test booking to exercise decline/overdue recovery, cancellation and refund status. A test refund is a state transition only, never a bank refund. Test payout records likewise move no money.

## Ending this phase

Set `STAKEHOLDER_TESTING` to `false` through your normal configuration/Git deployment process and check `/v1/config` again. Test records remain labelled and excluded from live inventory, funds and public reviews; they are never converted into actual payments or hotel obligations. Test settlement and management writes stop. Real online payments will remain unavailable until the documented bank/provider adapters, verified callbacks and refund APIs are implemented and tested with their actual credentials and sandbox/live environments.
