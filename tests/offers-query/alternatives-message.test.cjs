'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require(process.env.AVIOA_ENGINE_PATH || '../../src/modules/offers-query/engine.cjs');
const now=Date.parse('2026-11-24T14:00:00Z');
const config={hotels:[{id:'73440',name:'Divi Dutch Village Beach Resort',destination:'Aruba'}],services:{flightTAPercent:18,serviceTAPercent:18,domesticDestinations:[],medicalInternationalPerDay:10000,medicalDomesticPerDay:1600,transferGroups:[{hotelIds:['73440'],amount:95000}]}};
const product=(id,patch={})=>({id,title:id,origin:'MDE',dest:'AUA',destName:'Aruba',kind:'VUELO_HOTEL',defaultForDestination:id==='principal',periods:[{id:'p',nights:3,start:'2027-09-05',end:'2027-09-08'}],variants:[{id:'v',periodId:'p',price:3699000,currency:'COP',basis:'POR_PERSONA',occupancy:'DOBLE',hotel:'Divi Dutch Village',meal:'TODO_INCLUIDO'}],includes:['Snacks','Bar abierto'],excludes:[],conditions:[],updatedAt:'2026-11-23',...patch});
const row=(patch={})=>({id:1,id_vuelo:1,origen:'MDE',destino_vuelo:'AUA',hotel_code:'73440',habitacion:'Suite',regimen:'SOLO HABITACION',ida:'2027-04-25',regreso:'2027-04-28',noches:3,precio_vuelo:500000,precio_hotel_total:2000000,precio_paquete_persona:1500000,moneda:'COP',deeplink_hotel:'https://private.test/?distribution=2-0',fecha_consulta:'2026-11-23',...patch});
const model=(offers=[product('principal')],rows=[row()],cfg=config)=>C.build({config:cfg,rows,payload:{offers},revision:28,now});
const others=(m,q={})=>C.query(m,q).mensaje_whatsapp.split('🎁 *Otras ofertas:*\n')[1] || '';

test('Alternative shows its own departure, return, year, duration, regime, price and basis',()=>{
 const m=model(),line=others(m),o=m.groups.find(g=>g.fuente==='cazador').options[0];
 assert.match(line,/25 de abr de 2027 al 28 de abr de 2027/);
 assert.match(line,/4 días \/ 3 noches/);
 assert.match(line,/Solo alojamiento \(sin alimentación\)/);
 assert.match(line,/1\.749\.300 COP por persona/);
 assert.match(line,/Desde Medellín/);
 assert.doesNotMatch(line,/Snacks|Bar abierto|TODO.INCLUIDO|3\.699\.000/);
 assert.equal(o.precio.valor,1749300);
});
test('Alternative never mixes the cheapest price with another option date or meal',()=>{
 const m=model(undefined,[row({precio_paquete_persona:2000000}),row({id:2,ida:'2027-05-01',regreso:'2027-05-03',noches:2,regimen:'DESAYUNO',precio_paquete_persona:1000000})]);
 const line=others(m);
 assert.match(line,/1 de may de 2027 al 3 de may de 2027/);
 assert.match(line,/3 días \/ 2 noches/);
 assert.match(line,/Desayuno/);
 assert.doesNotMatch(line,/25 de abr|Solo alojamiento/);
 const o=m.groups.find(g=>g.fuente==='cazador').options[0];
 assert.ok(line.includes(new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(o.precio.valor)+' COP por persona'));
});
test('Known meal labels normalize both space and underscore formats',()=>{
 for(const value of ['TODO_INCLUIDO','TODO INCLUIDO'])assert.match(others(model(undefined,[row({regimen:value})])),/Todo incluido/);
 for(const value of ['SOLO_HABITACION','SOLO HABITACION'])assert.match(others(model(undefined,[row({regimen:value})])),/sin alimentación/);
});
test('Manual dates without year remain partial and visibly lack a year',()=>{
 const other=product('otra',{periods:[{id:'p',nights:3,sourceDates:[{departure:'25/4',return:'28/4'}]}]});
 const line=others(model([product('principal'),other],[]));
 assert.match(line,/25\/4 al 28\/4 \(año no indicado\)/);
 assert.doesNotMatch(line,/2027/);
});
test('Unknown date, duration and meal are explicit rather than invented',()=>{
 const other=product('otra',{periods:[{id:'p'}],variants:[{id:'v',periodId:'p',price:100,currency:'USD',basis:'POR_PAREJA',occupancy:'DOBLE',hotel:'Otro',meal:null}]});
 const line=others(model([product('principal'),other],[]));
 assert.match(line,/Fechas no especificadas/);
 assert.match(line,/Duración no especificada/);
 assert.match(line,/Alimentación no especificada/);
 assert.match(line,/100 USD por pareja/);
 assert.doesNotMatch(line,/por persona/);
});
test('Known partial total remains marked without copying benefits from principal',()=>{
 const cfg=structuredClone(config);cfg.services.transferGroups=[];
 const line=others(model(undefined,undefined,cfg));
 assert.match(line,/\(total parcial\)/);
 assert.doesNotMatch(line,/Bar abierto|Snacks|Traslados incluidos/);
});
test('Selected filters also constrain the alternatives',()=>{
 assert.equal(others(model(),{fuente:'producto'}),'');
 assert.equal(others(model(),{fecha_desde:'2027-09-01'}),'');
});
test('Alternative count remains bounded to six without leaking source or credentials',()=>{
 const m=model([product('principal'),...Array.from({length:8},(_,i)=>product('otra-'+i))],[]);
 const line=others(m);
 assert.equal(line.split('\n').filter(x=>x.startsWith('• ')).length,6);
 assert.doesNotMatch(line,/private\.test|id_vuelo|precio_hotel_total|Bearer/);
});
test('Only search summary changes; detail and message routes preserve offer-specific data',()=>{
 const m=model(),before=JSON.stringify(m),q=C.query(m,{}),id=q.seleccionada;
 assert.equal(C.detail(m,id,{},'mensaje').mensaje_whatsapp,q.mensaje_whatsapp.split('\n\n🎁 *Otras ofertas:*')[0]);
 assert.equal(C.detail(m,id,{},'fechas').items[0].precio.valor,3699000);
 assert.equal(JSON.stringify(m),before);
});
