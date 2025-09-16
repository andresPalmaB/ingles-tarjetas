// lib/backup.js
import { idb } from './idb';

// Claves de localStorage que usamos
const PROGRESS_KEY = 'progressByDay';
const SESSION_KEY  = 'sessionPhrasesByDay';

function nowStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Exporta todo el avance local a un archivo JSON descargable */
export async function exportAvance() {
    // Lee IndexedDB
    const [historias, frases, config] = await Promise.all([
        idb.historias.toArray(),
        idb.frases.toArray(),
        idb.config.toArray(),
    ]);

    // Lee localStorage
    let progressByDay = {};
    let sessionPhrasesByDay = {};
    if (typeof window !== 'undefined') {
        try { progressByDay = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch {}
        try { sessionPhrasesByDay = JSON.parse(localStorage.getItem(SESSION_KEY)  || '{}'); } catch {}
    }

    const payload = {
        __type: 'ingles_tarjetas_backup',
        version: 1,
        createdAt: new Date().toISOString(),
        data: { historias, frases, config, progressByDay, sessionPhrasesByDay },
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `avance-ingles-${nowStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/**
 * Importa un backup JSON.
 * Por defecto: SOBREESCRIBE (clear + bulkPut). Pide confirmación desde la UI.
 */
export async function importAvanceFromFile(file) {
    if (!file) throw new Error('No seleccionaste un archivo');
    const text = await file.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('Archivo inválido (no es JSON)'); }

    if (!json || json.__type !== 'ingles_tarjetas_backup' || !json.data) {
        throw new Error('Backup inválido: formato no reconocido');
    }
    const { historias, frases, config, progressByDay, sessionPhrasesByDay } = json.data;

    // Escribimos TODO de forma atómica
    await idb.transaction('rw', idb.historias, idb.frases, idb.config, async () => {
        await idb.historias.clear();
        await idb.frases.clear();
        await idb.config.clear();

        if (Array.isArray(historias) && historias.length) {
            await idb.historias.bulkAdd(historias);
        }
        if (Array.isArray(frases) && frases.length) {
            await idb.frases.bulkAdd(frases);
        }
        if (Array.isArray(config) && config.length) {
            await idb.config.bulkAdd(config);
        }
    });

    if (typeof window !== 'undefined') {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressByDay || {}));
        localStorage.setItem(SESSION_KEY,  JSON.stringify(sessionPhrasesByDay || {}));
    }

    return { ok: true };
}

/** Resetea datos locales (útil si el usuario quiere empezar de cero) */
export async function resetLocal() {
    await idb.delete();
    if (typeof window !== 'undefined') {
        localStorage.removeItem(PROGRESS_KEY);
        localStorage.removeItem(SESSION_KEY);
        // Recarga para que seedIfNeeded() vuelva a sembrar limpio
        location.reload();
    }
}
