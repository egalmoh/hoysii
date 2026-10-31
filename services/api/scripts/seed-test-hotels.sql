-- Four clearly labeled, unverified test listings. Rates are $1 and photos are
-- illustrative stock imagery, not photos of properties in these cities.
-- Free Unsplash photo sources (license: https://unsplash.com/license):
-- Bosaso: https://unsplash.com/photos/a-well-lit-hotel-room-with-seating-and-a-desk-xQbmc2FnK3Y
-- Garowe: https://unsplash.com/photos/a-neatly-made-bed-in-a-modern-hotel-room-mNdhu5gl_P4
-- Mogadishu: https://unsplash.com/photos/a-hotel-room-with-a-bed-and-television-1b6fWdOEMM8
-- Hargeisa: https://unsplash.com/photos/a-cozy-bedroom-with-a-king-size-bed-and-blue-accents-A0-Gkbema_w

INSERT OR IGNORE INTO hotels (id, name, city, address, description, starting_price_cents, images, amenities, is_verified, payment_methods, security_features)
VALUES
  ('hoysii-test-bosaso', 'Hoysii Test Stay - Bosaso', 'Bosaso', '["Bosaso"]', 'Test listing only. This stock photo does not show a hotel in Bosaso. A booking here does not reserve a real stay.', 100, '["https://api.hoysii.com/v1/media/hotels/c8ebe803760001ce7e357ac9a5cb02ead66c70f5f1324f58034db8a20670cb2b.jpg"]', '["Test listing - no real stay"]', 0, '[]', '[]'),
  ('hoysii-test-garowe', 'Hoysii Test Stay - Garowe', 'Garowe', '["Garowe"]', 'Test listing only. This stock photo does not show a hotel in Garowe. A booking here does not reserve a real stay.', 100, '["https://api.hoysii.com/v1/media/hotels/7fdfa9b67d719ba09baa534961e2c941eee0798d003b255630130281f240627a.jpg"]', '["Test listing - no real stay"]', 0, '[]', '[]'),
  ('hoysii-test-mogadishu', 'Hoysii Test Stay - Mogadishu', 'Mogadishu', '["Mogadishu"]', 'Test listing only. This stock photo does not show a hotel in Mogadishu. A booking here does not reserve a real stay.', 100, '["https://api.hoysii.com/v1/media/hotels/cb6fd2a466136e4dc08d50b6f94a18c463c8bacba3c82222e237f649bc30a517.jpg"]', '["Test listing - no real stay"]', 0, '[]', '[]'),
  ('hoysii-test-hargeisa', 'Hoysii Test Stay - Hargeisa', 'Hargeisa', '["Hargeisa"]', 'Test listing only. This stock photo does not show a hotel in Hargeisa. A booking here does not reserve a real stay.', 100, '["https://api.hoysii.com/v1/media/hotels/f2b67958d6f030a2f51a20100f61e8fcac45eb4f7c233cd3dcd03ec922fb6b84.jpg"]', '["Test listing - no real stay"]', 0, '[]', '[]');

INSERT OR IGNORE INTO rooms (id, hotel_id, name, price_cents, amenities, images, capacity_adults, bed_size, total_units)
VALUES
  ('hoysii-test-room-bosaso', 'hoysii-test-bosaso', 'Test room - not a real stay', 100, '[]', '["https://api.hoysii.com/v1/media/hotels/c8ebe803760001ce7e357ac9a5cb02ead66c70f5f1324f58034db8a20670cb2b.jpg"]', 2, NULL, 1),
  ('hoysii-test-room-garowe', 'hoysii-test-garowe', 'Test room - not a real stay', 100, '[]', '["https://api.hoysii.com/v1/media/hotels/7fdfa9b67d719ba09baa534961e2c941eee0798d003b255630130281f240627a.jpg"]', 2, NULL, 1),
  ('hoysii-test-room-mogadishu', 'hoysii-test-mogadishu', 'Test room - not a real stay', 100, '[]', '["https://api.hoysii.com/v1/media/hotels/cb6fd2a466136e4dc08d50b6f94a18c463c8bacba3c82222e237f649bc30a517.jpg"]', 2, NULL, 1),
  ('hoysii-test-room-hargeisa', 'hoysii-test-hargeisa', 'Test room - not a real stay', 100, '[]', '["https://api.hoysii.com/v1/media/hotels/f2b67958d6f030a2f51a20100f61e8fcac45eb4f7c233cd3dcd03ec922fb6b84.jpg"]', 2, NULL, 1);
