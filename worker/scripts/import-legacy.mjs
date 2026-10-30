// One-time Supabase -> Cloudflare D1/R2 import. Run from the worker directory.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const legacyURL = process.env.LEGACY_SUPABASE_URL?.replace(/\/$/, '');
const legacyKey = process.env.LEGACY_SUPABASE_SERVICE_KEY;
const apiURL = process.env.HOYSII_API_URL?.replace(/\/$/, '') || 'https://api.hoysii.com';
const wrangler = resolve('node_modules/.bin/wrangler');
if (!legacyURL || !legacyKey) throw new Error('Set LEGACY_SUPABASE_URL and LEGACY_SUPABASE_SERVICE_KEY privately.');
if (new URL(legacyURL).protocol !== 'https:' || new URL(apiURL).protocol !== 'https:') throw new Error('Production URLs must use HTTPS.');

async function legacy(table) {
  const response = await fetch(`${legacyURL}/rest/v1/${table}?select=*&limit=1000`, { headers: { apikey: legacyKey, Authorization: `Bearer ${legacyKey}` } });
  if (!response.ok) throw new Error(`Legacy ${table} read failed (${response.status}).`);
  return response.json();
}
function list(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return value.split(',').map((item) => item.trim()).filter(Boolean); }
}
function sql(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite number in legacy data.');
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}
function insert(table, columns, values) {
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.map(sql).join(', ')}) ON CONFLICT(id) DO NOTHING;`;
}
function runWrangler(args, temp) {
  const result = spawnSync(wrangler, args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env: { ...process.env, WRANGLER_LOG_PATH: join(temp, 'wrangler.log') } });
  if (result.error || result.status !== 0) throw new Error(`Wrangler ${args.slice(0, 3).join(' ')} failed; exit ${result.status ?? 'unknown'}.`);
}

const [hotels, rooms, users, bookings] = await Promise.all(['hotels', 'rooms', 'users', 'bookings'].map(legacy));
const hotelIds = new Set(hotels.map((item) => item.id));
const roomIds = new Set(rooms.map((item) => item.id));
const userIds = new Set(users.map((item) => item.id));
if (rooms.some((item) => !hotelIds.has(item.hotel_id)) || bookings.some((item) => !hotelIds.has(item.hotel_id) || !roomIds.has(item.room_id) || !userIds.has(item.user_id))) throw new Error('Legacy records contain broken references; import stopped.');
if (new Set(users.map((item) => item.email?.trim().toLowerCase())).size !== users.length) throw new Error('Legacy user emails are not unique.');

const temp = await mkdtemp(join(tmpdir(), 'hoysii-legacy-'));
const imageMap = new Map();
async function migrateImages(value) {
  const migrated = [];
  for (const source of list(value)) {
    if (typeof source !== 'string') throw new Error('Invalid legacy image URL.');
    if (imageMap.has(source)) { migrated.push(imageMap.get(source)); continue; }
    const parsed = new URL(source);
    const legacyHost = new URL(legacyURL).host;
    if (parsed.protocol !== 'https:' || parsed.search || parsed.hash || ![legacyHost, 'cadduunhotel.so'].includes(parsed.host)) throw new Error('Image source is outside the approved public hosts.');
    if (parsed.host === legacyHost && !parsed.pathname.startsWith('/storage/v1/object/public/')) throw new Error('Private legacy image path is not allowed.');
    const image = await fetch(source);
    if (!image.ok) throw new Error(`Legacy image read failed (${image.status}).`);
    const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
    const type = image.headers.get('content-type')?.split(';')[0];
    if (!types[type]) throw new Error(`Unsupported legacy image type: ${type}.`);
    const bytes = Buffer.from(await image.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) throw new Error('Legacy image exceeds 8 MB.');
    const key = `hotels/${createHash('sha256').update(bytes).digest('hex')}.${types[type]}`;
    const path = join(temp, `image-${imageMap.size}.${types[type]}`);
    await writeFile(path, bytes, { mode: 0o600 });
    runWrangler(['r2', 'object', 'put', `hoysii-hotel-media/${key}`, '--file', path, '--content-type', type, '--remote'], temp);
    const destination = `${apiURL}/v1/media/${key}`;
    imageMap.set(source, destination);
    migrated.push(destination);
  }
  return migrated;
}

try {
  const statements = [];
  for (const item of hotels) statements.push(insert('hotels',
    ['id', 'name', 'city', 'address', 'google_map_link', 'description', 'starting_price_cents', 'images', 'amenities', 'manager_phone', 'manager_email', 'manager_name', 'is_verified', 'rating', 'payment_methods', 'security_features', 'created_at'],
    [item.id, item.name, item.city, JSON.stringify(list(item.address)), item.google_map_link, item.description, Math.round(Number(item.starting_price || 0) * 100), JSON.stringify(await migrateImages(item.images)), JSON.stringify(list(item.amenities)), item.manager_phone, item.manager_email, item.manager_name, item.is_verified ? 1 : 0, item.rating, JSON.stringify(list(item.payment_methods)), JSON.stringify(list(item.security_features)), item.created_at]));
  for (const item of rooms) statements.push(insert('rooms',
    ['id', 'hotel_id', 'name', 'price_cents', 'amenities', 'images', 'capacity_adults', 'bed_size', 'total_units', 'created_at'],
    [item.id, item.hotel_id, item.name, Math.round(Number(item.price) * 100), JSON.stringify(list(item.amenities)), JSON.stringify(await migrateImages(item.images)), item.capacity_adults || 2, item.bed_size, item.total_units || 1, item.created_at]));
  for (const item of users) statements.push(insert('legacy_users',
    ['id', 'clerk_id', 'full_name', 'email', 'phone_number', 'role', 'created_at'],
    [item.id, item.clerk_id, item.full_name, item.email, item.phone_number, item.role, item.created_at]));
  for (const item of bookings) statements.push(insert('legacy_bookings',
    ['id', 'user_id', 'hotel_id', 'room_id', 'check_in_date', 'check_out_date', 'total_cents', 'payment_provider', 'transaction_reference', 'receipt_image_url', 'payment_status', 'booking_status', 'payout_held_until', 'created_at'],
    [item.id, item.user_id, item.hotel_id, item.room_id, item.check_in_date, item.check_out_date, Math.round(Number(item.total_price) * 100), item.payment_provider, item.transaction_reference, item.receipt_image_url, item.payment_status, item.status, item.payout_held_until, item.created_at]));
  const sqlPath = join(temp, 'import.sql');
  await writeFile(sqlPath, statements.join('\n') + '\n', { mode: 0o600 });
  runWrangler(['d1', 'execute', 'hoysii', '--remote', '--yes', '--file', sqlPath], temp);
  console.log(`Imported ${hotels.length} hotels, ${rooms.length} rooms, ${users.length} legacy users, ${bookings.length} legacy bookings, and ${imageMap.size} R2 images.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
