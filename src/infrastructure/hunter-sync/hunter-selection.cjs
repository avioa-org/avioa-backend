(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.AvioaHunterSelection=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const code=x=>String(x??'').trim().toUpperCase();
 const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
 const round=x=>Math.round(x*100)/100;
 function captureTime(raw){
  const s=String(raw??'').trim();
  if(day(s))return Date.parse(s+'T00:00:00-05:00');
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/.test(s))return Date.parse(s);
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(s)&&day(s.slice(0,10))?Date.parse(s.slice(0,10)+'T00:00:00-05:00'):NaN;
 }
 function todayAt(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
 function distribution(r){try{return new URL(r.deeplink_hotel).searchParams.get('distribution');}catch{return null;}}
 function cohortKey(r){return JSON.stringify([code(r.hotel_code),code(r.origen),code(r.destino_vuelo),r.ida,r.regreso,Number(r.noches),norm(r.regimen),distribution(r),r.moneda]);}
 function cancelKey(r){return JSON.stringify([r.cancelacion_gratuita??null,r.cancelacion_gratis_hasta??null,norm(r.politica_cancelacion),norm(r.penalidad_cancelacion)]);}
 function equivalentKey(r){return JSON.stringify([cohortKey(r),norm(r.habitacion),cancelKey(r),norm(r.proveedor_hotel)]);}
 function comparablePrice(r){return round(Number(r.precio_paquete_persona)+round(Number(r.precio_vuelo)*.18));}
 function compare(a,b){return comparablePrice(a)-comparablePrice(b)||Number(b.id)-Number(a.id);}
 function freeNow(r,today){return (r.cancelacion_gratuita===1||r.cancelacion_gratuita===true)&&day(r.cancelacion_gratis_hasta)&&r.cancelacion_gratis_hasta>=today;}
 function selectRows(rows,{now=Date.now(),includeHistory=true}={}){
  const today=todayAt(now),captures=new Map();
  for(const raw of rows){
   const t=captureTime(raw.fecha_consulta),capture=String(raw.fecha_consulta).slice(0,10);
   if(!(now>=t&&now-t<72*3600000)||!day(capture)||!day(raw.ida)||!day(raw.regreso)||raw.ida<today||raw.regreso<=raw.ida||!Number.isInteger(raw.noches)||raw.noches<1||raw.moneda!=='COP'||!Number.isSafeInteger(raw.id)||raw.id<1||!Number.isFinite(Number(raw.precio_paquete_persona))||Number(raw.precio_paquete_persona)<=0||!Number.isFinite(Number(raw.precio_vuelo))||Number(raw.precio_vuelo)<=0)continue;
   if((Date.parse(raw.regreso)-Date.parse(raw.ida))/86400000<raw.noches)continue;
   const cohort=cohortKey(raw),key=JSON.stringify([cohort,capture]);
   if(!captures.has(key))captures.set(key,{cohort,capture,rates:new Map()});
   const rates=captures.get(key).rates,eq=equivalentKey(raw),old=rates.get(eq);
   if(!old||t>old.t||t===old.t&&compare(raw,old.raw)<0)rates.set(eq,{raw,t});
  }
  const latest=new Map();
  for(const g of captures.values())if(!latest.has(g.cohort)||g.capture>latest.get(g.cohort))latest.set(g.cohort,g.capture);
  const all=[];
  for(const g of captures.values()){
   const current=g.capture===latest.get(g.cohort);
   if(!includeHistory&&!current)continue;
   const rates=[...g.rates.values()].map(x=>x.raw),far=(Date.parse(rates[0].ida)-Date.parse(today))/86400000>30;
   const free=rates.filter(r=>freeNow(r,today));
   const preferred=far&&free.length?free:rates;
   const winner=preferred.slice().sort(compare)[0];
   const criterion=far?(free.length?'prioriza_cancelacion_gratuita':'fallback_menor_precio'):'menor_precio_hasta_30_dias';
   for(const r of rates){
    const knownOccupancy=/^\d+-0$/.test(distribution(r)||'');
    all.push({...r,_avioa_selection:{current,recommended:r===winner,criterion,capture:g.capture,
      recommended_source_id:winner.id,
      difference:r===winner||!knownOccupancy?null:{valor:round(comparablePrice(r)-comparablePrice(winner)),moneda:'COP',unidad:'por_persona',cancelacion_equivalente:cancelKey(r)===cancelKey(winner),registro_recomendado:winner.id}}});
   }
  }
  all.sort((a,b)=>Number(b._avioa_selection.current)-Number(a._avioa_selection.current)||Number(b._avioa_selection.recommended)-Number(a._avioa_selection.recommended)||compare(a,b));
  return {all,current:all.filter(r=>r._avioa_selection.current),history:all.filter(r=>!r._avioa_selection.current)};
 }
 return {selectRows,captureTime,cohortKey,comparablePrice,todayAt,norm};
});
