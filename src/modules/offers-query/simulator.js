// AVIOA v41: this preview calls the same service as the vendor API; no commercial token in the browser.
(function () {
    const filterFields = ['fecha_desde', 'fecha_hasta', 'regimen', 'adultos', 'noches', 'precio_max', 'moneda', 'unidad'];
    const apiState = { filters: {}, option: '', q: '', origin: '', source: '', selected: '', result: null, error: '', loading: false, serial: 0 };
    let externalIntent = '';
    function usePortalSelection() {
        const manual = state.v12?.selectedOffer || '', hotel = state.simFuente === 'cazador' ? state.cz?.hotel || '' : '';
        const signature = JSON.stringify([manual, hotel]);
        if (signature === externalIntent)
            return;
        externalIntent = signature;
        if (!manual && !hotel)
            return;
        apiState.q = '';
        apiState.option = '';
        apiState.selected = '';
        apiState.filters = {};
        if (hotel) {
            apiState.source = 'cazador';
            apiState.filters.hotel = String(hotel);
            apiState.origin = state.cz?.origin === 'TODOS' ? '' : state.cz?.origin || '';
        }
        else {
            apiState.source = 'producto';
            apiState.origin = '';
            apiState.selected = 'p_' + btoa(String.fromCharCode(...new TextEncoder().encode(manual))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
        Promise.resolve().then(() => consult());
    }
    function formQuery() { return { ...apiState.filters, q: apiState.q.trim(), ...(apiState.option ? { opcion: apiState.option } : {}), ...(apiState.origin ? { origen: apiState.origin } : {}), ...(apiState.source ? { fuente: apiState.source } : {}), ...(apiState.selected ? { seleccion: apiState.selected } : {}) }; }
    async function consult() { const serial = ++apiState.serial; apiState.loading = true; apiState.error = ''; render(); try {
        const r = await nativeRPC('simulation/query', { method: 'POST', body: JSON.stringify(formQuery()) });
        if (serial !== apiState.serial)
            return;
        apiState.result = r;
    }
    catch (e) {
        if (serial !== apiState.serial)
            return;
        apiState.error = e.message || 'No se pudo consultar el catálogo.';
        apiState.result = null;
    }
    finally {
        if (serial === apiState.serial) {
            apiState.loading = false;
            if (state.view === 'sim')
                render();
        }
    } }
    renderSimulator = function () { usePortalSelection(); const r = apiState.result; return `<div class="page-head"><div><div class="eyebrow">SIMULADOR DE LA API</div><h1>Consulta las ofertas que recibirá el bot</h1><p class="hint">Esta vista usa el mismo motor, filtros y mensajes de la API comercial.</p></div></div><section class="surface"><form id="api41-form"><div class="grid2"><label class="field"><span class="label">Destino, hotel u oferta</span><input class="input" name="q" value="${esc(apiState.q)}" placeholder="Punta Cana, Divi, Cartagena…"/></label><label class="field"><span class="label">Origen</span><input class="input" name="origin" value="${esc(apiState.origin)}" placeholder="Todos · MDE, BOG, Medellín…"/></label><label class="field"><span class="label">Fuente</span><select class="select" name="source"><option value="">Producto y cazador</option><option value="producto" ${apiState.source === 'producto' ? 'selected' : ''}>Producto</option><option value="cazador" ${apiState.source === 'cazador' ? 'selected' : ''}>Cazador</option></select></label></div><details><summary>Filtros de la API</summary><div class="grid2">${filterFields.map(k => `<label class="field"><span class="label">${esc(({ fecha_desde: 'Salida desde', fecha_hasta: 'Salida hasta', regimen: 'Régimen', adultos: 'Adultos en ocupación base', noches: 'Noches', precio_max: 'Precio máximo', moneda: 'Moneda: COP / USD / MXN', unidad: 'Unidad: por_persona / por_pareja / por_paquete' })[k])}</span><input class="input" name="${k}" type="${k.startsWith('fecha_') ? 'date' : ['adultos', 'noches', 'precio_max'].includes(k) ? 'number' : 'text'}" value="${esc(apiState.filters[k] || '')}"/></label>`).join('')}</div><p class="hint">Para filtrar por precio indica también moneda y unidad. Adultos debe coincidir con la ocupación base de la tarifa.</p></details><button class="btn primary" ${apiState.loading ? 'disabled' : ''}>${apiState.loading ? 'Consultando…' : 'Consultar API'}</button><button class="btn" type="button" data-api41-clear>Limpiar</button></form><p class="hint">El bot puede aplicar también fechas, régimen, adultos y precio desde la API. Consulta técnica sin cotizar en vivo.</p></section>${apiState.error ? `<section class="surface notice warn">${esc(apiState.error)}</section>` : ''}${r ? `<div class="grid2"><section class="surface"><h2>Ofertas encontradas · ${r.total}</h2><p class="hint">${r.items.length} en esta página · captura más reciente por tarifa</p>${r.items.map(g => `<div class="card" style="padding:14px;margin:10px 0;border:1px solid #e0e8ef;border-radius:12px"><b>${esc(g.titulo)}</b><p class="hint">${esc(g.fuente)} · ${esc(g.origen.nombre || '')} → ${esc(g.destino.nombre)} · ${g.total_opciones} opciones</p><button class="btn sm" data-api41-select="${esc(g.id)}">Ver mensaje completo</button>${g.opciones.map(o => `<p class="hint">${esc(o.fecha_salida || o.texto_fecha || 'Fechas del plan')} · ${esc(o.hotel.nombre || g.titulo)} · ${esc(o.regimen || '')} · ${esc(o.precio.valor)} ${esc(o.precio.moneda)} ${esc(o.precio.unidad)} <button class="btn sm" data-api41-select="${esc(g.id)}" data-api41-option="${esc(o.id)}">Ver variante</button></p>`).join('')}</div>`).join('')}${r.next_cursor ? '<button class="btn" data-api41-more>Ver siguiente página</button>' : ''}</section><section class="surface"><div class="between"><h2>Mensaje para WhatsApp</h2><button class="btn sm" data-api41-copy>Copiar texto</button></div><pre style="white-space:pre-wrap;font:inherit" id="api41-message">${esc(r.mensaje_whatsapp)}</pre><details><summary>Respuesta JSON y datos de la consulta</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(r, null, 2))}</pre></details></section></div>` : '<section class="surface"><p>Escribe una búsqueda para consultar las ofertas disponibles.</p></section>'}`; };
    document.addEventListener('submit', e => { if (e.target.id !== 'api41-form')
        return; e.preventDefault(); e.stopImmediatePropagation(); const f = new FormData(e.target); apiState.q = String(f.get('q') || ''); apiState.origin = String(f.get('origin') || ''); apiState.source = String(f.get('source') || ''); apiState.selected = ''; apiState.option = ''; apiState.filters = Object.fromEntries(filterFields.map(k => [k, String(f.get(k) || '').trim()]).filter(([, v]) => v)); void consult(); }, true);
    document.addEventListener('click', async (e) => { const b = e.target.closest('[data-api41-select],[data-api41-clear],[data-api41-copy],[data-api41-more]'); if (!b)
        return; e.preventDefault(); e.stopImmediatePropagation(); if (b.hasAttribute('data-api41-copy')) {
        await navigator.clipboard.writeText(apiState.result?.mensaje_whatsapp || '');
        return;
    } if (b.hasAttribute('data-api41-clear')) {
        Object.assign(apiState, { q: '', origin: '', source: '', selected: '', option: '', filters: {}, result: null, error: '', loading: false, serial: apiState.serial + 1 });
        render();
        return;
    } if (b.hasAttribute('data-api41-more')) {
        const serial = ++apiState.serial;
        try {
            const r = await nativeRPC('simulation/query', { method: 'POST', body: JSON.stringify({ ...formQuery(), cursor: apiState.result.next_cursor }) });
            if (serial !== apiState.serial)
                return;
            apiState.result = r;
            render();
        }
        catch (err) {
            apiState.error = err.message;
            render();
        }
        return;
    } apiState.selected = b.dataset.api41Select; apiState.option = b.dataset.api41Option || ''; void consult(); }, true);
})();
