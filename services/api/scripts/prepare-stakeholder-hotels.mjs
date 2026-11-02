// Offline SQL preparation only. This command does not contact Cloudflare or change a database.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const catalogURL = new URL('../data/stakeholder-hotels.json', import.meta.url);
const outputURL = new URL('./seed-stakeholder-hotels.sql', import.meta.url);
const quote = value => value == null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;

export function catalogSQL(catalog) {
  const ids = new Set();
  const statements = ['-- Generated from data/stakeholder-hotels.json. Owner imports after migration 0008 and API deployment.', '-- Sample rates/quantities only. Existing hotels, prices, verification and partner accounts are never updated.'];
  const sim = catalog.simulation;
  for (const hotel of catalog.hotels) {
    if (!/^catalog-[a-z0-9-]+$/.test(hotel.id) || ids.has(hotel.id)) throw new Error('Catalog IDs must be unique and use the reserved catalog- prefix.');
    ids.add(hotel.id);
    const photos = hotel.photos.filter(photo => photo.r2_key && !photo.status);
    const images = photos.map(photo => `https://api.hoysii.com/v1/media/${photo.r2_key}`);
    const description = `Stakeholder testing only. Room types, rates and availability are simulated; no real stay is reserved. ${hotel.description}`;
    const fields = ['id','name','city','address','description','starting_price_cents','images','amenities','is_verified','rating','stakeholder_only'];
    const values = [hotel.id,hotel.name,hotel.city,JSON.stringify(hotel.address),description,sim.nightly_rates_usd[0]*100,JSON.stringify(images),JSON.stringify(hotel.amenities),0,null,1];
    statements.push(`INSERT OR IGNORE INTO hotels (${fields.join(',')}) SELECT ${values.map(quote).join(',')} WHERE NOT EXISTS (SELECT 1 FROM hotels WHERE lower(trim(name))=lower(${quote(hotel.name)}) AND lower(trim(city))=lower(${quote(hotel.city)}));`);
    for (let i=0;i<2;i++) {
      const price=sim.nightly_rates_usd[i]*100,units=sim.unit_counts[i],capacity=sim.adult_capacities[i];
      if (![price,units,capacity].every(n => Number.isSafeInteger(n)&&n>0)) throw new Error('Invalid simulated room settings.');
      // Only actual room photos may illustrate the simulated room types; no exterior/lobby substitution.
      const roomImages=photos.filter(photo=>/room|suite/i.test(photo.caption)).map(photo=>`https://api.hoysii.com/v1/media/${photo.r2_key}`);
      const values=[`${hotel.id}-room-${i+1}`,hotel.id,sim.room_names[i],price,units,capacity,JSON.stringify(roomImages),'[]'];
      statements.push(`INSERT OR IGNORE INTO rooms (id,hotel_id,name,price_cents,total_units,capacity_adults,images,amenities) SELECT ${values.map(quote).join(',')} WHERE EXISTS(SELECT 1 FROM hotels WHERE id=${quote(hotel.id)} AND stakeholder_only=1);`);
    }
  }
  return `${statements.join('\n')}\n`;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog=JSON.parse(await readFile(catalogURL,'utf8'));
  await writeFile(outputURL,catalogSQL(catalog));
  console.log(`Prepared ${catalog.hotels.length} hotels and ${catalog.hotels.length*2} simulated room types. No database changed.`);
}
