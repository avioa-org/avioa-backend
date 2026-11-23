'use strict';
const {isIP}=require('node:net');
const dayRE=/^\d{4}-\d{2}-\d{2}$/;
const validDay=v=>typeof v==='string'&&dayRE.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const withinWindow=(day,now=Date.now())=>{const age=now-Date.parse(day+'T00:00:00-05:00');return age>=0&&age<72*3600000;};
const key=v=>String(v||'').trim().toUpperCase();
function parseConfig(env){
 if(env.CAZADOR_SYNC_ENABLED!=='true')return {enabled:false};
 const token=env.CAZADOR_API_TOKEN||'';if(token.length<32||/\s/.test(token))throw Error('Configura CAZADOR_API_TOKEN en el servidor.');
 let url;try{url=new URL(env.CAZADOR_API_URL);}catch{throw Error('Configura CAZADOR_API_URL.');}
 const privateHost=(isIP(url.hostname)===4&&/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname))||url.hostname==='localhost';
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||(url.protocol==='http:'&&!privateHost))throw Error('Usa una URL HTTPS o HTTP de la red privada sin credenciales.');
 return {enabled:true,base:url.href.replace(/\/$/,''),token};
}
function validateRow(row,capture,ids){
 if(!row||!Number.isSafeInteger(row.id)||row.id<1||!ids.has(key(row.hotel_code))||String(row.fecha_consulta).slice(0,10)!==capture||row.moneda!=='COP')throw Error('Registro de tarifa inválido.');
 for(const k of ['precio_vuelo','precio_hotel_total','precio_paquete_persona'])if(typeof row[k]!=='number'||!Number.isFinite(row[k])||row[k]<=0)throw Error('Precio de origen inválido.');
 if(!validDay(row.ida)||!validDay(row.regreso)||!Number.isInteger(row.noches)||row.noches<=0)throw Error('Fechas de origen inválidas.');
 const span=(Date.parse(row.regreso)-Date.parse(row.ida))/86400000;
 if(span<row.noches)throw Error('La estancia excede las fechas del viaje.');
 if(span!==row.noches){let q;try{q=new URL(row.deeplink_hotel).searchParams;}catch{throw Error('Falta enlace para comprobar las noches.');}
 const parse=v=>{const m=String(v||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:'';};const start=parse(q.get('departureDate')),end=parse(q.get('arrivalDate'));
 if(!validDay(start)||!validDay(end)||(Date.parse(end)-Date.parse(start))/86400000!==row.noches||start<row.ida||end>row.regreso)throw Error('Las noches no coinciden con el enlace del hotel.');}
}
function mergeRows(previous,incoming){const all=new Map(previous.map(r=>[r.id,r]));for(const row of incoming)all.set(row.id,row);return [...all.values()].sort((a,b)=>a.id-b.id);}
async function downloadCapture({request,capture,watermark,ids}){
 let after=0;const rows=[];let pages=0;
 for(;;){if(++pages>1000)throw Error('La captura excede el límite de paginación.');
 const q=new URLSearchParams({captura:capture,after_id:String(after),until_id:String(watermark),limit:'1000'});const page=await request('/v1/paquetes?'+q);
 if(page.tipo!=='avioa_cazador_sqlite_readonly'||page.snapshot_until_id!==watermark||page.after_id!==after||!Array.isArray(page.ofertas)||page.ofertas.length>1000||page.count!==page.ofertas.length||typeof page.has_more!=='boolean')throw Error('Respuesta paginada inválida.');
 for(const row of page.ofertas){validateRow(row,capture,ids);if(row.id<=after||row.id>watermark)throw Error('Paginación sin orden o fuera del corte.');after=row.id;rows.push(row);}
 if(page.next_after_id!==after||page.has_more&&!page.ofertas.length)throw Error('Paginación incompleta o sin avance.');
 if(!page.has_more)return rows;
 }
}
async function synchronize({prisma,config,seed,ids,full=false,fetchImpl=fetch,now=Date.now()}){
 if(!config.enabled)return {disabled:true};const allowed=new Set(ids.map(key));const deadline=Date.now()+480000;
 const request=async path=>{if(Date.now()>deadline)throw Error('La sincronización excedió el tiempo permitido.');let response;try{response=await fetchImpl(config.base+path,{headers:{Authorization:'Bearer '+config.token},redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'});}catch{throw Error('No se pudo conectar con la API del cazador.');}
 if(!response.ok)throw Error('API del cazador: HTTP '+response.status);const text=await response.text();if(Buffer.byteLength(text)>16000000)throw Error('Respuesta demasiado grande.');try{return JSON.parse(text);}catch{throw Error('La API devolvió una respuesta inválida.');}};
 try{return await prisma.$transaction(async tx=>{
 const lock=await tx.$queryRawUnsafe('SELECT pg_try_advisory_xact_lock(894613) AS acquired');if(!lock[0]?.acquired)return {busy:true};
 const oldStatus=await tx.offersHunterSyncState.findUnique({where:{id:1}});const complete=full||!oldStatus?.lastFullAt||now-new Date(oldStatus.lastFullAt).getTime()>=86400000;
 const byDay=new Map();for(const row of seed){const day=String(row.fecha_consulta).slice(0,10);validateRow(row,day,allowed);if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(row);}
 for(const [captureDate,rows]of byDay){const payload=JSON.stringify(rows);await tx.offersHunterCapture.upsert({where:{captureDate},create:{captureDate,payload,rates:rows.length,sourceCount:0,snapshotUntilId:0,updatedAt:new Date(now)},update:{}});}
 const captures=await request('/v1/capturas');if(!Array.isArray(captures.capturas)||captures.capturas.length>5000)throw Error('Listado de capturas inválido.');
 const first=await request('/v1/paquetes?after_id=0&limit=1');const watermark=first.snapshot_until_id;if(!Number.isSafeInteger(watermark)||watermark<0)throw Error('Corte de identificadores inválido.');
 const seen=new Set();let refreshed=0;
 for(const capture of captures.capturas){const day=capture.fecha;if(!validDay(day)||seen.has(day)||!Number.isSafeInteger(capture.tarifas)||capture.tarifas<0)throw Error('Fecha o conteo de captura inválido.');seen.add(day);
 const existing=await tx.offersHunterCapture.findUnique({where:{captureDate:day}});
 if(!complete&&existing&&!withinWindow(day,now)&&existing.sourceCount===capture.tarifas)continue;
 const incoming=await downloadCapture({request,capture:day,watermark,ids:allowed});
 // Source can grow during pagination: new IDs above watermark belong to the next run.
 // A stable bound fixes IDs, not concurrent edits. Re-read recent captures every run.
 if(incoming.length<capture.tarifas){const latest=await request('/v1/capturas');const current=latest.capturas?.find(c=>c.fecha===day);if(current?.tarifas===capture.tarifas)throw Error('Captura incompleta: faltan tarifas respecto al conteo de origen.');throw Error('La captura cambió durante la lectura; se reintentará sin reemplazar datos.');}
 const merged=mergeRows(existing?JSON.parse(existing.payload):[],incoming);const payload=JSON.stringify(merged);
 await tx.offersHunterCapture.upsert({where:{captureDate:day},create:{captureDate:day,payload,rates:merged.length,sourceCount:capture.tarifas,snapshotUntilId:watermark,updatedAt:new Date(now)},update:{payload,rates:merged.length,sourceCount:capture.tarifas,snapshotUntilId:watermark,updatedAt:new Date(now)}});refreshed++;
 }
 const stats=await tx.offersHunterCapture.findMany({select:{rates:true}});const totalRates=stats.reduce((n,c)=>n+c.rates,0);const values={lastSuccessAt:new Date(now),lastError:null,lastWatermark:watermark,totalRates,...(complete?{lastFullAt:new Date(now)}:{})};
 await tx.offersHunterSyncState.upsert({where:{id:1},create:{id:1,...values},update:values});return {totalRates,refreshed,watermark};
 },{maxWait:5000,timeout:600000});}catch(error){const message=String(error.message||'Error de sincronización').slice(0,400);try{await prisma.offersHunterSyncState.upsert({where:{id:1},create:{id:1,lastError:message},update:{lastError:message}});}catch{}throw Error(message);}
}
function replaceLine(html,prefix,value){const match=html.indexOf('\n'+prefix);const start=html.startsWith(prefix)?0:match<0?-1:match+1;if(start<0)throw Error('No se encontró la referencia del runtime.');const end=html.indexOf(';\n',start);if(end<0)throw Error('Referencia incompleta.');return html.slice(0,start)+prefix+JSON.stringify(value).replace(/<\//g,'<\\/')+html.slice(end);}
function renderHtml(html,rows,metadata,status){let out=replaceLine(html,'const CAZADOR_V2_20261110 = ',rows);out=replaceLine(out,'const HUNTER_RATE_META=',metadata);out=replaceLine(out,'const HUNTER_SYNC_STATUS=',status);return out;}
module.exports={parseConfig,validateRow,mergeRows,downloadCapture,synchronize,withinWindow,renderHtml};
