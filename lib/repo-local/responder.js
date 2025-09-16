// lib/repo-local/responder.js
import { idb } from '../idb';

function dayIdBogota(d = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
}

async function getFraseByAnyId(idLike) {
    // intenta por id numérico (Dexie auto-increment)
    const n = Number(idLike);
    if (Number.isFinite(n)) {
        const byNum = await idb.table('frases').get(n);
        if (byNum) return byNum;
    }
    // intenta por _id o id como string
    let f = await idb.table('frases').where('_id').equals(String(idLike)).first();
    if (f) return f;
    f = await idb.table('frases').where('id').equals(String(idLike)).first();
    if (f) return f;
    // último recurso: escaneo
    return idb.table('frases').filter(x => String(x._id ?? x.id) === String(idLike)).first();
}

/**
 * Actualiza SRS y contadores diarios en IndexedDB.
 * @param {{ id: string|number, respuesta: 'correcta'|'incorrecta' }} payload
 */
export async function responderLocal({ id, respuesta }) {
    const frase = await getFraseByAnyId(id);
    if (!frase) throw new Error('Frase no encontrada en IndexedDB');

    const wasNew = (frase.nivelActual ?? 0) === 0;

    // ---- Lógica SRS (igual que en server) ----
    // correcta: 0->1 (+1d), 1->2 (+7d), >=2->3 (+30d) ; incorrecta: vuelve a 0, due hoy
    let nuevoNivel = 0;
    let diasParaRepetir = 0;
    if (respuesta === 'correcta') {
        if (frase.nivelActual === 0) { nuevoNivel = 1; diasParaRepetir = 1; }
        else if (frase.nivelActual === 1) { nuevoNivel = 2; diasParaRepetir = 7; }
        else { nuevoNivel = 3; diasParaRepetir = 30; }
    } else {
        nuevoNivel = 0;
        diasParaRepetir = 0;
    }

    const ahora = new Date();
    const proxima = new Date(ahora);
    proxima.setDate(ahora.getDate() + diasParaRepetir);

    // 1) Actualiza la frase
    await idb.table('frases').update(frase.id ?? frase._id, {
        nivelActual: nuevoNivel,
        ultimaRespuesta: respuesta,
        fechaUltimoEstudio: ahora.toISOString(),
        revisarEnFecha: proxima.toISOString(),
    });

    // 2) Contadores diarios en config (reset si cambia el día, luego inc)
    const cfgKey = 'appConfig';
    const cfg = (await idb.table('config').get(cfgKey)) || {
        id: cfgKey, maxOrden: 1, metaDefault: 20,
        lastPracticeDate: null, practicedTodayNew: 0, practicedTodayTotal: 0
    };
    const dayId = dayIdBogota(ahora);

    if (cfg.lastPracticeDate !== dayId) {
        cfg.lastPracticeDate = dayId;
        cfg.practicedTodayNew = 0;
        cfg.practicedTodayTotal = 0;
    }
    cfg.practicedTodayTotal = (cfg.practicedTodayTotal || 0) + 1;
    if (wasNew) cfg.practicedTodayNew = (cfg.practicedTodayNew || 0) + 1;

    await idb.table('config').put(cfg);

    return { ok: true };
}
