import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localD1 } from './support/d1.js';
import worker from '../src/index.js';
import { createBooking, today } from '../src/booking-service.js';
import { addDays, citySearchTerms } from '../src/availability.js';
import { catalogSQL } from '../scripts/prepare-stakeholder-hotels.mjs';

const catalog=JSON.parse(readFileSync(new URL('../data/stakeholder-hotels.json',import.meta.url),'utf8'));
const seed=readFileSync(new URL('../scripts/seed-stakeholder-hotels.sql',import.meta.url),'utf8');
async function fixture() {
  const DB=localD1();
  await DB.exec(seed);
  await DB.exec(`INSERT INTO hotels(id,name,city) VALUES('real','Existing real hotel','Mogadishu');
    INSERT INTO rooms(id,hotel_id,name,price_cents,total_units) VALUES('real-room','real','Real room',9000,1);
    INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES('guest','Guest','guest@example.com',1,1,1);`);
  const env={DB,STAKEHOLDER_TESTING:'true'};
  const api=async path=>{const r=await worker.fetch(new Request(`https://api.hoysii.com${path}`),env);return {status:r.status,data:await r.json()}};
  return {DB,env,api};
}
test('catalog imports idempotently without overwriting owner edits or existing hotels',async()=>{
  const f=await fixture();try {
    assert.equal(seed,catalogSQL(catalog));
    await f.DB.exec("UPDATE rooms SET price_cents=7777 WHERE id='catalog-jowhara-mogadishu-room-1'");
    await f.DB.exec(seed);
    assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM hotels WHERE stakeholder_only=1').first()).n,15);
    assert.equal((await f.DB.prepare("SELECT COUNT(*) n FROM rooms WHERE hotel_id LIKE 'catalog-%'").first()).n,30);
    assert.equal((await f.DB.prepare("SELECT price_cents FROM rooms WHERE id='catalog-jowhara-mogadishu-room-1'").first()).price_cents,7777);
    assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM hotels WHERE stakeholder_only=1 AND (is_verified=1 OR rating IS NOT NULL OR manager_email IS NOT NULL)').first()).n,0);
    const galkacyo=(await f.api('/v1/hotels?city=Gaalkacyo')).data;
    assert.equal(galkacyo.length,1);
    assert.equal(galkacyo[0].name,'Cadduun Hotel Galkacyo');
    assert.ok(citySearchTerms('Boorama').includes('Borama'));
  }finally{f.DB.close()}
});
test('turning testing off hides simulated inventory from search, details, quotes, availability and reviews',async()=>{
  const f=await fixture();try {
    const hotel='catalog-jowhara-mogadishu',room=`${hotel}-room-1`;
    const start=addDays(today(),10),end=addDays(start,2);
    assert.equal((await f.api(`/v1/hotels/${hotel}`)).status,200);
    assert.equal((await f.api(`/v1/rooms/${room}/quote?check_in=${start}&check_out=${end}`)).data.total_price,66);
    assert.equal((await f.api('/v1/hotels')).data.length,16);
    f.env.STAKEHOLDER_TESTING='false';
    assert.deepEqual((await f.api('/v1/hotels')).data.map(h=>h.id),['real']);
    for(const path of [`/v1/hotels/${hotel}`,`/v1/hotels/${hotel}/reviews`,`/v1/rooms/${room}/quote?check_in=${start}&check_out=${end}`,`/v1/rooms/${room}/availability?check_in=${start}&check_out=${end}`])assert.equal((await f.api(path)).status,404,path);
    // Removing all real capacity must not be masked by the 15 simulated hotels.
    await f.DB.exec(`INSERT INTO inventory_blocks(id,room_id,start_date,end_date,units,reason,created_by,is_test) VALUES('block','real-room','${start}','${end}',1,'Maintenance','admin',0)`);
    const calendar=await f.api(`/v1/availability/calendar?from=${start}&to=${start}`);
    assert.deepEqual(calendar.data.unavailable_dates,[start]);
    assert.equal((await f.api(`/v1/hotels?check_in=${start}&check_out=${end}`)).data.length,0);
  }finally{f.DB.close()}
});
test('simulated rooms create test bookings only; SQL also blocks real bookings and payouts',async()=>{
  const f=await fixture();try {
    const room='catalog-jowhara-mogadishu-room-1';
    const body={room_id:room,check_in_date:addDays(today(),10),check_out_date:addDays(today(),12),adults:1};
    const booking=await createBooking(f.env,{id:'guest'},body,'test-request');
    assert.equal(booking.is_test,true);
    assert.equal(booking.total_price,66);
    assert.equal(booking.policy.free_cancellation_hours,24);
    assert.equal(booking.policy.penalty_type,'first_night');
    f.env.STAKEHOLDER_TESTING='false';
    await assert.rejects(createBooking(f.env,{id:'guest'},body,'real-request'),{status:404});
    await assert.rejects(f.DB.exec(`INSERT INTO bookings(id,user_id,hotel_id,room_id,check_in_date,check_out_date,total_cents,is_test) VALUES('forged','guest','catalog-jowhara-mogadishu','${room}','${body.check_in_date}','${body.check_out_date}',6600,0)`),/stakeholder_hotel_requires_test_booking/);
    await assert.rejects(f.DB.exec("INSERT INTO hotel_payouts(id,hotel_id,amount_cents,status,period_start,period_end,note,recorded_by,is_test) VALUES('payout','catalog-jowhara-mogadishu',100,'scheduled','2026-11-01','2026-11-02','Test','admin',0)"),/stakeholder_hotel_requires_test_payout/);
  }finally{f.DB.close()}
});

test('the four retired Hoysii Test Stay listings stay hidden in both modes while booking history survives',async()=>{
  const f=await fixture();try {
    const { RETIRED_HOTEL_IDS }=await import('../src/testing.js');
    const { dashboard, travelerFeatures }=await import('../src/product-features.js');
    for(const id of RETIRED_HOTEL_IDS){
      await f.DB.prepare('INSERT INTO hotels(id,name,city) VALUES(?,?,?)').bind(id,'Hoysii Test Stay','Mogadishu').run();
      await f.DB.prepare('INSERT INTO rooms(id,hotel_id,name,price_cents,total_units) VALUES(?,?,?,?,?)').bind(`${id}-room`,id,'Old test room',100,99).run();
      await f.DB.prepare('INSERT INTO saved_hotels(user_id,hotel_id) VALUES(?,?)').bind('guest',id).run();
    }
    const oldHotel=RETIRED_HOTEL_IDS[0],room=`${oldHotel}-room`,start=addDays(today(),10),end=addDays(today(),12);
    await f.DB.prepare("INSERT INTO bookings(id,user_id,hotel_id,room_id,check_in_date,check_out_date,total_cents,is_test,payment_status,booking_status) VALUES('old-test-booking','guest',?,?,?, ?,220,1,'paid','confirmed')").bind(oldHotel,room,start,end).run();
    for(const mode of ['true','false']){
      f.env.STAKEHOLDER_TESTING=mode;
      assert.ok((await f.api('/v1/hotels')).data.every(h=>!RETIRED_HOTEL_IDS.includes(h.id)));
      for(const id of RETIRED_HOTEL_IDS)assert.equal((await f.api(`/v1/hotels/${id}`)).status,404);
      assert.equal((await f.api(`/v1/rooms/${room}/quote?check_in=${start}&check_out=${end}`)).status,404);
      assert.equal((await f.api(`/v1/rooms/${room}/availability?check_in=${start}&check_out=${end}`)).status,404);
      await assert.rejects(createBooking(f.env,{id:'guest'},{room_id:room,check_in_date:start,check_out_date:end,adults:1},`new-${mode}`),{status:404});
      const url=new URL('https://api.hoysii.com/v1/me/saved-hotels');
      const saved=await travelerFeatures(new Request(url),f.env,url,{id:'guest'});
      assert.deepEqual(await saved.json(),[]);
    }
    const summary=await dashboard(f.env);
    assert.equal(summary.hotels,16); // 15 requested hotels plus the existing real property.
    assert.equal(summary.rooms,121);
    const history=await f.DB.prepare("SELECT b.id,h.name,r.name AS room_name FROM bookings b JOIN hotels h ON h.id=b.hotel_id JOIN rooms r ON r.id=b.room_id WHERE b.id='old-test-booking'").first();
    assert.equal(history.name,'Hoysii Test Stay');
    assert.equal(history.room_name,'Old test room');
  }finally{f.DB.close()}
});

test('the nine owner-selected recommendations are distinct from ratings and preserve the requested order',async()=>{
  const f=await fixture();try {
    const rows=(await f.api('/v1/hotels')).data;
    const selected=rows.filter(h=>h.is_recommended).sort((a,b)=>a.recommended_order-b.recommended_order);
    assert.deepEqual(selected.map(h=>h.id),[
      'catalog-amara-mogadishu','catalog-decale-mogadishu','catalog-safari-borama',
      'catalog-bosaso-airport-bosaso','catalog-elite-mogadishu','catalog-serene-sarovar-hargeisa',
      'catalog-jees-hargeisa','catalog-cadduun-galkacyo','catalog-jowhara-mogadishu',
    ]);
    assert.ok(selected.every(h=>h.rating===null && h.is_verified===false));
    const decale=(await f.api('/v1/hotels/catalog-decale-mogadishu')).data;
    assert.equal(decale.rooms.length,2);
    assert.equal(decale.hotel.stakeholder_only,true);
    assert.equal(decale.hotel.images.length,2);
    const {recommendationOrder}=await import('../src/recommendations.js');
    assert.equal(recommendationOrder({id:'existing-decale',name:'Décalé Airport Hotel',city:'Muqdisho'}),1);
    assert.equal(recommendationOrder({name:'Cadduun Hotel',city:'Garowe'}),null);
    assert.equal(recommendationOrder({name:'Safari Resort',city:'Rustenburg'}),null);
  }finally{f.DB.close()}
});
