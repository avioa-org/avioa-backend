'use strict';
const {QueryError}=require('./engine.cjs');
const {parseConfig}=require('../../infrastructure/hunter-sync/hunter-sync.cjs');
const unavailable=()=>new QueryError(503,'politicas_no_disponibles','No se pudieron consultar las políticas del alojamiento.');
const evidence=/^(?:Los niños de cualquier edad son bienvenidos\.?|No se admiten niños\.?|Se ofrece alojamiento gratuito a un máximo de \d{1,2} menores de hasta \d{1,2} años, siempre que ocupen la misma habitación que sus padres o tutores, utilizando las camas existentes\.?)$/i;
function safeText(v,max=300){if(typeof v!=='string'||!v.trim()||v.length>max)throw unavailable();return v.trim();}
function children(v){
 if(v===null)return null;
 if(!v||typeof v!=='object'||![true,false,null].includes(v.admite_todas_las_edades)||typeof v.informacion_contradictoria!=='boolean'||!Array.isArray(v.textos_fuente)||v.textos_fuente.length<1||v.textos_fuente.length>4)throw unavailable();
 const texts=v.textos_fuente.map(x=>safeText(x,700));
 if(texts.some(x=>!evidence.test(x)))throw unavailable();
 let free=null;
 if(v.alojamiento_gratuito!==null){
  const f=v.alojamiento_gratuito;
  if(!f||!Number.isInteger(f.maximo_menores)||f.maximo_menores<1||f.maximo_menores>10||!Number.isInteger(f.edad_maxima_anios)||f.edad_maxima_anios<0||f.edad_maxima_anios>17||f.comparte_habitacion_con_padres_o_tutores!==true||f.usa_camas_existentes!==true||f.alcance!=='solo_alojamiento')throw unavailable();
  const supported=texts.some(t=>{const m=/^Se ofrece alojamiento gratuito a un máximo de (\d{1,2}) menores de hasta (\d{1,2}) años,/i.exec(t);return m&&+m[1]===f.maximo_menores&&+m[2]===f.edad_maxima_anios;});
  if(!supported)throw unavailable();
  free={maximo_menores:f.maximo_menores,edad_maxima_anios:f.edad_maxima_anios,comparte_habitacion_con_padres_o_tutores:true,usa_camas_existentes:true,alcance:'solo_alojamiento',aplica_a_tarifa_consultada:null};
 }
 const admitted=texts.some(t=>/^Los niños de cualquier edad son bienvenidos/i.test(t));
 const denied=texts.some(t=>/^No se admiten niños/i.test(t));
 const conflict=v.informacion_contradictoria||Boolean(denied&&(admitted||free));
 return {admite_todas_las_edades:conflict?null:admitted?true:denied?false:null,alojamiento_gratuito:conflict?null:free,textos_fuente:texts,informacion_contradictoria:conflict};
}
async function readHotelPolicies({id,hotels,query={},env=process.env,fetchImpl=fetch}){
 if(typeof id!=='string'||!/^[A-Za-z0-9-]{1,80}$/.test(id)||!query||Object.keys(query).length)throw new QueryError(400,'consulta_invalida','Indica solo el identificador completo del hotel, sin filtros adicionales.');
 id=id.toUpperCase();
 if(!hotels.some(h=>String(h.id).toUpperCase()===id))throw new QueryError(404,'hotel_no_encontrado','Hotel no encontrado.');
 let config;
 try{config=parseConfig({...env,CAZADOR_SYNC_ENABLED:'true'});}catch{throw unavailable();}
 let response;
 try{response=await fetchImpl(config.base+'/v1/hoteles/'+encodeURIComponent(id)+'/politicas',{
  headers:{Authorization:'Bearer '+config.token,Accept:'application/json'},
  redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
 });}catch{throw unavailable();}
 if(response.status===404)throw new QueryError(404,'ficha_no_encontrada','No hay ficha disponible para este hotel.');
 if(!response.ok)throw unavailable();
 let data;
 try{const text=await response.text();if(Buffer.byteLength(text)>20000)throw Error();data=JSON.parse(text);}catch{throw unavailable();}
 if(!data||data.hotel?.id!==id||!data.politicas||!['informacion_disponible','sin_informacion_ninos'].includes(data.estado))throw unavailable();
 const ninos=children(data.politicas.ninos);
 if((ninos===null)!==(data.estado==='sin_informacion_ninos'))throw unavailable();
 const updated=data.actualizado_en;
 if(updated!==null&&(typeof updated!=='string'||updated.length>64||!Number.isFinite(Date.parse(updated))))throw unavailable();
 // Explicit allowlist: never spread the source object or expose raw hotel policies.
 return {hotel:{id,nombre:safeText(data.hotel.nombre),destino:safeText(data.hotel.destino)},
  politicas:{ninos},actualizado_en:updated,fuente:'ficha_alojamiento',estado:data.estado};
}
module.exports={readHotelPolicies};
