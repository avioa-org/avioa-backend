'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../src');
const selector=fs.readFileSync(path.join(root,'infrastructure/hunter-sync/hunter-selection.cjs'),'utf8');
const patch=fs.readFileSync(path.join(root,'modules/offers-query/catalog-selection.js'),'utf8');
const now=Date.parse('2026-11-25T18:00:00Z');
function row(id,hotel,ida,origin='MDE',regimen='TODO INCLUIDO',price=1000000){const end=new Date(Date.parse(ida)+3*86400000).toISOString().slice(0,10);return {id,hotel_code:hotel,origen:origin,destino_vuelo:'PUJ',ida,regreso:end,noches:3,regimen,habitacion:'Estándar',moneda:'COP',fecha_consulta:'2026-11-25',precio_paquete_persona:price,precio_vuelo:200000,deeplink_hotel:'https://example.test/?distribution=2-0',cancelacion_gratuita:0};}
function setup(){
 const hotels=[{hotel_id:'A',nombre:'Alfa',destino:'Punta Cana',v2Paquetes:[row(1,'A','2027-07-06'),row(2,'A','2027-01-20'),row(3,'A','2027-09-10')]},{hotel_id:'B',nombre:'Beta',destino:'Punta Cana',v2Paquetes:[row(4,'B','2027-03-15'),row(5,'B','2027-12-10','BOG')]}];
 const ctx=vm.createContext({Date,URL,Intl,Map,Set,console,AvioaHunterSelectionEpoch:now,
  state:{catalogo:{origen:'TODOS',regimen:'TODOS',captura:'TODAS',orden:'actualizacion',v2Limite:4}},CATALOGO_CAZADOR_VISUAL:hotels,
  hunterServiceRate:(h,r)=>({...r}),hunterCompareTariffs:(a,b)=>a.precio_paquete_persona-b.precio_paquete_persona,
  v2CatalogoPrecios(){},v2CatalogoOpciones(){},v2CatalogoSeleccion(){},hunterCatalogRows(){},
  ecFilterHotels:()=>hotels.filter(h=>ctx.hunterCatalogRows(h).length),
  opts:(values,selected,labels={})=>values.map(v=>`<option value="${v}"${v===selected?' selected':''}>${labels[v]||v}</option>`).join(''),
  esc:x=>String(x??''),ecCurrency:(v,c)=>v+' '+c,ecFriendlyDate:x=>x,ecSafeLink:()=>'',v2CatalogoEstado:()=>'',hunterServicesText:()=>'',
  document:{addEventListener(){}},render(){},flash(){}});
 vm.runInContext(selector,ctx);vm.runInContext(patch,ctx);return {ctx,hotels};
}
test('Travel date options appear in catalog order selector only',()=>{const {ctx}=setup();const html=ctx.opts(['actualizacion','precio','cantidad'],'salida',{});assert.match(html,/value="salida" selected/);assert.match(html,/Fecha de viaje: más próxima/);assert.match(html,/Fecha de viaje: más lejana/);assert.equal(ctx.opts(['TODOS','MDE'],'TODOS'),'<option value="TODOS" selected>TODOS</option><option value="MDE">MDE</option>');});
test('Closest departure sorts options chronologically across months',()=>{const {ctx,hotels}=setup();ctx.state.catalogo.orden='salida';assert.deepEqual(Array.from(ctx.hunterCatalogRows(hotels[0]),r=>r.id),[2,1,3]);});
test('Farthest departure reverses date order',()=>{const {ctx,hotels}=setup();ctx.state.catalogo.orden='salida_desc';assert.deepEqual(Array.from(ctx.hunterCatalogRows(hotels[0]),r=>r.id),[3,1,2]);});
test('Hotel order uses earliest or latest eligible departure',()=>{const {ctx}=setup();ctx.state.catalogo.orden='salida';assert.deepEqual(Array.from(ctx.ecFilterHotels(),h=>h.hotel_id),['A','B']);ctx.state.catalogo.orden='salida_desc';assert.deepEqual(Array.from(ctx.ecFilterHotels(),h=>h.hotel_id),['B','A']);});
test('Origin filter affects which hotel has the farthest departure',()=>{const {ctx}=setup();ctx.state.catalogo.orden='salida_desc';ctx.state.catalogo.origen='MDE';assert.deepEqual(Array.from(ctx.ecFilterHotels(),h=>h.hotel_id),['A','B']);});
test('Regime and explicit capture filters remain effective',()=>{const {ctx,hotels}=setup();hotels[1].v2Paquetes[0].regimen='DESAYUNO';ctx.state.catalogo.regimen='DESAYUNO';ctx.state.catalogo.orden='salida';assert.deepEqual(Array.from(ctx.ecFilterHotels(),h=>h.hotel_id),['B']);ctx.state.catalogo.captura='2026-11-24';assert.equal(ctx.ecFilterHotels().length,0);});
test('Date display order does not change tariff recommendation or explicit selection',()=>{const {ctx,hotels}=setup();hotels[0].v2Paquetes.push({...row(6,'A','2027-07-06','MDE','TODO INCLUIDO',1200000),habitacion:'Suite'});ctx.state.catalogo.v2Paquete=6;for(const order of ['salida','salida_desc']){ctx.state.catalogo.orden=order;assert.equal(ctx.v2CatalogoSeleccion(hotels[0]).id,6);assert.equal(ctx.hunterCatalogRows(hotels[0]).find(r=>r.ida==='2027-07-06').id,1);}});
test('Unknown dates sort last in both directions without throwing',()=>{const {ctx}=setup();for(const order of ['salida','salida_desc'])assert.ok(ctx.hunterCompareTariffs({id:9,ida:null},{id:1,ida:'2027-01-20'},order)>0);});
test('Original order choices retain comparator behavior',()=>{const {ctx}=setup();assert.ok(ctx.hunterCompareTariffs({precio_paquete_persona:100},{precio_paquete_persona:200},'precio')<0);});
test('Rendering follows travel order and leaves stored records untouched',()=>{const {ctx,hotels}=setup(),before=JSON.stringify(hotels);ctx.state.catalogo.orden='salida';const html=ctx.v2CatalogoPrecios(hotels[0]);assert.ok(html.indexOf('Paquete #2')<html.indexOf('Paquete #1'));assert.equal(JSON.stringify(hotels),before);});
