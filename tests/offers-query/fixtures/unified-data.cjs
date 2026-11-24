'use strict';
const C=require('../../../src/modules/offers-query/engine.cjs');
const now=Date.parse('2026-11-24T20:00:00Z');
const row=(patch={})=>({id:178994,id_vuelo:1,origen:'MDE',destino_vuelo:'PUJ',hotel_code:'MASTER-126275',habitacion:'Suite',regimen:'TODO INCLUIDO',ida:'2027-07-06',regreso:'2027-07-09',noches:3,precio_vuelo:1036436,precio_hotel_total:4481096,precio_paquete_persona:3276984,moneda:'COP',deeplink_hotel:'https://private.test/?distribution=2-0',link_vuelo:'https://example.test/flight',fecha_consulta:'2026-11-24',cancelacion_gratuita:1,cancelacion_gratis_hasta:'2027-05-19',politica_cancelacion:'NEST SUITE Sin gastos de cancelación hasta el 19 may 2027',penalidad_cancelacion:'Después aplica penalidad',criterio_seleccion:'prioriza_cancelacion_gratuita',...patch});
const config={hotels:[{id:'MASTER-126275',name:'Nickelodeon Hotels & Resorts Punta Cana by Karisma',destination:'Punta Cana'}],services:{flightTAPercent:18,serviceTAPercent:18,domesticDestinations:[],medicalInternationalPerDay:10000,medicalDomesticPerDay:1600,transferGroups:[{hotelIds:['MASTER-126275'],amount:100000}]}};
const rows=()=>[
 row({id:170382,fecha_consulta:'2026-11-22',precio_vuelo:1028579,precio_paquete_persona:3172935,cancelacion_gratuita:null,cancelacion_gratis_hasta:null,politica_cancelacion:'NEST SUITE',penalidad_cancelacion:null}),
 row({id:102,fecha_consulta:'2026-11-23',precio_vuelo:1029323,precio_paquete_persona:3214477,cancelacion_gratuita:null,cancelacion_gratis_hasta:null,politica_cancelacion:'NEST SUITE',penalidad_cancelacion:null}),
 row(),
 row({id:500001,habitacion:'Suite Pad',precio_paquete_persona:3500000,politica_cancelacion:'PAD SUITE Sin gastos de cancelación hasta el 19 may 2027'}),
 row({id:178993,habitacion:'Suite con piscina',regimen:'SOLO HABITACION',precio_paquete_persona:6608813}),
 row({id:178992,habitacion:'Villa',regimen:'DESAYUNO',precio_paquete_persona:11765872}),
];
const model=(items=rows(),opts={})=>C.build({config,rows:items,payload:{offers:[]},revision:28,now,...opts});


module.exports={row,rows,config,now,model};
