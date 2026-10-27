# Hoysii Operations

## Operating principle
**Automate normal cases. Humans handle exceptions.**

Staff should not manually coordinate every booking.

## Booking lifecycle
Recommended statuses:
1. Pending
2. Payment Pending
3. Paid
4. Hotel Confirmation Pending
5. Hotel Confirmed
6. Arrival Scheduled
7. Driver Assigned
8. Ready for Arrival
9. Picked Up
10. Checked In
11. Completed

Exception states:
- Payment Failed
- Hotel Declined
- Room Unavailable
- Driver Missing
- Flight Delayed
- Customer Cancelled
- Hotel Cancelled
- Refund Pending

## Hotel confirmation
Every hotel receives:
- Booking ID
- Guest
- Dates
- Room
- Guest count
- Payment status
- Pickup
- Special requests

Track:
- Sent time
- Viewed time
- Confirmed time
- Declined time

If confirmation exceeds SLA, create an exception.

## Inventory
MVP:
- Instant booking for trusted hotels with reliable inventory
- Confirmation-required booking for less mature partners

Later:
- PMS / channel-manager integrations

## Arrivals dashboard
Example:
| Time | Guest | Flight | Hotel | Driver | Status |
|---|---|---|---|---|---|
| 10:25 | Ahmed | TK646 | Jazeera | Hassan | Ready |
| 11:40 | Amina | ETxxx | Decale | Abdi | Ready |
| 14:10 | Ali | QRxxx | Hotel X | Unassigned | Attention |

Operations must instantly see:
- Flight
- Hotel
- Driver
- Payment
- Hotel confirmation
- Pickup status

## Flight data
Customer provides:
- Flight number
- Arrival date

Save:
- Airline
- Flight number
- Departure airport
- Arrival airport
- Travel date
- Scheduled arrival
- Estimated arrival
- Actual arrival
- Status

Internal abstraction:
```ts
FlightService.getFlight({
  flightNumber,
  date
})
```

Suggested checks:
- On addition: verify once
- 48h before: recheck
- 12h before: recheck
- 6h before: closer monitoring
- After departure: monitor ETA
- Near landing: update driver

## Airport transfer
Transfer record:
- Customer
- Booking
- Airport
- Hotel
- Flight
- Scheduled pickup
- Driver
- Vehicle
- License plate
- Contacts
- Status

Statuses:
- Unassigned
- Driver Assigned
- Driver Accepted
- En Route
- At Airport
- Passenger Located
- Picked Up
- At Hotel
- Completed
- Failed

## Exceptions page
Central queue for:
- Hotel not confirmed
- Payment succeeded but reservation failed
- Arrival soon with no driver
- Flight delayed
- Driver not acknowledged
- Guest not picked up
- Guest not checked in
- Hotel cancelled
- Inventory mismatch

Each exception needs:
- Severity
- Booking
- Owner
- Created time
- SLA / due time
- Resolution status
- Notes

## Customer recovery
If hotel says there is no room:
1. Verify issue
2. Find equivalent or better hotel
3. Move customer if needed
4. Handle price difference per policy
5. Record hotel incident
6. Follow up with customer

Promise:
> If something goes wrong, Hoysii solves it.

## Admin navigation
```text
OVERVIEW
- Dashboard

OPERATIONS
- Bookings
- Arrivals
- Departures
- Trips
- Airport Transfers
- Exceptions

SUPPLY
- Hotels
- Rooms
- Availability
- Rates

CUSTOMERS
- Customers
- Support
- Reviews

FINANCE
- Payments
- Hotel Payouts
- Refunds
- Commissions

GROWTH
- Promo Codes
- Creators
- Referrals
- Campaigns

SYSTEM
- Users & Roles
- Notifications
- Audit Logs
- Settings
```

## Admin dashboard
Prioritize operational attention:
- Arrivals today
- Pickups today
- Unconfirmed hotels
- Payment problems
- Unassigned drivers
- Open exceptions

## Booking detail
Show:
- Booking
- Customer
- Hotel
- Room
- Dates
- Value
- Payment
- Hotel confirmation
- Flight
- Pickup
- Driver
- Check-in
- Support history

Include an activity timeline.

## Hotel reliability
Track internally:
- Confirmation speed
- Cancellation rate
- Booking failures
- Guest complaints
- Check-in problems
- Review score
- Refund rate

## Roles
- Super Admin
- Operations
- Customer Support
- Finance
- Hotel Manager
- Hotel Receptionist
- Driver Coordinator
- Driver
- Marketing

## MVP operating model
Start with:
- Mogadishu
- 10–20 verified hotels
- 3–5 reliable driver partners
- Small operations team
- Strong status tracking
- Manual exception handling

Learn from the first 100–200 completed bookings before automating everything.
