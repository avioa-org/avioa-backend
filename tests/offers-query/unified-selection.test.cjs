'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../../src/infrastructure/hunter-sync/hunter-selection.cjs');
const C=require('../../src/modules/offers-query/engine.cjs');
const {row,rows,config,now,model}=require('./fixtures/unified-data.cjs');

test('Nickelodeon latest capture replaces old unverified low prices in commercial output',()=>{
 const m=model(),q=C.query(m,{regimen:'TODO_INCLUIDO'});
 assert.equal(q.items[0].precio_desde.valor,3628742.48);
 assert.deepEqual(q.items[0].opciones[0].referencia_fuente,{sistema:'cazador',registro_id:178994,hotel_id:'MASTER-126275',captura:'2026-11-24'});
 assert.match(q.mensaje_whatsapp,/3\.628\.742 COP/);assert.doesNotMatch(q.mensaje_whatsapp,/3\.564\.955|3\.523\.279/);
 assert.equal(q.items[0].opciones[0].seleccion.recomendada,true);
});
test('Old captures remain available in history without mutating original source data',()=>{
 const input=rows(),before=JSON.stringify(input),s=S.selectRows(input,{now});
 assert.deepEqual(s.history.map(r=>r.id).sort((a,b)=>a-b),[102,170382]);
 assert.ok(!s.current.some(r=>[102,170382].includes(r.id)));
 assert.equal(JSON.stringify(input),before);
});
test('Free verified cancellation outranks a cheaper unknown rate in the same latest capture',()=>{
 const cheap=row({id:600001,precio_paquete_persona:2500000,cancelacion_gratuita:null,cancelacion_gratis_hasta:null,politica_cancelacion:'NEST SUITE',penalidad_cancelacion:null});
 const s=S.selectRows([row(),cheap],{now});assert.equal(s.current.find(r=>r._avioa_selection.recommended).id,178994);
 const q=C.query(model([row(),cheap]),{});assert.equal(q.items[0].opciones[0].referencia_fuente.registro_id,178994);
 assert.ok(q.items[0].opciones.some(o=>o.referencia_fuente.registro_id===600001&&!o.seleccion.recomendada));
});
test('At thirty days the criterion switches to lower price; expired or undated free tags do not get priority',()=>{
 const date='2026-12-24',end='2026-12-27';
 const expensive=row({ida:date,regreso:end,cancelacion_gratis_hasta:'2026-12-20'}),cheap=row({id:2,ida:date,regreso:end,precio_paquete_persona:2500000,cancelacion_gratuita:0});
 let winner=S.selectRows([expensive,cheap],{now}).current.find(r=>r._avioa_selection.recommended);
 assert.equal(winner.id,2);assert.equal(winner._avioa_selection.criterion,'menor_precio_hasta_30_dias');
 for(const until of [null,'2026-11-23','bad']){
  winner=S.selectRows([row({cancelacion_gratis_hasta:until}),row({id:2,precio_paquete_persona:2500000,cancelacion_gratuita:0})],{now}).current.find(r=>r._avioa_selection.recommended);
  assert.equal(winner.id,2);assert.equal(winner._avioa_selection.criterion,'fallback_menor_precio');
 }
});
test('Older quote survives under72h if there is no newer comparable capture',()=>{
 const old=row({fecha_consulta:'2026-11-23'});
 const unrelated=row({id:2,ida:'2027-07-13',regreso:'2027-07-16'});
 assert.equal(S.selectRows([old,unrelated],{now}).current.length,2);
});
test('Regime, origin, dates, duration and occupancy are not collapsed together',()=>{
 const all=[row(),row({id:2,origen:'BOG'}),row({id:3,regimen:'DESAYUNO'}),row({id:4,deeplink_hotel:'https://private.test/?distribution=3-0'}),row({id:5,ida:'2027-07-13',regreso:'2027-07-16'})];
 assert.equal(S.selectRows(all,{now}).current.filter(r=>r._avioa_selection.recommended).length,5);
});
test('Equivalent flight records in one capture choose lower final known cost and source ID deterministically',()=>{
 const a=row(),b=row({id:2,id_vuelo:999,precio_paquete_persona:3100000});
 const first=S.selectRows([a,b],{now}).current,second=S.selectRows([b,a],{now}).current;
 assert.equal(first.length,1);assert.equal(first[0].id,2);assert.deepEqual(first,second);
});
test('Strict72h, future capture, invalid dates and departed trips are excluded',()=>{
 for(const change of [{fecha_consulta:'2026-11-21T20:00:00Z'},{fecha_consulta:'2026-11-25'},{fecha_consulta:'2026-11-24garbage'},{ida:'2026-11-23',regreso:'2026-11-26'},{ida:'2027-02-30'},{noches:5}])assert.equal(S.selectRows([row(change)],{now}).current.length,0);
});
test('Suites are not blacklisted and expensive special categories are retained as data',()=>{
 const s=S.selectRows(rows(),{now});assert.ok(s.current.some(r=>r.habitacion==='Suite'));
 assert.ok(s.current.some(r=>r.id===178992));assert.ok(s.current.some(r=>r.id===178993));
 const q=C.query(model(),{regimen:'TODO_INCLUIDO'});assert.ok(q.items[0].opciones.every(o=>o.regimen==='TODO INCLUIDO'));
});
test('Differences compare only the same cohort and disclose changed cancellation conditions',()=>{
 const input=[row(),row({id:2,habitacion:'Suite Pad',precio_paquete_persona:3500000}),row({id:3,habitacion:'Villa',regimen:'DESAYUNO',precio_paquete_persona:9000000})];
 const q=C.query(model(input),{}),p=q.items[0].opciones.find(o=>o.referencia_fuente.registro_id===2),villa=q.items[0].opciones.find(o=>o.referencia_fuente.registro_id===3);
 assert.equal(p.diferencia_vs_recomendada.valor,223016);assert.equal(p.diferencia_vs_recomendada.registro_recomendado,178994);assert.equal(p.diferencia_vs_recomendada.cancelacion_equivalente,true);
 assert.equal(villa.diferencia_vs_recomendada,null);
 const changed=C.query(model([row(),row({id:2,habitacion:'Pad',precio_paquete_persona:3500000,cancelacion_gratis_hasta:'2027-06-01'})]),{}).items[0].opciones.find(o=>o.referencia_fuente.registro_id===2);
 assert.equal(changed.diferencia_vs_recomendada.cancelacion_equivalente,false);
});
test('Unknown occupancy does not get an asserted room price difference',()=>{
 const input=[row({deeplink_hotel:'https://x/'}),row({id:2,habitacion:'Pad',precio_paquete_persona:4000000,deeplink_hotel:'https://x/'})];
 assert.ok(S.selectRows(input,{now}).current.every(r=>r._avioa_selection.difference===null));
});
test('Explicit alternate option uses its own price and message rather than the recommendation price',()=>{
 const m=model(),q=C.query(m,{regimen:'TODO_INCLUIDO'}),g=q.items[0],alt=g.opciones.find(o=>!o.seleccion.recomendada);
 const d=C.detail(m,g.id,{opcion:alt.id});assert.equal(d.precio_desde.valor,alt.precio.valor);assert.equal(d.total_opciones,1);
 const selected=C.query(m,{seleccion:g.id,opcion:alt.id});assert.equal(selected.items.find(x=>x.id===g.id).precio_desde.valor,alt.precio.valor);
 assert.equal(C.detail(m,g.id,{opcion:alt.id},'mensaje').mensaje_whatsapp,d.comercial.mensaje_whatsapp);
});
test('No-meal rooms are labeled clearly and never list food as an included service',()=>{
 const q=C.query(model(),{regimen:'SOLO_HABITACION'});
 assert.match(q.mensaje_whatsapp,/Solo alojamiento \(sin alimentación\)/);
 assert.ok(q.items[0].opciones[0].servicios_incluidos.every(x=>!x.startsWith('Alimentación:')));
});
test('Traceability contains no raw hotel costs or provider credentials',()=>{
 const q=JSON.stringify(C.query(model(),{}));assert.doesNotMatch(q,/private\.test|precio_hotel_total|precio_vuelo|id_vuelo|Bearer/);assert.match(q,/registro_id/);
});
