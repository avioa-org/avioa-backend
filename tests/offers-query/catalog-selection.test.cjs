'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {row,rows,config,now,model}=require('./fixtures/unified-data.cjs');
const C=require('../../src/modules/offers-query/engine.cjs');
const selector=fs.readFileSync(path.resolve(__dirname,'../../src/infrastructure/hunter-sync/hunter-selection.cjs'),'utf8');
const catalog=fs.readFileSync(path.resolve(__dirname,'../../src/modules/offers-query/catalog-selection.js'),'utf8');
const originalHelpers=fs.readFileSync(path.join(__dirname,'fixtures/catalog-helpers.js'),'utf8');
function browser(input=rows(),clockOffset=0){
 const events={},inputs={},alerts=[];let renders=0;
 class ClockDate extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now+clockOffset;}}
 const h={hotel_id:'MASTER-126275',nombre:config.hotels[0].name,destino:'Punta Cana',v2Paquetes:input};
 const ctx=vm.createContext({Date:ClockDate,URL,Intl,Map,Set,console,AvioaHunterSelectionEpoch:now,
  state:{catalogo:{origen:'MDE',regimen:'TODO INCLUIDO',captura:'TODAS',orden:'precio',v2Paquete:null,v2Limite:4}},
  CATALOGO_CAZADOR_VISUAL:[h],HUNTER_SERVICES:config.services,HUNTER_TRANSFER_AMOUNTS:new Map([['MASTER-126275',100000]]),hunterHotelKey:x=>String(x).toUpperCase(),
  esc:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  ecCurrency:(v,c)=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(v)+' '+c,
  ecFriendlyDate:x=>x,ecSafeLink:x=>{try{const u=new URL(x);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}},
  hunterCompareTariffs:(a,b)=>a.precio_paquete_persona-b.precio_paquete_persona,
  v2CatalogoPrecios(){return '';},v2CatalogoOpciones(){return [];},v2CatalogoSeleccion(){return null;},hunterCatalogRows(){return [];},
  flash:x=>alerts.push(x),render:()=>{renders++;},
  document:{addEventListener:(name,fn)=>{(events[name]||=[]).push(fn);},getElementById:id=>inputs[id]},
 });
 vm.runInContext(originalHelpers,ctx);vm.runInContext(selector,ctx);vm.runInContext(catalog,ctx);
 function click(dataset){
  const b={dataset,hasAttribute:name=>Object.prototype.hasOwnProperty.call(dataset,name.replace(/^data-/, '').replace(/-([a-z])/g,(_,x)=>x.toUpperCase()))};
  const e={target:{closest:()=>b},preventDefault(){},stopImmediatePropagation(){}};
  for(const fn of events.click||[])fn(e);
 }
 return {ctx,h,events,inputs,alerts,click,renders:()=>renders,html:()=>ctx.v2CatalogoPrecios(h)};
}
test('Browser and API recommend the same source ID, capture and final calculated price',()=>{
 const b=browser(),selected=b.ctx.v2CatalogoSeleccion(b.h),api=C.query(model(),{regimen:'TODO_INCLUIDO'}).items[0].opciones[0];
 assert.equal(selected.id,api.referencia_fuente.registro_id);assert.equal(selected.id,178994);
 assert.equal(selected.precio_paquete_persona,api.precio.valor);assert.equal(selected.fecha_consulta,api.referencia_fuente.captura);
});
test('Old cheap quotes and other categories are separated from default recommendation cards',()=>{
 const b=browser(),html=b.html();
 const main=html.split('<summary>Otras habitaciones y tarifas')[0];
 assert.match(main,/Paquete #178994/);assert.doesNotMatch(main,/Paquete #170382|Paquete #102/);
 assert.match(html,/Otras habitaciones y tarifas/);assert.match(html,/Capturas anteriores dentro de 72 horas/);
 assert.match(html,/Paquete #170382/);assert.match(html,/Paquete #102/);
});
test('Source-record finder locates exactly the API record without altering prices',()=>{
 const b=browser();b.inputs['hunter-source-MASTER-126275']={value:'178994'};
 b.click({hunterSourceFind:'MASTER-126275'});
 assert.equal(b.ctx.state.catalogo.v2Paquete,178994);assert.equal(b.ctx.state.catalogo.captura,'2026-11-24');assert.equal(b.renders(),1);
 assert.equal(b.ctx.v2CatalogoSeleccion(b.h).precio_paquete_persona,3628742.48);
});
test('Explicit alternate selection works and does not silently revert to recommendation',()=>{
 const b=browser();b.click({hunterSourceSelect:'500001',hunterSourceHotel:'MASTER-126275'});
 assert.equal(b.ctx.v2CatalogoSeleccion(b.h).id,500001);assert.match(b.html(),/Paquete #500001/);
 assert.equal(b.ctx.state.catalogo.captura,'TODAS');
});
test('Historical selection is explicitly labeled and cannot change API recommendation',()=>{
 const b=browser();b.click({hunterSourceSelect:'170382',hunterSourceHotel:'MASTER-126275'});
 assert.equal(b.ctx.state.catalogo.captura,'2026-11-22');assert.equal(b.ctx.v2CatalogoSeleccion(b.h).id,170382);assert.match(b.html(),/Captura anterior/);
 assert.equal(C.query(model(),{regimen:'TODO_INCLUIDO'}).items[0].opciones[0].referencia_fuente.registro_id,178994);
});
test('Invalid source IDs do not get inserted into the page or change filters',()=>{
 const b=browser();b.inputs['hunter-source-MASTER-126275']={value:'<script>'};
 b.click({hunterSourceFind:'MASTER-126275'});assert.equal(b.alerts.length,1);assert.equal(b.renders(),0);
});
test('Room markup is escaped and catalog rendering does not mutate original rows',()=>{
 const input=rows();input[2].habitacion='Suite <img src=x onerror=alert(1)>';
 const before=JSON.stringify(input),b=browser(input),html=b.html();assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img/);assert.equal(JSON.stringify(input),before);
});
test('Browser UMD export uses exactly the same selector result as Node module',()=>{
 const b=browser(),S=require('../../src/infrastructure/hunter-sync/hunter-selection.cjs');
 assert.equal(JSON.stringify(b.ctx.AvioaHunterSelection.selectRows(rows(),{now})),JSON.stringify(S.selectRows(rows(),{now})));
});

test("Server epoch keeps selection stable when the user PC clock is wrong",()=>{const b=browser(rows(),86400000*7);assert.equal(b.ctx.v2CatalogoSeleccion(b.h).id,178994);});
