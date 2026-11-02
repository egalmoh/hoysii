// Owner-run data import, not a deployment. Default is a read-only local validation.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { catalogSQL } from './prepare-stakeholder-hotels.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(await readFile(new URL('../data/stakeholder-hotels.json',import.meta.url),'utf8'));
const sqlURL=new URL('./seed-stakeholder-hotels.sql',import.meta.url);
if (await readFile(sqlURL,'utf8') !== catalogSQL(catalog)) throw new Error('Catalog SQL is stale. Run node scripts/prepare-stakeholder-hotels.mjs first.');
const media=new Map();
for (const hotel of catalog.hotels) for (const photo of hotel.photos) {
  if (!photo.r2_key || photo.status) continue;
  if (!/^stakeholder-hotel-media\/[a-f0-9]{64}\.jpg$/.test(photo.file)) throw new Error('Invalid local media path.');
  const file=new URL(`../data/${photo.file}`,import.meta.url);
  const bytes=await readFile(file);
  const key=`hotels/${createHash('sha256').update(bytes).digest('hex')}.jpg`;
  if (key!==photo.r2_key) throw new Error('Photo checksum mismatch.');
  media.set(key,fileURLToPath(file));
}
const args=process.argv.slice(2);
if (args.some(arg=>!['--remote','--dry-run'].includes(arg)) || (args.includes('--remote')&&args.includes('--dry-run'))) throw new Error('Use --dry-run (default) or --remote.');
console.log(`${catalog.hotels.length} hotels, ${catalog.hotels.length*2} simulated room types, ${media.size} photos. Existing records are never overwritten.`);
if (!args.includes('--remote')) {
  console.log('Validation passed. No Cloudflare services or database were changed. The owner can run with --remote after migration 0008 and API deployment.');
} else {
  const response=await fetch('https://api.hoysii.com/v1/config',{signal:AbortSignal.timeout(15000)});
  const config=await response.json();
  if (!response.ok || config.stakeholder_testing!==true || config.stakeholder_catalog!==true) throw new Error('Deploy the catalog API guards and enable STAKEHOLDER_TESTING before importing. Nothing uploaded.');
  const wrangler=fileURLToPath(new URL('../node_modules/.bin/wrangler',import.meta.url));
  function run(args) {
    const result=spawnSync(wrangler,args,{cwd:root,stdio:'inherit'});
    if (result.error || result.status!==0) throw new Error('Cloudflare import command failed. Correct the error and rerun; existing hotel/room records will not be overwritten.');
  }
  // Check schema before uploading media; never run migrations automatically.
  run(['d1','execute','hoysii','--remote','--command','SELECT stakeholder_only FROM hotels LIMIT 0']);
  for (const [key,file] of media) run(['r2','object','put',`hoysii-hotel-media/${key}`,'--file',file,'--content-type','image/jpeg','--remote']);
  run(['d1','execute','hoysii','--remote','--yes','--file',fileURLToPath(sqlURL)]);
  console.log('Stakeholder catalog imported. Assign partner accounts through Admin → Partners as needed.');
}
