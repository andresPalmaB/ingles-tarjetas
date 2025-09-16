import { idb } from '../idb';

// ================= Helpers =================
function ymdInTZ(date = new Date(), timeZone = 'America/Bogota') {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date); // YYYY-MM-DD
}

function properShuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function interleaveRandom(a, b) {
    const res = [];
    const A = [...a], B = [...b];
    while (A.length || B.length) {
        if (A.length && B.length) res.push(Math.random() < 0.5 ? A.shift() : B.shift());
        else if (A.length) res.push(A.shift());
        else res.push(B.shift());
    }
    return res;
}

/**
 * Genera el plan del día (100% local con IndexedDB):
 * - Obligatorias = frases con revisarEnFecha <= HOY (America/Bogota) y dentro de maxOrden.
 * - Nuevas = frases con nivelActual=0 y sin fechaUltimoEstudio y (sin revisarEnFecha o > HOY).
 * - 'limit' se interpreta como META de nuevas (no afecta obligatorias).
 * - targetTotalHoy = obligatoriasDeHoy + META de nuevas.
 * - itemsLimited = items recortados para no exceder (targetTotalHoy - practicedTodayTotal).
 */
export async function getPlanDelDiaLocal({ limit, maxOrden, excludeIds = [] }) {
    const now = new Date();
    const todayYMD = ymdInTZ(now, 'America/Bogota');

    // ---- Config y reseteo diario ----
    const cfg = (await idb.table('config').get('appConfig')) || {
        id: 'appConfig',
        maxOrden: 1,
        metaDefault: 20,
        lastPracticeDate: null,
        practicedTodayNew: 0,
        practicedTodayTotal: 0,
    };

    if (cfg.lastPracticeDate !== todayYMD) {
        cfg.lastPracticeDate = todayYMD;
        cfg.practicedTodayNew = 0;
        cfg.practicedTodayTotal = 0;
        await idb.table('config').put(cfg);
    }

    const nuevasPorDia = Math.max(0, Number(limit ?? cfg.metaDefault ?? 20));
    const maxOrd = Math.max(1, Number(maxOrden ?? cfg.maxOrden ?? 7));
    const excludeSet = new Set((excludeIds || []).map(String));

    // ---- Historias válidas (<= maxOrden) ----
    const historiasValidas = await idb.table('historias')
        .where('orden').belowOrEqual(maxOrd).toArray();
    if (!historiasValidas.length) {
        return {
            ok: true,
            dueCount: 0,
            nuevasCount: 0,
            nuevasPoolTotal: 0,
            metaNuevasSolicitadas: nuevasPorDia,
            nuevasCupoHoy: 0,
            practicedTodayNew: cfg.practicedTodayNew || 0,
            practicedTodayTotal: cfg.practicedTodayTotal || 0,
            lastPracticeDate: cfg.lastPracticeDate,
            targetTotalHoy: 0,
            remainingHoy: 0,
            items: [], itemsLimited: [], seleccionadas: []
        };
    }
    const idsHistorias = new Set(historiasValidas.map(h => h.id));

    // ---- Todas las frases válidas por historia ----
    const todasFrasesValidas = await idb.table('frases')
        .filter(f => idsHistorias.has(f.historiaId))
        .toArray();

    // ---- Obligatorias (revisarEnFecha <= HOY) ----
    const due = todasFrasesValidas
        .filter(f => !excludeSet.has(String(f._id || f.id)))
        .filter(f => !!f.revisarEnFecha)
        .filter(f => {
            const ymd = ymdInTZ(new Date(f.revisarEnFecha), 'America/Bogota');
            return ymd <= todayYMD;
        });

    // ---- Pool de NUEVAS ----
    const nuevasPool = todasFrasesValidas
        .filter(f => !excludeSet.has(String(f._id || f.id)))
        .filter(f => (f.nivelActual ?? 0) === 0 && !f.fechaUltimoEstudio)
        .filter(f => !f.revisarEnFecha || ymdInTZ(new Date(f.revisarEnFecha), 'America/Bogota') > todayYMD);

    // Cupo de nuevas restante hoy (para seleccionar de la pool)
    const cupoNuevasHoy = Math.max(0, nuevasPorDia - Number(cfg.practicedTodayNew || 0));
    const nuevasSeleccionadas = properShuffle(nuevasPool).slice(0, cupoNuevasHoy);

    // Mezcla de due + nuevas
    const mezcladas = interleaveRandom(properShuffle(due), properShuffle(nuevasSeleccionadas));

    // Forma final de items
    const items = mezcladas.map(doc => ({
        ...doc,
        _id: String(doc._id ?? doc.id),
        textoIngles: doc.textoIngles ?? doc.texto ?? '',
    }));

    // Objetivo del día = obligatorias + META de nuevas (no cupo restante)
    const targetTotalHoy = Number(due.length) + Number(nuevasPorDia);
    const practicedTotal = Number(cfg.practicedTodayTotal || 0);
    const remainingHoy = Math.max(0, targetTotalHoy - practicedTotal);
    const itemsLimited = remainingHoy > 0 ? items.slice(0, remainingHoy) : [];

    return {
        ok: true,
        dueCount: due.length,
        nuevasCount: nuevasSeleccionadas.length,
        nuevasPoolTotal: nuevasPool.length,
        metaNuevasSolicitadas: nuevasPorDia,
        nuevasCupoHoy: cupoNuevasHoy,
        practicedTodayNew: cfg.practicedTodayNew || 0,
        practicedTodayTotal: cfg.practicedTodayTotal || 0,
        lastPracticeDate: cfg.lastPracticeDate,
        targetTotalHoy,
        remainingHoy,
        items,
        itemsLimited,
        seleccionadas: itemsLimited.length ? itemsLimited : items,
    };
}