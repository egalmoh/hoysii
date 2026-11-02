// Owner-selected editorial recommendations, in the requested display order.
// These selections do not set star ratings, review averages or verification.
const selections = [
  { id: 'catalog-amara-mogadishu', names: ['Amara Hotel', 'Amara Hotel Mogadishu'], cities: ['Mogadishu', 'Moqadisho', 'Muqdisho'] },
  { id: 'catalog-decale-mogadishu', names: ['Decale Airport Hotel', 'Decale Hotel', 'Decale Hotel Mogadishu'], cities: ['Mogadishu', 'Moqadisho', 'Muqdisho'] },
  { id: 'catalog-safari-borama', names: ['Safari Resort & Convention Centre', 'Safari Resort and Convention Center', 'Safari Resort Convention Center', 'Safari Resort'], cities: ['Borama', 'Boorama'] },
  { id: 'catalog-bosaso-airport-bosaso', names: ['Bosaso Airport Hotel'], cities: ['Bosaso', 'Bossaso', 'Boosaaso'] },
  { id: 'catalog-elite-mogadishu', names: ['Elite Hotel'], cities: ['Mogadishu', 'Moqadisho', 'Muqdisho'] },
  { id: 'catalog-serene-sarovar-hargeisa', names: ['Serene Sarovar Premiere Hargeisa', 'Serene Sarovar Premiere Hotel', 'Serene Sarovar Premiere'], cities: ['Hargeisa', 'Hargeysa'] },
  { id: 'catalog-jees-hargeisa', names: ['Jees Hotel', 'Jees Hotel Hargeisa'], cities: ['Hargeisa', 'Hargeysa'] },
  { id: 'catalog-cadduun-galkacyo', names: ['Cadduun Hotel Galkacyo', 'Cadduun Hotel Galkaio', 'Cadduun Hotel', 'Caduun Hotel'], cities: ['Galkacyo', 'Gaalkacyo', 'Galkaio', 'Galkacayo'] },
  { id: 'catalog-jowhara-mogadishu', names: ['Jowhara International Hotel', 'Jowhara Hotel'], cities: ['Mogadishu', 'Moqadisho', 'Muqdisho'] },
];
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function recommendationOrder(hotel) {
  const index = selections.findIndex(selected => selected.id === hotel?.id || (
    selected.names.some(name => normalize(name) === normalize(hotel?.name)) &&
    selected.cities.some(city => normalize(city) === normalize(hotel?.city))
  ));
  return index < 0 ? null : index;
}
