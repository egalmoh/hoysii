# Stakeholder hotel catalog — 2 November 2026

The owner requested these 15 hotels and explicitly chose **simulated rooms for stakeholder testing only**. They also confirmed that “Bosaso Beach Hotel” means **Bosaso Airport Hotel**. These entries do not establish hotel partnerships, current operating status, real room allocations, contracted prices or Hoysii verification.

The catalog is prepared locally, not imported into production. It uses the existing API, D1 and R2; no second deployed app or database is introduced.

The four old `Hoysii Test Stay` stock-photo listings (Bosaso, Garowe, Mogadishu and Hargeisa) are retired by their exact IDs in the API, including during stakeholder testing. They no longer appear in traveler/admin/partner hotel lists or active hotel/room dashboard totals, cannot receive new bookings or replacement reservations, and are excluded from quotes, availability and saved-hotel results. Their database rows remain only to preserve existing booking/receipt references. The old seed script was removed. This retirement adds no migration or production cleanup step; it takes effect with the API's normal GitHub release and leaves the 15 requested hotel entries unchanged.

## Prepared listings

| Hotel | City | Photo source / remaining check |
| --- | --- | --- |
| Jowhara International Hotel | Mogadishu | Official site |
| Amara Hotel | Mogadishu | Official site |
| Décalé Airport Hotel | Mogadishu | Official site and standard-room page |
| Grand Plaza Hotel | Mogadishu | Official site |
| Lana Business Park | Mogadishu | Official site; unrelated spam discarded |
| Aven Premier International | Mogadishu | Property-specific Tripadvisor photo; official site under maintenance |
| Peace Hotel | Mogadishu | Official brand site; confirm precise branch during onboarding |
| Bosaso Airport Hotel | Bosaso | Official site; explicitly AI-named assets excluded |
| Jabir Plaza Hotel | Bosaso | Official site |
| Elite Hotel | Mogadishu | Official site; current operations need direct confirmation |
| Cadduun Hotel Galkacyo | Galkacyo | Correct Galkacyo image found in search but unavailable to download; placeholder used |
| Serene Sarovar Premiere Hargeisa | Hargeisa | Official operator gallery; spelling corrected |
| Jees Hotel | Hargeisa | Official site |
| Damal Hotel Berbera | Berbera | Property identified; accessible candidate was a logo, so placeholder used |
| Safari Resort & Convention Centre | Borama | Property-specific Tripadvisor photo; not the similarly named South African hotel |

Full source URLs, public contact details, photo captions and research limitations are in `services/api/data/stakeholder-hotels.json`. Photographs were visually checked and compressed into `services/api/data/stakeholder-hotel-media/`; the original source link stays alongside each image. Public availability of a photo does not establish a redistribution license: confirm supplied media/permission during hotel onboarding before a real launch.

## Recommended section

The owner selected these hotels, in this order: Amara, Décalé Airport Hotel, Safari Resort, Bosaso Airport Hotel, Elite, Serene Sarovar Premiere, Jees, Cadduun Galkacyo and Jowhara. The API supplies `is_recommended` and `recommended_order` from `services/api/src/recommendations.js`; the traveler app places these selections first and retains the existing recommendations for hotels rated at least 4.5. Selection does not create a rating, change verification or bypass stakeholder-only visibility. Matching uses stable catalog IDs, with exact property-name/city aliases for existing onboarded entries; Cadduun Garowe is not selected as Cadduun Galkacyo. No additional schema migration is required for recommendations.

## Simulated rooms and safeguards

Each property has two explicitly named sample room types: Sample Double Room ($30/night, 5 units, capacity 2 adults) and Sample Family Room ($50/night, 3 units, capacity 4 adults). These are test inputs, not researched hotel rates or availability. Only actual room photos illustrate room types; other photos remain in the hotel gallery. Missing images use placeholders.

All 15 hotels have `stakeholder_only=1`, remain unverified and have no invented rating or operational manager email. They appear in traveler search/details while the server enables `STAKEHOLDER_TESTING=true`; turning it off removes them from discovery, saved-hotel results, direct detail/review requests, quotes and availability. Existing saved booking history remains intact. API and database guards reject real reservations, real reservation reassignments and real payouts against these sample rooms/hotels. Existing test settlement, receipt, Trips, admin/partner, review and original cancellation flows are reused.

The import is additive and repeatable. It does not overwrite prices, photos, rooms, verification or partner assignments on existing records. An existing exact same-name/same-city hotel is skipped rather than converted into a simulated property. No invitations, account creation or reservation emails are sent by the import.

## Owner release steps

Codex has not pushed, deployed, uploaded R2 media or changed production D1.

1. Review and apply the additive schema migration **before the matching API release**:

   ```sh
   cd /Users/cigaal/Documents/hoysii/hoysii/services/api
   npx wrangler d1 migrations apply hoysii --remote
   ```

   Migration `0008_stakeholder_hotels.sql` adds the hotel flag and guards only; it does not insert the new listings. Earlier migrations must already be applied.

2. Push development and merge through your usual GitHub PR process. Wait for Cloudflare's **API**, **traveler web** and **admin** Git builds to succeed. Confirm `https://api.hoysii.com/v1/config` reports both `stakeholder_testing: true` and `stakeholder_catalog: true`. Installed native apps need your normal mobile update/build to receive the search/placeholder changes.

3. Validate the import locally, then run the owner-controlled import:

   ```sh
   node scripts/import-stakeholder-hotels.mjs --dry-run
   node scripts/import-stakeholder-hotels.mjs --remote
   ```

   The second command uploads the checked image files to the existing `hoysii-hotel-media` R2 bucket, then applies `scripts/seed-stakeholder-hotels.sql` to the existing `hoysii` D1 database. It refuses to import unless the live API reports the new catalog guards and testing enabled. It also checks the schema before uploading. No manual Worker deployment is involved. If interrupted, fix the reported problem and rerun; previously imported hotel/room data is preserved.

4. Refresh the traveler app, search each city and complete a sample booking. The same test reference should appear in Trips and admin. Invite/assign a stakeholder partner account to each property you want to exercise through Admin → Partners; the import intentionally grants no account access. The assigned hotel partner then sees that property's test reservations.

5. Keep testing enabled during stakeholder sessions. Before real launch, collect actual property/room details, rates, room allocations, media permission and current operating confirmation. These sample entries remain test-only; switching the server flag off does not promote them to real hotels.

To regenerate SQL after deliberately editing the source catalog, run `node scripts/prepare-stakeholder-hotels.mjs`; this prepares a file only and never changes Cloudflare.
