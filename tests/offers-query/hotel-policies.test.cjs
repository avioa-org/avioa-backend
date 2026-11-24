'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {readHotelPolicies}=require('../../src/modules/offers-query/hotel-policies.cjs');
const id='MASTER-5084431',hotels=[{id,name:'Irotama',destination:'Santa Marta'}];
const env={CAZADOR_API_URL:'http://172.18.0.1:8791',CAZADOR_API_TOKEN:'x'.repeat(48)};
const text='Se ofrece alojamiento gratuito a un máximo de 2 menores de hasta 2 años, siempre que ocupen la misma habitación que sus padres o tutores, utilizando las camas existentes.';
const payload=()=>({hotel:{id,nombre:'Irotama',destino:'Santa Marta'},politicas:{ninos:{admite_todas_las_edades:null,alojamiento_gratuito:{maximo_menores:2,edad_maxima_anios:2,comparte_habitacion_con_padres_o_tutores:true,usa_camas_existentes:true,alcance:'solo_alojamiento',aplica_a_tarifa_consultada:null},textos_fuente:[text],informacion_contradictoria:false}},actualizado_en:'2026-11-23T11:58:43-05:00',fuente:'ficha_alojamiento',estado:'informacion_disponible'});
const call=(data=payload(),patch={})=>readHotelPolicies({id,hotels,env,fetchImpl:async()=>new Response(JSON.stringify(data),{status:200}),...patch});
test('Only children and source metadata are returned; general policies stay internal',async()=>{
 const data=payload();data.politicas.iva='19%';data.politicas.checkin='16:00';data.raw='4300 COP';data.token='NEVER';
 const r=await call(data);assert.deepEqual(r,payload());assert.doesNotMatch(JSON.stringify(r),/iva|checkin|4300|NEVER/);
});
test('Children policy does not price minors or grant a free complete package',async()=>{
 const r=await call();assert.equal(r.politicas.ninos.alojamiento_gratuito.alcance,'solo_alojamiento');assert.equal(r.politicas.ninos.alojamiento_gratuito.aplica_a_tarifa_consultada,null);assert.ok(!('precio' in r));
});
test('No recognized children policy is a valid explicit null',async()=>{
 const d=payload();d.politicas.ninos=null;d.estado='sin_informacion_ninos';assert.equal((await call(d)).politicas.ninos,null);
});
test('Hotel IDs are catalog-scoped and invalid paths never reach the source',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error()};
 for(const value of ['../token','MASTER-5084431?x=1','x/y',''])await assert.rejects(call(undefined,{id:value,fetchImpl}),e=>e.status===400);
 await assert.rejects(call(undefined,{id:'999',fetchImpl}),e=>e.status===404);assert.equal(calls,0);
});
test('Endpoint rejects arbitrary query filters',async()=>{
 await assert.rejects(call(undefined,{query:{edad:2}}),e=>e.status===400);
});
test('Source credentials remain server-side and request has a deadline and no redirects',async()=>{
 let opts,url;
 await call(undefined,{fetchImpl:async(u,o)=>{url=u;opts=o;return new Response(JSON.stringify(payload()))}});
 assert.equal(url,'http://172.18.0.1:8791/v1/hoteles/MASTER-5084431/politicas');assert.equal(opts.headers.Authorization,'Bearer '+env.CAZADOR_API_TOKEN);assert.equal(opts.redirect,'error');assert.equal(opts.cache,'no-store');assert.ok(opts.signal);
});
test('Missing source configuration and unreachable source fail cleanly without secrets',async()=>{
 for(const patch of [{env:{}},{fetchImpl:async()=>{throw Error('private-token')}}])await assert.rejects(call(undefined,patch),e=>e.status===503&&!e.message.includes('private-token'));
});
test('Source 404 and 503 preserve distinct errors',async()=>{
 await assert.rejects(call(undefined,{fetchImpl:async()=>new Response('{}',{status:404})}),e=>e.status===404);
 await assert.rejects(call(undefined,{fetchImpl:async()=>new Response('secret',{status:503})}),e=>e.status===503&&!e.message.includes('secret'));
});
test('Mismatched hotel, malformed JSON, excessive body and missing dates are rejected',async()=>{
 const wrong=payload();wrong.hotel.id='73440';await assert.rejects(call(wrong),e=>e.status===503);
 for(const body of ['broken','x'.repeat(21000)])await assert.rejects(call(undefined,{fetchImpl:async()=>new Response(body)}),e=>e.status===503);
 const wrongDate=payload();wrongDate.actualizado_en='bad';await assert.rejects(call(wrongDate),e=>e.status===503);
});
test('Structured benefits require matching source evidence and cannot expand age or count',async()=>{
 for(const key of ['edad_maxima_anios','maximo_menores']){const d=payload();d.politicas.ninos.alojamiento_gratuito[key]=3;await assert.rejects(call(d),e=>e.status===503);}
 const d=payload();d.politicas.ninos.textos_fuente=['IVA 19 %. '+text];await assert.rejects(call(d),e=>e.status===503);
});
test('Source cannot turn a general lodging policy into confirmed tariff applicability',async()=>{
 const d=payload();d.politicas.ninos.alojamiento_gratuito.aplica_a_tarifa_consultada=true;
 assert.equal((await call(d)).politicas.ninos.alojamiento_gratuito.aplica_a_tarifa_consultada,null);
 d.politicas.ninos.admite_todas_las_edades=true;
 assert.equal((await call(d)).politicas.ninos.admite_todas_las_edades,null);
 d.politicas.ninos.textos_fuente.push('No se admiten niños.');
 const r=await call(d);assert.equal(r.politicas.ninos.informacion_contradictoria,true);assert.equal(r.politicas.ninos.alojamiento_gratuito,null);
});
test('OpenAPI exposes a guarded read endpoint with an allowlisted children-only schema',()=>{
 const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'../../src/modules/offers-query');
 const api=JSON.parse(fs.readFileSync(path.join(root,'openapi.json'),'utf8'));
 assert.equal(api.info.version,'1.0.0');assert.ok(api.paths['/hoteles/{id}/politicas'].get);assert.equal(Object.keys(api.paths['/hoteles/{id}/politicas']).length,1);
 assert.deepEqual(Object.keys(api.components.schemas.PoliticasHotel.properties.politicas.properties),['ninos']);
 const controller=fs.readFileSync(path.join(root,'offers-api.controller.ts'),'utf8');assert.match(controller,/@UseGuards\(OffersApiGuard\)/);assert.match(controller,/@Get\('hoteles\/:id\/politicas'\)/);
});
