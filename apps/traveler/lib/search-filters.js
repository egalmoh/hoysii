export function filterHotels(hotels, filters = {}) {
  const min =
    filters.min === "" || filters.min == null ? null : Number(filters.min);
  const max =
    filters.max === "" || filters.max == null ? null : Number(filters.max);
  const results = hotels.filter((hotel) => {
    const price = Number(hotel.starting_price);
    return (
      (min == null || (Number.isFinite(price) && price >= min)) &&
      (max == null || (Number.isFinite(price) && price <= max)) &&
      (!filters.verified ||
        hotel.is_verified === true ||
        hotel.is_verified === 1) &&
      (filters.amenities || []).every((amenity) =>
        (hotel.amenities || []).includes(amenity),
      )
    );
  });
  if (filters.sort === "price_low")
    results.sort((a, b) => Number(a.starting_price) - Number(b.starting_price));
  if (filters.sort === "price_high")
    results.sort((a, b) => Number(b.starting_price) - Number(a.starting_price));
  if (filters.sort === "name")
    results.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return results;
}
