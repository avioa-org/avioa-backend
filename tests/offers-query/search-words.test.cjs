'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require(process.env.AVIOA_ENGINE_PATH || '../../src/modules/offers-query/engine.cjs');
const names=[
 'Divi Dutch Village',
 'Hotel Caribe by Faranda Grand, a member of Radisson Individuals',
 'Hotel El Panama by Faranda Grand, a member of Radisson Individuals',
 'Riu Palace', 'Sirius Resort', 'Sol Caribe', 'Consolación Resort',
 'Mar Azul', 'Marriott Resort', 'Grand Sirenis', 'Grande Resort',
 'Barceló Bávaro Palace', 'Ocean Blue & Sand', 'Decameron San-Andrés',
];
const product=(name,i)=>({
 id:'manual-'+i,title:name,origin:'MDE',dest:'AUA',destName:'Aruba',
 kind:'VUELO_HOTEL',periods:[{id:'p',nights:3,start:'2027-09-05',end:'2027-09-08'}],
 variants:[{id:'v',periodId:'p',price:3000000,currency:'COP',basis:'POR_PERSONA',occupancy:'DOBLE',hotel:name,meal:'DESAYUNO'}],
 includes:[],excludes:[],conditions:[],updatedAt:'2026-11-23',
});
const config={hotels:[{id:'73440',name:'Divi Dutch Village Beach Resort',destination:'Aruba'}],services:{flightTAPercent:18,serviceTAPercent:18,domesticDestinations:[],medicalInternationalPerDay:10000,medicalDomesticPerDay:1600,transferGroups:[{hotelIds:['73440'],amount:95000}]}};
const row={id:1,id_vuelo:1,origen:'MDE',destino_vuelo:'AUA',hotel_code:'73440',habitacion:'Suite',regimen:'DESAYUNO',ida:'2027-09-05',regreso:'2027-09-08',noches:3,precio_vuelo:500000,precio_hotel_total:2000000,precio_paquete_persona:1500000,moneda:'COP',deeplink_hotel:'https://example.test/?distribution=2-0',fecha_consulta:'2026-11-23'};
const make=()=>C.build({config,rows:[row],payload:{offers:names.map(product)},revision:28,now:Date.parse('2026-11-24T14:00:00Z')});
const model=make();
const titles=q=>C.query(model,{...q,limit:50}).items.map(x=>x.titulo);

test('Divi excludes Individuals in product, hunter results and other-offers message',()=>{
 const result=C.query(model,{q:'Divi'});
 assert.equal(result.total,2);
 assert.deepEqual(result.items.map(x=>x.fuente),['producto','cazador']);
 assert.doesNotMatch(JSON.stringify(result),/Individuals|Hotel Caribe|El Panama/);
});
test('Whole-word rule handles other embedded brand fragments',()=>{
 for(const [q,yes,no] of [['Riu','Riu Palace','Sirius Resort'],['Sol','Sol Caribe','Consolación Resort'],['Mar','Mar Azul','Marriott Resort'],['Grand','Grand Sirenis','Grande Resort']]){
  const actual=titles({q});assert.ok(actual.includes(yes),q);assert.ok(!actual.includes(no),q);
 }
});
test('Case, accents, punctuation, repeated spaces and word order normalize',()=>{
 assert.deepEqual(titles({q:'  BAVARO,   barcelo  '}),['Barceló Bávaro Palace']);
 assert.deepEqual(titles({q:'ocean blue sand'}),['Ocean Blue & Sand']);
 assert.deepEqual(titles({q:'San Andres'}),['Decameron San-Andrés']);
 assert.equal(titles({q:'DIVI Dutch'}).length,2);
});
test('All query words must match; unrelated additional word excludes result',()=>{
 assert.equal(titles({q:'Divi Medellin Aruba'}).length,2);
 assert.equal(titles({q:'Divi Cancun'}).length,0);
});
test('Hotel filter uses whole hotel-name words and supports reordered names',()=>{
 assert.equal(titles({hotel:'Divi'}).length,2);
 assert.equal(titles({hotel:'Village Dutch'}).length,2);
 assert.equal(titles({hotel:'Riu'}).length,1);
 assert.equal(titles({hotel:'Medellin'}).length,0);
});
test('Hotel IDs match exactly, never as partial numbers or null text',()=>{
 assert.deepEqual(titles({hotel:'73440'}),['Divi Dutch Village','Divi Dutch Village Beach Resort']);
 assert.equal(titles({hotel:'7344'}).length,0);
 assert.equal(titles({hotel:'null'}).length,0);
});
test('Punctuation-only queries do not silently return the entire catalog',()=>{
 assert.equal(titles({q:'!!!'}).length,0);
 assert.equal(titles({hotel:'---'}).length,0);
});
test('Context endpoints and offer selection use the same search rule',()=>{
 assert.equal(C.context(model,{q:'Divi'},'hoteles').total,1);
 assert.equal(C.context(model,{q:'Divi'},'destinos').total,1);
 assert.equal(C.context(model,{q:'Divi'},'origenes').total,1);
 assert.equal(C.context(model,{q:'Divi'},'contexto').totales.ofertas,2);
});
test('Detail, dates and message filters reject an embedded-word false match',()=>{
 const wrong=C.query(model,{q:'Individuals'}).items[0].id;
 for(const section of [undefined,'fechas','mensaje'])
  assert.throws(()=>C.detail(model,wrong,{q:'Divi'},section),e=>e.status===404);
});
test('Origin, source, date and regime filters continue to combine with text',()=>{
 assert.equal(titles({q:'Divi',origen:'BOG'}).length,0);
 assert.equal(titles({q:'Divi',fuente:'producto'}).length,1);
 assert.equal(titles({q:'Divi',fuente:'cazador'}).length,1);
 assert.equal(titles({q:'Divi',fecha_desde:'2027-09-06'}).length,0);
 assert.equal(titles({q:'Divi',regimen:'TODO INCLUIDO'}).length,0);
});
test('Search does not mutate stored data or merge separate commercial offers',()=>{
 const before=JSON.stringify(model);
 C.query(model,{q:'Divi'});C.context(model,{hotel:'Divi'},'hoteles');
 assert.equal(JSON.stringify(model),before);
 assert.equal(C.query(model,{q:'Divi'}).items.length,2);
});
test('Approved Divi aliases share canonical ID and name in both sources',()=>{
 const groups=C.query(model,{q:'Divi'}).items;
 for(const g of groups)for(const o of g.opciones)
  assert.deepEqual(o.hotel,{id:'73440',nombre:'Divi Dutch Village Beach Resort'});
 const hotels=C.context(model,{q:'Divi'},'hoteles');
 assert.equal(hotels.total,1);
 assert.equal(hotels.items[0].id,'73440');
});
test('Hotel ID and full name find both offers without mixing prices or benefits',()=>{
 const manual=product('Divi Dutch Village',99);
 manual.includes=['Alimentación completa','Snacks','Bar abierto'];
 manual.variants[0].price=3699000;
 manual.variants[0].meal='ALIMENTACION_COMPLETA_SNACKS_BAR';
 const m=C.build({config,rows:[row],payload:{offers:[manual]},revision:28,now:model.now});
 const result=C.query(m,{hotel:'73440'});
 assert.equal(result.total,2);
 const p=result.items.find(g=>g.fuente==='producto'),h=result.items.find(g=>g.fuente==='cazador');
 assert.equal(p.precio_desde.valor,3699000);
 assert.equal(h.precio_desde.valor,1749300);
 assert.notEqual(p.id,h.id);
 assert.deepEqual(p.incluye,manual.includes);
 assert.ok(!h.opciones[0].servicios_incluidos.includes('Bar abierto'));
 assert.equal(C.query(m,{hotel:'Divi Dutch Village Beach Resort'}).total,2);
 assert.equal(C.query(m,{hotel:'73440',fuente:'producto'}).total,1);
 assert.equal(C.query(m,{hotel:'73440',fuente:'cazador'}).total,1);
});
test('Unknown hotel aliases and another destination never acquire Divi ID',()=>{
 const p=product('Divi Dutch Village',100);p.dest='BGI';p.destName='Barbados';
 const unknown=product('Divi Village Golf',101);
 const m=C.build({config,rows:[],payload:{offers:[p,unknown]},revision:28,now:model.now});
 for(const g of m.groups)assert.equal(g.options[0].hotel.id,null);
});
test('An existing different hotel ID is never overwritten by a matching name',()=>{
 const cfg=structuredClone(config);cfg.hotels=[{id:'99999',name:'Divi Dutch Village',destination:'Aruba'}];
 const m=C.build({config:cfg,rows:[{...row,hotel_code:'99999'}],payload:{offers:[]},revision:28,now:model.now});
 assert.equal(m.groups[0].options[0].hotel.id,'99999');
});
test('Original offer and option IDs remain stable after hotel identity mapping',()=>{
 const p=C.query(model,{q:'Divi',fuente:'producto'}).items[0];
 assert.equal(p.id,'p_'+Buffer.from('manual-0').toString('base64url'));
 const dates=C.detail(model,p.id,{},'fechas');
 assert.equal(dates.items[0].id,p.opciones[0].id);
 assert.match(C.detail(model,p.id,{},'mensaje').mensaje_whatsapp,/Divi Dutch Village Beach Resort/);
});
test('Health and OpenAPI identify the API as 1.0.0 without changing public routes',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.dirname(require.resolve(process.env.AVIOA_ENGINE_PATH || '../../src/modules/offers-query/engine.cjs'));
 const spec=JSON.parse(fs.readFileSync(path.join(root,'openapi.json'),'utf8'));
 const controller=fs.readFileSync(path.join(root,'offers-api.controller.ts'),'utf8');
 assert.equal(spec.info.version,'1.0.0');
 assert.match(controller,/version: '1\.0\.0'/);
 assert.equal(spec.servers[0].url,'/api/v1/ofertas-api');
 assert.equal(Object.keys(spec.paths).length,11);
 assert.ok(spec.security.some(s=>'BearerLectura' in s));
});
