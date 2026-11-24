// Internal catalog and commercial API share AvioaHunterSelection; no database writes.
(function(){
 'use strict';
 const S=globalThis.AvioaHunterSelection;
 if(!S||typeof hunterServiceRate!=='function'||typeof v2CatalogoPrecios!=='function')throw Error('Versión de catálogo incompatible con la selección compartida.');
 const epoch=Number(globalThis.AvioaHunterSelectionEpoch)||Date.now(),wallStart=Date.now(),start=globalThis.performance?.now?.();
 function clock(){return start===undefined?epoch+Date.now()-wallStart:epoch+globalThis.performance.now()-start;}
 function ranked(h){return S.selectRows(h.v2Paquetes||[],{now:clock()});}
 function scoped(h){
  const s=state.catalogo,data=ranked(h),capture=s.captura&&s.captura!=='TODAS'?s.captura:null;
  return (capture?data.all.filter(r=>r._avioa_selection.capture===capture):data.current)
   .filter(r=>(!s.origen||s.origen==='TODOS'||r.origen===s.origen)&&(!s.regimen||s.regimen==='TODOS'||S.norm(r.regimen)===S.norm(s.regimen)))
   .map(r=>hunterServiceRate(h,r)).sort(hunterCompareTariffs);
 }
 v2CatalogoOpciones=function(h,includeHistory=false){const data=ranked(h);return (includeHistory?data.all:data.current).filter(r=>r._avioa_selection.recommended).map(r=>hunterServiceRate(h,r));};
 hunterCatalogRows=function(h){return scoped(h).filter(r=>r._avioa_selection.recommended);};
 v2CatalogoSeleccion=function(h){const rows=scoped(h);return rows.find(r=>String(r.id)===String(state.catalogo.v2Paquete))||rows.find(r=>r._avioa_selection.recommended)||rows[0]||null;};
 function card(h,r){
  const m=r._avioa_selection,selected=String(v2CatalogoSeleccion(h)?.id)===String(r.id);
  const flight=ecSafeLink(r.link_vuelo),hotel=ecSafeLink(r.deeplink_hotel);
  const delta=m.difference;
  return `<div class="ec-offer ${selected?'current':''}"><div class="ec-offer-title"><b>${esc(r.origen)} → ${esc(r.destino_vuelo)} · ${ecFriendlyDate(r.ida)} al ${ecFriendlyDate(r.regreso)}</b><span class="ec-tag">${esc(r.noches)} noches</span></div>
   <p>${esc(r.habitacion||'Habitación no especificada')} · Régimen: <b>${esc(S.norm(r.regimen)==='solo habitacion'?'Solo alojamiento (sin alimentación)':r.regimen||'No especificado')}</b></p>
   <p class="ec-small"><b>Paquete #${esc(r.id)}</b> · Captura ${esc(m.capture)} · ${m.current?'Captura más reciente':'Captura anterior'} · ${m.recommended?'Recomendada en esta captura':'Otra tarifa o habitación'}</p>
   <div style="margin:8px 0">${v2CatalogoEstado(r)}</div>
   <div class="between"><div><div class="ec-price">${ecCurrency(r.precio_paquete_persona,r.moneda)}</div><span class="ec-small">Por persona · ocupación ${esc((()=>{try{const m=/^(\d+)-0$/.exec(new URL(r.deeplink_hotel).searchParams.get('distribution')||'');return m?m[1]+' adultos':'no especificada';}catch{return 'no especificada';}})())}</span></div><button type="button" class="tiny-action" data-hunter-source-select="${esc(r.id)}" data-hunter-source-hotel="${esc(h.hotel_id)}">${selected?'Seleccionado':'Seleccionar'}</button></div>
   ${delta?`<p class="ec-small">Diferencia ${r.serviceBreakdown?.transferStatus==='PENDIENTE'?'del importe parcial':'total'} frente al paquete #${esc(delta.registro_recomendado)}: ${delta.valor>=0?'+':''}${ecCurrency(delta.valor,delta.moneda)} por persona.${delta.cancelacion_equivalente?'':' Equivalencia de cancelación no comprobada.'}</p>`:''}
   <details class="ec-v2-terms"><summary>Ver desglose y cancelación</summary><p class="ec-small" style="white-space:pre-line">${esc(hunterServicesText(r))}</p><p><b>Política:</b> ${esc(r.politica_cancelacion||'No informada.')}</p>${r.penalidad_cancelacion?`<p><b>Penalidad:</b> ${esc(r.penalidad_cancelacion)}</p>`:''}<p><b>Selección:</b> ${esc(m.criterion)}</p></details>
   <div class="ec-inline-links">${flight?`<a target="_blank" rel="noopener noreferrer" href="${esc(flight)}">Referencia de vuelo ↗</a>`:''}${hotel?`<a target="_blank" rel="noopener noreferrer" href="${esc(hotel)}">Consultar hotel ↗</a>`:''}</div></div>`;
 }
 v2CatalogoPrecios=function(h){
  const s=state.catalogo,rows=scoped(h),main=rows.filter(r=>r._avioa_selection.recommended),alternatives=rows.filter(r=>!r._avioa_selection.recommended),selected=v2CatalogoSeleccion(h),limit=s.v2Limite||4;
  const history=ranked(h).history.filter(r=>(!s.origen||s.origen==='TODOS'||r.origen===s.origen)&&(!s.regimen||s.regimen==='TODOS'||S.norm(r.regimen)===S.norm(s.regimen))).map(r=>hunterServiceRate(h,r));
  const extras=selected&&!main.some(r=>r.id===selected.id)?card(h,selected):'';
  const limits=s.selectionLimits||{},altLimit=limits[h.hotel_id+'-alternatives']||20,historyLimit=limits[h.hotel_id+'-history']||20;
  const expand=(kind)=>`<button type="button" class="tiny-action" data-hunter-selection-expand="${kind}" data-hunter-source-hotel="${esc(h.hotel_id)}">Ver más</button>`;
  const finder=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0"><label>Localizar paquete # <input class="input" style="width:140px" inputmode="numeric" data-hunter-source-id="${esc(h.hotel_id)}" id="hunter-source-${esc(h.hotel_id)}" placeholder="Ej. 178994"/></label><button type="button" class="tiny-action" data-hunter-source-find="${esc(h.hotel_id)}">Localizar</button></div>`;
  return `<p class="ec-small">Última captura por ruta, fechas, régimen y ocupación. Para viajes a más de 30 días se prioriza cancelación gratuita verificable; después, precio.</p>${finder}${extras}${main.slice(0,limit).map(r=>card(h,r)).join('')||'<p>No hay tarifas recomendadas para estos filtros.</p>'}${main.length>limit?'<button type="button" class="tiny-action" data-v2-action="mas">Ver más salidas</button>':''}
   ${alternatives.length?`<details ${altLimit>20?'open':''}><summary>Otras habitaciones y tarifas · ${alternatives.length}</summary>${alternatives.filter(r=>r.id!==selected?.id).slice(0,altLimit).map(r=>card(h,r)).join('')}${alternatives.length>altLimit?expand('alternatives'):''}</details>`:''}
   ${(!s.captura||s.captura==='TODAS')&&history.length?`<details ${historyLimit>20?'open':''}><summary>Capturas anteriores dentro de 72 horas · ${history.length}</summary><p class="ec-small">Se conservan para consulta; la API utiliza la captura más reciente del grupo comparable.</p>${history.slice(0,historyLimit).map(r=>card(h,r)).join('')}${history.length>historyLimit?expand('history'):''}</details>`:''}`;
 };
 function locate(hotelId,value,search=true){
  const id=String(value||'').trim();if(!/^\d+$/.test(id)){flash('Escribe el identificador numérico del paquete.');return;}
  const h=CATALOGO_CAZADOR_VISUAL.find(x=>String(x.hotel_id)===String(hotelId));
  const r=h&&ranked(h).all.find(x=>String(x.id)===id);
  if(!r){flash('Ese paquete no está entre las tarifas comparables de este hotel dentro de las últimas 72 horas.');return;}
  state.catalogo.v2Paquete=r.id;
  if(search)Object.assign(state.catalogo,{origen:r.origen,regimen:r.regimen,captura:r._avioa_selection.capture});
  else if(!r._avioa_selection.current)state.catalogo.captura=r._avioa_selection.capture;
  render();
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-hunter-source-find],[data-hunter-source-select],[data-hunter-selection-expand]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(b.hasAttribute('data-hunter-selection-expand')){const limits=state.catalogo.selectionLimits||={};const key=b.dataset.hunterSourceHotel+'-'+b.dataset.hunterSelectionExpand;limits[key]=(limits[key]||20)+20;render();}else if(b.hasAttribute('data-hunter-source-select'))locate(b.dataset.hunterSourceHotel,b.dataset.hunterSourceSelect,false);else locate(b.dataset.hunterSourceFind,document.getElementById('hunter-source-'+b.dataset.hunterSourceFind)?.value);},true);
 document.addEventListener('keydown',e=>{if(e.key!=='Enter'||!e.target.matches('[data-hunter-source-id]'))return;e.preventDefault();e.stopImmediatePropagation();locate(e.target.dataset.hunterSourceId,e.target.value);},true);
})();
