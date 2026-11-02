// The server chooses the mode. Client flags and build type cannot enable simulated settlement.
export function stakeholderTesting(env) {
  return env.STAKEHOLDER_TESTING === 'true';
}
// Retired stock-photo fixtures. Keep their rows for existing booking/receipt references,
// but never offer them again, including while stakeholder testing is enabled.
export const RETIRED_HOTEL_IDS = Object.freeze([
  'hoysii-test-bosaso', 'hoysii-test-garowe', 'hoysii-test-mogadishu', 'hoysii-test-hargeisa',
]);
export function hotelRetired(id) {
  return RETIRED_HOTEL_IDS.includes(id);
}
export function hotelVisible(hotel, env) {
  return Boolean(hotel) && !hotelRetired(hotel.id) && (!hotel.stakeholder_only || stakeholderTesting(env));
}
export const TEST_PROVIDER = 'stakeholder_test';
