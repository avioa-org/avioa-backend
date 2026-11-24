function hunterServiceRate(h,p){
 const round=n=>Math.round(n*100)/100;
 const originalBase=Number(p.precio_base_vuelo_hotel_original??p.precio_base_vuelo_hotel??p.precio_paquete_persona);
 const flightBase=Number(p.precio_vuelo),flightTA=round(flightBase*HUNTER_SERVICES.flightTAPercent/100);
 const flightTotal=round(flightBase+flightTA),base=round(originalBase+flightTA);
 const domestic=HUNTER_SERVICES.domesticDestinations.includes(h.destino);
 const dateDays=(Date.parse(p.regreso)-Date.parse(p.ida))/86400000+1;
 const days=Number.isInteger(dateDays)&&dateDays>0?dateDays:Number(p.noches)+1,serviceTAPercent=HUNTER_SERVICES.serviceTAPercent;
 const medicalDailyBase=domestic?HUNTER_SERVICES.medicalDomesticPerDay:HUNTER_SERVICES.medicalInternationalPerDay;
 const medicalDailyTA=round(medicalDailyBase*serviceTAPercent/100),medicalDaily=round(medicalDailyBase+medicalDailyTA);
 const transfer=HUNTER_TRANSFER_AMOUNTS.get(hunterHotelKey(h.hotel_id));
 const transferBase=domestic?0:transfer??null;
 const transferTA=transferBase===null?null:round(transferBase*serviceTAPercent/100);
 const services={flightTAPercent:HUNTER_SERVICES.flightTAPercent,flightBase,flightTA,flightTotal,hotelTAAlreadyIncluded:true,ruleId:HUNTER_SERVICES.id,currency:'COP',basis:'POR_PERSONA',days,serviceTAPercent,medicalDailyBase,medicalDailyTA,medicalDaily,medicalBase:round(days*medicalDailyBase),medicalTA:round(days*medicalDailyTA),medicalTotal:round(days*medicalDaily),
  transferStatus:domestic?'NO_APLICA':transfer===undefined?'PENDIENTE':'INCLUIDO',transferBase,transferTA,transferAmount:transferBase===null?null:round(transferBase+transferTA)};
 const total=round(base+services.medicalTotal+(services.transferAmount??0));
 return {...p,precio_base_vuelo_hotel_original:originalBase,precio_vuelo_con_ta:flightTotal,precio_base_vuelo_hotel:base,precio_paquete_persona:total,serviceBreakdown:services};
}

function hunterServicesText(p){
 const s=p.serviceBreakdown;if(!s)return '';
 const transfer=s.transferStatus==='INCLUIDO'?`Traslado original: ${ecCurrency(s.transferBase,'COP')} por persona\nTA del traslado (${s.serviceTAPercent}%): ${ecCurrency(s.transferTA,'COP')}\nTraslado con TA: ${ecCurrency(s.transferAmount,'COP')} por persona`:s.transferStatus==='NO_APLICA'?'Traslados: no aplica para nacionales':'Traslado pendiente de cotizar; no incluido en el total parcial';
 return `Vuelo original: ${ecCurrency(s.flightBase,'COP')}\nTA del vuelo (${s.flightTAPercent}%): ${ecCurrency(s.flightTA,'COP')}\nVuelo con TA: ${ecCurrency(s.flightTotal,'COP')}\nHotel: TA del 18% ya incluida en el valor de origen\nVuelo + hotel con TA: ${ecCurrency(p.precio_base_vuelo_hotel,'COP')}\n${transfer}\nAsistencia médica original: ${s.days} días × ${ecCurrency(s.medicalDailyBase,'COP')} = ${ecCurrency(s.medicalBase,'COP')}\nTA de la asistencia médica (${s.serviceTAPercent}%): ${ecCurrency(s.medicalTA,'COP')}\nAsistencia médica con TA: ${s.days} días × ${ecCurrency(s.medicalDaily,'COP')} = ${ecCurrency(s.medicalTotal,'COP')} por persona\n${s.transferStatus==='PENDIENTE'?'Total parcial':'Total del plan'}: ${ecCurrency(p.precio_paquete_persona,'COP')} por persona`;
}

function v2CatalogoEstado(p){
 if(p.cancelacion_gratuita===1)return `<span class="ec-v2-status free">Cancelación gratuita${p.cancelacion_gratis_hasta?' hasta '+esc(ecFriendlyDate(p.cancelacion_gratis_hasta)):' · fecha no indicada'}</span>`;
 if(p.cancelacion_gratuita===0)return '<span class="ec-v2-status nonref">No reembolsable</span>';
 return '<span class="ec-v2-status">Cancelación sin verificar</span>';
}
