// Only affirmative API values may display a verification claim.
export function isHotelVerified(hotel) {
  return hotel?.is_verified === true || hotel?.is_verified === 1;
}

export function hotelOffers(hotel) {
  const saved = [hotel?.amenities, hotel?.security_features].flatMap((items) => Array.isArray(items) ? items : []);
  const seen = new Set();
  return saved.flatMap((value) => {
    if (typeof value !== 'string' || !value.trim()) return [];
    const label = value.trim();
    const id = label.toLowerCase().replace(/[\s_-]+/g, '');
    if (seen.has(id)) return [];
    seen.add(id);
    const icon = /wi[ -]?fi/i.test(label) ? 'wifi'
      : /gym|fitness/i.test(label) ? 'dumbbell'
      : /restaurant|dining/i.test(label) ? 'silverware-fork-knife'
      : /security|guard/i.test(label) ? 'shield-check-outline'
      : /air condition|\bac\b/i.test(label) ? 'air-conditioner'
      : 'check-circle-outline';
    return [{ id, label, icon }];
  });
}
