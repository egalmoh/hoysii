import test from "node:test";
import assert from "node:assert/strict";
import { filterHotels } from "../lib/search-filters.js";
const hotels = [
  {
    id: "a",
    name: "A",
    starting_price: 60,
    amenities: ["Wifi", "Gym"],
    is_verified: true,
  },
  {
    id: "b",
    name: "B",
    starting_price: 30,
    amenities: ["Wifi"],
    is_verified: false,
  },
  {
    id: "c",
    name: "C",
    starting_price: 80,
    amenities: ["Gym"],
    is_verified: true,
  },
];
test("filters combine within available search results without mutating recommendation order", () => {
  assert.deepEqual(
    filterHotels(hotels, {
      min: "30",
      max: "60",
      verified: true,
      amenities: ["Wifi"],
    }).map((h) => h.id),
    ["a"],
  );
  assert.deepEqual(
    filterHotels(hotels, { sort: "price_low" }).map((h) => h.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    filterHotels(hotels, { sort: "price_high" }).map((h) => h.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    hotels.map((h) => h.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    filterHotels(hotels, { amenities: ["Wifi", "Gym"] }).map((h) => h.id),
    ["a"],
  );
});
