'use strict';
// Single commercial read model for the portal simulator and the external API.
const { createHash, timingSafeEqual } = require('node:crypto');
const hash = x => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const norm = x => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Match whole normalized words: "Divi" must not match "Individuals".
function matchesWords(text, query) {
    const terms = norm(query).split(' ').filter(Boolean);
    if (!terms.length)
        return false;
    const words = new Set(norm(text).split(' ').filter(Boolean));
    return terms.every(term => words.has(term));
}
const code = x => String(x ?? '').trim().toUpperCase();
// Explicitly confirmed identity; never infer hotel equivalence from similar names.
function hotelIdentity(hotel, destination, destinationName) {
    const diviNames = ['divi dutch village', 'divi dutch village beach resort'];
    const aruba = code(destination) === 'AUA' || norm(destinationName) === 'aruba';
    if (aruba && diviNames.includes(norm(hotel.nombre)) && (!hotel.id || String(hotel.id) === '73440'))
        return { id: '73440', nombre: 'Divi Dutch Village Beach Resort' };
    return hotel;
}
const day = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x;
const clean = x => String(x ?? '').replace(/\s*\(Respuesta principal para este destino\)/gi, '').trim();
const strings = a => (Array.isArray(a) ? a : []).map(x => clean(typeof x === 'string' ? x : x?.text)).filter(Boolean);
const round = x => Math.round(x * 100) / 100;
const money = p => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(p.valor) + ' ' + p.moneda;
const cityNames = { MDE: 'Medellín', BOG: 'Bogotá', CTG: 'Cartagena', PUJ: 'Punta Cana', CUN: 'Cancún', AUA: 'Aruba', ADZ: 'San Andrés', MIA: 'Miami', MCO: 'Orlando', BLB: 'Ciudad de Panamá', PTY: 'Ciudad de Panamá', MAD: 'Madrid', MEX: 'Ciudad de México', CUR: 'Curazao', SMR: 'Santa Marta', EZE: 'Buenos Aires', SJD: 'Los Cabos', MBJ: 'Jamaica', GIG: 'Río de Janeiro', LIM: 'Lima', LET: 'Amazonas' };
class QueryError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (message) => { throw new QueryError(400, 'consulta_invalida', message); };
function jsonConstant(html, prefix) { const i = html.indexOf(prefix); if (i < 0)
    throw Error('Falta configuración comercial ' + prefix); return JSON.parse(html.slice(i + prefix.length, html.indexOf(';\n', i))); }
function settings(html) {
    const hotels = jsonConstant(html, 'const CATALOGO_CAZADOR = '), services = jsonConstant(html, 'const HUNTER_SERVICES=');
    if (!Array.isArray(hotels) || !Array.isArray(services.transferGroups) || services.flightTAPercent !== 18 || services.serviceTAPercent !== 18)
        throw Error('Configuración comercial incompatible');
    if (!['medicalInternationalPerDay', 'medicalDomesticPerDay'].every(k => Number.isFinite(services[k]) && services[k] > 0) || !Array.isArray(services.domesticDestinations) || services.transferGroups.some(g => !Array.isArray(g.hotelIds) || !Number.isFinite(g.amount) || g.amount < 0))
        throw Error('Servicios comerciales inválidos');
    return { hotels: hotels.map(h => ({ id: code(h.hotel_id), name: clean(h.nombre), destination: clean(h.destino) })), services };
}
function captureTime(raw) {
    const s = String(raw ?? '').trim();
    if (day(s))
        return Date.parse(s + 'T00:00:00-05:00');
    // SQLite naive timestamps have no established zone: use the known capture day conservatively.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/.test(s))
        return Date.parse(s);
    return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(s) && day(s.slice(0, 10)) ? Date.parse(s.slice(0, 10) + 'T00:00:00-05:00') : NaN;
}
function distribution(raw) { try {
    return new URL(raw).searchParams.get('distribution');
}
catch {
    return null;
} }
function occupied(raw) { try {
    const s = new URL(raw).searchParams.get('distribution');
    const m = /^(\d+)-0$/.exec(s || '');
    return m ? Number(m[1]) : null;
}
catch {
    return null;
} }
function dateOption(d) {
    if (day(d.start) && day(d.end))
        return { fecha_salida: d.start, fecha_regreso: d.end, fecha_parcial: null, texto_fecha: null };
    const a = d.partialStart || d.departure, b = d.partialEnd || d.return;
    if (a && b)
        return { fecha_salida: null, fecha_regreso: null, fecha_parcial: { salida: String(a), regreso: String(b), anio: d.year ? Number(d.year) : null, anio_regreso: d.endYear ? Number(d.endYear) : d.year ? Number(d.year) : null }, texto_fecha: String(a) + ' al ' + String(b) };
    return null;
}
function productOptions(o, today) {
    const result = [];
    for (const p of o.periods || []) {
        const dates = [p, ...(p.extraDates || []), ...(p.sourceDates || []).filter(d => !d.resolvedKey)].map(dateOption).filter(Boolean);
        const unique = [...new Map(dates.map(d => [JSON.stringify(d), d])).values()];
        if (!unique.length)
            unique.push({ fecha_salida: null, fecha_regreso: null, fecha_parcial: null, texto_fecha: clean(p.label) || null });
        for (const v of (o.variants || []).filter(v => v.periodId === p.id)) {
            if (!Number.isFinite(Number(v.price)) || Number(v.price) <= 0 || !['COP', 'USD', 'MXN'].includes(v.currency || 'COP'))
                continue;
            if (/agotad|expirad/.test(norm(v.availability)))
                continue;
            const basis = { POR_PERSONA: 'por_persona', POR_PAREJA: 'por_pareja', POR_PAQUETE: 'por_paquete', POR_GRUPO: 'por_paquete' }[v.basis];
            if (!basis)
                continue;
            const base = code(v.occupancy) === 'DOBLE' ? 2 : code(v.occupancy) === 'TRIPLE' ? 3 : code(v.occupancy) === 'SENCILLA' ? 1 : null;
            for (const d of unique) {
                if (d.fecha_salida && d.fecha_salida < today)
                    continue;
                const id = 'popt_' + hash([o.id, p.id, v.id, d]).slice(0, 28);
                result.push({ id, ...d, noches: Number.isInteger(p.nights) && p.nights > 0 ? p.nights : null, dias: d.fecha_salida ? (Date.parse(d.fecha_regreso) - Date.parse(d.fecha_salida)) / 86400000 + 1 : Number.isInteger(p.nights) ? p.nights + 1 : null,
                    hotel: { id: null, nombre: clean(v.hotel || v.name) || null }, habitacion: clean(v.room) || null, regimen: clean(v.meal) || null,
                    precio: { valor: Number(v.price), moneda: v.currency || 'COP', unidad: basis, ocupacion_base: base, es_total_parcial: false },
                    capturado_en: null, actualizado_en: typeof o.updatedAt === 'string' ? o.updatedAt : null, vigente_hasta: null,
                    promociones: (o.promos || []).filter(x => (x.variantIds || []).includes(v.id)).map(x => ({ titulo: clean(x.title), detalle: clean(x.notes) || null })),
                    servicios_incluidos: [], servicios_pendientes: [], cancelacion: null });
            }
        }
    }
    return result;
}
function dedupHunter(rows, now) {
    const latest = new Map();
    for (const r of rows) {
        const t = captureTime(r.fecha_consulta);
        if (!(now >= t && now - t < 72 * 3600000))
            continue;
        // Price, source row ID and capture are deliberately absent from the equivalence key.
        const key = JSON.stringify([code(r.origen), code(r.destino_vuelo), code(r.hotel_code), r.ida, r.regreso, Number(r.noches), norm(r.habitacion), norm(r.regimen), distribution(r.deeplink_hotel), r.moneda,
            r.cancelacion_gratuita ?? null, r.cancelacion_gratis_hasta ?? null, norm(r.politica_cancelacion), norm(r.penalidad_cancelacion), norm(r.proveedor_hotel)]);
        const before = latest.get(key);
        if (!before || t > before.t || t === before.t && Number(r.id) > Number(before.r.id))
            latest.set(key, { r, t, key });
    }
    return [...latest.values()];
}
function build({ payload, rows, config, revision = 0, sync = null, now = Date.now() }) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const groups = [];
    for (const o of payload.offers || []) {
        if (o.archived === true || o.pilotReference && o.pilotEdited !== true)
            continue;
        if (/agotad|expirad/.test(norm(o.status)))
            continue;
        const options = productOptions(o, today);
        for (const option of options)
            option.hotel = hotelIdentity(option.hotel, o.dest, o.destName);
        if (!options.length)
            continue;
        groups.push({ id: 'p_' + Buffer.from(String(o.id)).toString('base64url'), tipo: ({ VUELO_HOTEL: 'vuelo_hotel', CRUCERO: 'crucero', CIRCUITO: 'circuito' })[o.kind] || 'otro', fuente: 'producto', titulo: clean(o.title), origen: { codigo: code(o.origin) || null, nombre: cityNames[code(o.origin)] || code(o.origin) || null }, destino: { codigo: code(o.dest) || null, nombre: clean(o.destName || cityNames[code(o.dest)] || o.dest) }, incluye: strings(o.includes), no_incluye: strings(o.excludes), condiciones: strings(o.conditions), options, prioridad: Number(payload.productoDefaults?.[code(o.origin) + '|' + norm(o.destName || o.dest)]) > 0 && Number(payload.productoDefaults[code(o.origin) + '|' + norm(o.destName || o.dest)]) === Number(o.sourceCampaignRow || String(o.workbookKey || '').replace('BOT-C', '')) ? 2 : o.defaultForDestination === true ? 1 : 0 });
    }
    const hotels = new Map(config.hotels.map(h => [h.id, h])), transfer = new Map(config.services.transferGroups.flatMap(g => g.hotelIds.map(id => [code(id), Number(g.amount)])));
    const bucket = new Map();
    for (const { r, t, key } of dedupHunter(rows, now)) {
        const h = hotels.get(code(r.hotel_code));
        if (!h || !day(r.ida) || !day(r.regreso) || r.ida < today || r.moneda !== 'COP' || !Number.isInteger(r.noches) || r.noches < 1)
            continue;
        if (norm(h.destination + ' ' + h.name).includes('miami') && ['MCO', 'ORL', 'SFB'].includes(code(r.destino_vuelo)))
            continue;
        const days = (Date.parse(r.regreso) - Date.parse(r.ida)) / 86400000 + 1;
        if (!Number.isInteger(days) || days < r.noches + 1)
            continue;
        const flight = Number(r.precio_vuelo), base = Number(r.precio_paquete_persona);
        if (!(Number.isFinite(flight) && Number.isFinite(base) && flight > 0 && base > 0))
            continue;
        const domestic = config.services.domesticDestinations.some(x => norm(x) === norm(h.destination));
        const transferBase = domestic ? null : transfer.get(h.id), daily = domestic ? config.services.medicalDomesticPerDay : config.services.medicalInternationalPerDay;
        const medical = round(days * round(daily * 1.18)), transferTotal = transferBase === undefined || transferBase === null ? 0 : round(transferBase * 1.18);
        const missing = !domestic && transferBase === undefined;
        const option = { id: 'hopt_' + hash(key).slice(0, 28), fecha_salida: r.ida, fecha_regreso: r.regreso, fecha_parcial: null, texto_fecha: null, noches: r.noches, dias: days, hotel: { id: h.id, nombre: h.name }, habitacion: clean(r.habitacion) || null, regimen: clean(r.regimen) || null,
            precio: { valor: round(base + round(flight * .18) + medical + transferTotal), moneda: 'COP', unidad: 'por_persona', ocupacion_base: occupied(r.deeplink_hotel), es_total_parcial: missing }, capturado_en: new Date(t).toISOString(), actualizado_en: new Date(t).toISOString(), vigente_hasta: new Date(t + 72 * 3600000).toISOString(), promociones: [],
            servicios_incluidos: ['Vuelo ida y regreso', 'Alojamiento', 'Alimentación: ' + clean(r.regimen), 'Asistencia médica: ' + days + ' días', ...(transferTotal ? ['Traslados'] : [])], servicios_pendientes: missing ? ['Traslados'] : [],
            cancelacion: { gratuita: r.cancelacion_gratuita === null || r.cancelacion_gratuita === undefined ? null : !!r.cancelacion_gratuita, hasta: r.cancelacion_gratis_hasta || null, politica: clean(r.politica_cancelacion) || null, penalidad: clean(r.penalidad_cancelacion) || null } };
        const id = 'h_' + Buffer.from(JSON.stringify([h.id, code(r.origen), code(r.destino_vuelo)])).toString('base64url');
        if (!bucket.has(id))
            bucket.set(id, { id, tipo: 'vuelo_hotel', fuente: 'cazador', titulo: h.name, origen: { codigo: code(r.origen), nombre: cityNames[code(r.origen)] || code(r.origen) }, destino: { codigo: code(r.destino_vuelo), nombre: h.destination }, incluye: [], no_incluye: ['Equipaje adicional, tours y entradas'], condiciones: [], options: [], prioridad: 0 });
        bucket.get(id).options.push(option);
    }
    groups.push(...bucket.values());
    for (const g of groups) {
        for (const option of g.options)
            option.hotel = hotelIdentity(option.hotel, g.destino.codigo, g.destino.nombre);
        g.options.sort(compareOption);
    }
    return { groups, now, revision, sync, snapshot: hash(['commercial-v1-identity-words', revision, groups.map(g => [g.id, g.options.map(o => [o.id, o.precio, o.actualizado_en])])]).slice(0, 32) };
}
function compareOption(a, b) { return a.precio.moneda.localeCompare(b.precio.moneda) || a.precio.unidad.localeCompare(b.precio.unidad) || a.precio.valor - b.precio.valor || String(a.fecha_salida || '').localeCompare(String(b.fecha_salida || '')) || a.id.localeCompare(b.id); }
const allowed = ['q', 'origen', 'destino', 'hotel', 'fecha_desde', 'fecha_hasta', 'adultos', 'tipo', 'fuente', 'regimen', 'precio_max', 'moneda', 'unidad', 'noches', 'limit', 'cursor', 'seleccion', 'opcion'];
function validate(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        fail('Consulta inválida.');
    const q = {};
    for (const [k, v] of Object.entries(input)) {
        if (!allowed.includes(k))
            fail('Filtro no reconocido: ' + k);
        if (typeof v !== 'string' && typeof v !== 'number')
            fail('Cada filtro debe tener un solo valor.');
        if (String(v).length > (k === 'cursor' ? 1600 : 240))
            fail('Filtro demasiado largo.');
        if (String(v).trim())
            q[k] = String(v).trim();
    }
    for (const k of ['fecha_desde', 'fecha_hasta'])
        if (q[k] && !day(q[k]))
            fail('Usa fechas ISO YYYY-MM-DD.');
    if (q.fecha_desde && q.fecha_hasta && q.fecha_desde > q.fecha_hasta)
        fail('El rango de fechas está invertido.');
    for (const k of ['limit', 'adultos', 'noches'])
        if (q[k] && (!/^\d+$/.test(q[k]) || +q[k] < 1 || +q[k] > (k === 'limit' ? 50 : k === 'adultos' ? 20 : 365)))
            fail('Valor inválido para ' + k);
    if (q.precio_max && (!/^(?:\d+)(?:\.\d{1,2})?$/.test(q.precio_max) || !Number.isFinite(+q.precio_max)))
        fail('Precio máximo inválido.');
    if (q.precio_max && (!q.moneda || !q.unidad))
        fail('Para comparar precios indica moneda y unidad.');
    if (q.fuente && !['producto', 'cazador'].includes(q.fuente))
        fail('Fuente inválida.');
    if (q.moneda && !['COP', 'USD', 'MXN'].includes(code(q.moneda)))
        fail('Moneda inválida.');
    if (q.tipo && !['vuelo_hotel', 'crucero', 'circuito', 'otro'].includes(q.tipo))
        fail('Tipo inválido.');
    if (q.unidad && !['por_persona', 'por_pareja', 'por_paquete'].includes(q.unidad))
        fail('Unidad inválida.');
    return q;
}
function matchesCity(city, value) { return !value || code(value) === city.codigo || norm(value) === norm(city.nombre); }
function filtered(model, q) {
    const out = [];
    for (const g of model.groups) {
        if (!matchesCity(g.origen, q.origen) || !matchesCity(g.destino, q.destino) || q.fuente && q.fuente !== g.fuente || q.tipo && q.tipo !== g.tipo)
            continue;
        const options = g.options.filter(o => {
            if (q.hotel && code(q.hotel) !== code(o.hotel.id) && !matchesWords(o.hotel.nombre, q.hotel))
                return false;
            if (q.regimen && !norm(o.regimen).includes(norm(q.regimen)))
                return false;
            if ((q.fecha_desde || q.fecha_hasta) && (!o.fecha_salida || q.fecha_desde && o.fecha_salida < q.fecha_desde || q.fecha_hasta && o.fecha_salida > q.fecha_hasta))
                return false;
            if (q.adultos && o.precio.ocupacion_base !== Number(q.adultos))
                return false;
            if (q.moneda && code(q.moneda) !== o.precio.moneda || q.unidad && q.unidad !== o.precio.unidad || q.precio_max && o.precio.valor > +q.precio_max || q.noches && o.noches !== +q.noches)
                return false;
            if (q.q) {
                const hay = norm([g.titulo, g.origen.codigo, g.origen.nombre, g.destino.codigo, g.destino.nombre, o.hotel.nombre].join(' '));
                if (!matchesWords(hay, q.q))
                    return false;
            }
            return true;
        });
        if (options.length)
            out.push({ ...g, options });
    }
    return out.sort((a, b) => b.prioridad - a.prioridad || (a.fuente === b.fuente ? 0 : a.fuente === 'producto' ? -1 : 1) || compareOption(a.options[0], b.options[0]) || a.id.localeCompare(b.id));
}
function publicGroup(g, maxOptions = 5) { const { options, prioridad, ...rest } = g; return { ...rest, precio_desde: options[0].precio, opciones: options.slice(0, maxOptions), total_opciones: options.length, opciones_truncadas: options.length > maxOptions, comercial: { titulo: g.titulo, mensaje_whatsapp: message(g, options.slice(0, maxOptions)) } }; }
function page(items, q, model, scope = 'ofertas') {
    const size = +(q.limit || 20), signature = hash([scope, Object.entries(q).filter(([k]) => !['cursor', 'limit'].includes(k)).sort()]);
    let offset = 0;
    if (q.cursor) {
        let c;
        try {
            c = JSON.parse(Buffer.from(q.cursor, 'base64url').toString());
        }
        catch {
            fail('Cursor inválido.');
        }
        if (c.snapshot !== model.snapshot)
            throw new QueryError(409, 'catalogo_actualizado', 'El catálogo cambió; reinicia la consulta sin cursor.');
        if (c.signature !== signature || !Number.isSafeInteger(c.offset) || c.offset < 0)
            fail('El cursor no corresponde a estos filtros.');
        offset = c.offset;
    }
    const next = offset + size < items.length ? Buffer.from(JSON.stringify({ snapshot: model.snapshot, signature, offset: offset + size })).toString('base64url') : null;
    return { items: items.slice(offset, offset + size), total: items.length, next_cursor: next, snapshot: model.snapshot };
}
function message(g, options = g.options) {
    if (!options.length)
        return '';
    let list = options;
    if (g.fuente === 'cazador') {
        const first = options[0], seen = new Set();
        list = options.filter(o => o.regimen === first.regimen && o.noches === first.noches).filter(o => { const k = o.fecha_salida + '|' + o.fecha_regreso; if (seen.has(k))
            return false; seen.add(k); return true; }).slice(0, 4);
    }
    const pretty = d => new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d + 'T12:00:00Z'));
    const dateLabel = o => o.fecha_salida ? pretty(o.fecha_salida) + ' al ' + pretty(o.fecha_regreso) : o.texto_fecha || '';
    const labelMeal = r => ({ ALIMENTACION_COMPLETA_SNACKS_BAR: 'Alimentación completa, snacks y bar abierto', TODO_INCLUIDO: 'Todo incluido', SOLO_HABITACION: 'Solo habitación', DESAYUNO: 'Desayuno', MEDIA_PENSION: 'Media pensión', PENSION_COMPLETA: 'Pensión completa' })[r] || String(r || '').replace(/_/g, ' ');
    const unit = p => ({ por_persona: 'por persona', por_pareja: 'por pareja', por_paquete: 'por paquete' })[p.unidad];
    const rateKey = o => JSON.stringify([o.hotel, o.habitacion, o.regimen, o.precio, o.promociones]);
    // First collect all hotel/rate choices for a date, then combine dates with identical choices.
    const dateRows = new Map();
    for (const o of list) {
        const key = JSON.stringify([o.dias, o.noches, o.fecha_salida, o.fecha_regreso, o.fecha_parcial, o.texto_fecha]);
        if (!dateRows.has(key))
            dateRows.set(key, { date: o, rates: new Map() });
        dateRows.get(key).rates.set(rateKey(o), o);
    }
    const blocks = new Map();
    for (const d of dateRows.values()) {
        const rates = [...d.rates.entries()].sort(([a], [b]) => a.localeCompare(b));
        const key = JSON.stringify([d.date.dias, d.date.noches, rates.map(([k]) => k)]);
        if (!blocks.has(key))
            blocks.set(key, { date: d.date, dates: [], rates: rates.map(([, o]) => o) });
        blocks.get(key).dates.push(dateLabel(d.date));
    }
    const l = ['🌴 *' + g.titulo + '*', ...(g.origen.nombre ? ['✈️ Desde ' + g.origen.nombre + ' hacia ' + g.destino.nombre] : [])];
    for (const b of [...blocks.values()].slice(0, 20)) {
        const o = b.date;
        l.push('');
        if (o.dias && o.noches)
            l.push('🌞 *' + o.dias + ' días / ' + o.noches + ' noches*');
        const dates = [...new Set(b.dates.filter(Boolean))];
        if (dates.length)
            l.push('🗓️ *Fechas disponibles:*', ...dates.slice(0, 30));
        if (dates.length > 30)
            l.push('Más fechas disponibles en el listado de salidas.');
        for (const x of b.rates.slice(0, 30)) {
            l.push('🏨 ' + (x.hotel.nombre || g.titulo) + ' — desde ' + money(x.precio) + ' ' + unit(x.precio));
            if (x.habitacion)
                l.push('🛏️ ' + x.habitacion);
            if (x.regimen)
                l.push('🍽️ ' + labelMeal(x.regimen));
            for (const p of x.promociones)
                l.push('🎁 ' + p.titulo, ...(p.detalle ? [p.detalle] : []));
            if (x.precio.es_total_parcial)
                l.push('Traslado pendiente de cotizar; no incluido en el total parcial.');
        }
    }
    const includes = g.fuente === 'cazador' ? options[0].servicios_incluidos : g.incluye;
    if (includes.length)
        l.push('', '✅ *El plan incluye:*', ...includes.map(x => '• ' + x));
    if (g.no_incluye.length)
        l.push('', '🚫 *No incluye:*', ...g.no_incluye.map(x => '• ' + x));
    if (g.condiciones.length)
        l.push('', '📋 *Condiciones importantes:*', ...g.condiciones.map(x => '• ' + x));
    return l.join('\n');
}
function alternativeLine(g) {
    // All comparison fields come from the same option as its advertised price.
    const o = g.options[0], p = o.precio;
    const pretty = d => new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d + 'T12:00:00Z'));
    let dates = o.fecha_salida && o.fecha_regreso ? pretty(o.fecha_salida) + ' al ' + pretty(o.fecha_regreso) : clean(o.texto_fecha) || 'Fechas no especificadas';
    if (o.fecha_parcial && !o.fecha_parcial.anio)
        dates += ' (año no indicado)';
    const duration = o.dias && o.noches ? o.dias + ' días / ' + o.noches + ' noches' : o.noches ? o.noches + ' noches' : 'Duración no especificada';
    const meal = ({
        'todo incluido': 'Todo incluido',
        'solo habitacion': 'Solo alojamiento (sin alimentación)',
        'desayuno': 'Desayuno',
        'media pension': 'Media pensión',
        'pension completa': 'Pensión completa',
        'alimentacion completa': 'Alimentación completa',
        'alimentacion completa snacks bar': 'Alimentación completa, snacks y bar abierto',
        'segun plan': 'Alimentación según el plan',
        'por confirmar': 'Alimentación no especificada',
    })[norm(o.regimen)] || clean(o.regimen) || 'Alimentación no especificada';
    const unit = ({ por_persona: 'por persona', por_pareja: 'por pareja', por_paquete: 'por paquete' })[p.unidad];
    return '• ' + [g.titulo,
        ...(o.hotel.nombre && norm(o.hotel.nombre) !== norm(g.titulo) ? [o.hotel.nombre] : []),
        ...(g.origen.nombre ? ['Desde ' + g.origen.nombre] : []),
        dates, duration, meal,
        money(p) + ' ' + unit + (p.es_total_parcial ? ' (total parcial)' : ''),
    ].join(' · ');
}
function query(model, input = {}) {
    const q = validate(input), groups = filtered(model, q);
    if (q.seleccion && !groups.some(g => g.id === q.seleccion))
        throw new QueryError(404, 'oferta_no_encontrada', 'La oferta seleccionada no coincide con los filtros.');
    let chosen = groups.find(g => g.id === q.seleccion) || groups[0], options = chosen?.options;
    if (q.opcion) {
        options = options?.filter(o => o.id === q.opcion);
        if (!options?.length)
            throw new QueryError(404, 'opcion_no_encontrada', 'La opción no coincide con los filtros.');
    }
    const other = groups.filter(g => g.id !== chosen?.id).slice(0, 6);
    const msg = chosen ? message(chosen, options) + (other.length ? '\n\n🎁 *Otras ofertas:*\n' + other.map(alternativeLine).join('\n') : '') : 'No hay ofertas para estos criterios.';
    return { ...page(groups.map(g => publicGroup(g, g.id === chosen?.id ? 50 : 5)), q, model), seleccionada: chosen?.id || null, mensaje_whatsapp: msg, metadatos: { revision: model.revision, seleccion_tarifa: 'captura_mas_reciente', ventana_cazador_horas: 72, consultado_en: new Date(model.now).toISOString(), ultima_sincronizacion: model.sync?.lastSuccessAt || null, fechas_sin_anio: 'conservadas_sin_inferir; excluidas_de_filtros_ISO', ocupacion: 'solo_base_comprobada; no_se_recalcula_precio' } };
}
function detail(model, id, input = {}, section = 'detalle') {
    const q = validate(input), g = filtered(model, q).find(x => x.id === id);
    if (!g)
        throw new QueryError(404, 'oferta_no_encontrada', 'Oferta inexistente o fuera de vigencia.');
    const options = q.opcion ? g.options.filter(o => o.id === q.opcion) : g.options;
    if (!options.length)
        throw new QueryError(404, 'opcion_no_encontrada', 'Opción inexistente.');
    if (section === 'mensaje')
        return { id: g.id, mensaje_whatsapp: message(g, options), snapshot: model.snapshot };
    const p = page(options, q, model, id);
    return section === 'fechas' ? p : { ...publicGroup(g, 0), opciones: p.items, opciones_truncadas: !!p.next_cursor, next_cursor: p.next_cursor, snapshot: model.snapshot, comercial: { titulo: g.titulo, mensaje_whatsapp: message(g, p.items) } };
}
function context(model, input = {}, kind = 'contexto') {
    const q = validate(input), groups = filtered(model, q);
    const dest = new Map(), orig = new Map(), hot = new Map();
    for (const g of groups) {
        const dk = JSON.stringify(g.destino), ok = JSON.stringify(g.origen);
        dest.set(dk, g.destino);
        if (g.origen.codigo)
            orig.set(ok, g.origen);
        for (const o of g.options) {
            if (o.hotel.nombre)
                hot.set(JSON.stringify([o.hotel.id, o.hotel.nombre, g.destino, g.origen]), { ...o.hotel, destino: g.destino, origen: g.origen });
        }
    }
    const sort = a => a.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    const all = { destinos: sort([...dest.values()]), origenes: sort([...orig.values()]), hoteles: sort([...hot.values()]) };
    if (kind !== 'contexto')
        return page(all[kind], q, model, kind);
    return { snapshot: model.snapshot, totales: { ofertas: groups.length, destinos: dest.size, origenes: orig.size, hoteles: hot.size }, fuentes: ['producto', 'cazador'], monedas: [...new Set(groups.flatMap(g => g.options.map(o => o.precio.moneda)))], regimenes: [...new Set(groups.flatMap(g => g.options.map(o => o.regimen)).filter(Boolean))].sort(), unidades: ['por_persona', 'por_pareja', 'por_paquete'], rutas: { destinos: 'destinos', origenes: 'origenes', hoteles: 'hoteles' }, reglas: { vigencia_cazador_horas: 72, seleccion: 'ultima_captura_por_tarifa_equivalente', reservas: false, cotizacion_en_vivo: false } };
}
function authenticate(header, expected) { if (!/^[a-f0-9]{64}$/.test(expected || ''))
    throw new QueryError(503, 'api_no_configurada', 'La API comercial está deshabilitada.'); const m = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(header || ''); const actual = hash(m ? m[1] : ''); if (!m || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected)))
    throw new QueryError(401, 'no_autorizado', 'Token de lectura inválido.'); }
module.exports = { build, settings, query, detail, context, validate, QueryError, authenticate, dedupHunter, captureTime, hash };
