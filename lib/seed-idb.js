// lib/seed-idb.js
import { idb } from './idb';

export async function seedIfNeeded() {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;

    const yaHay = await idb.historias.count();
    if (yaHay > 0) return; // ya está sembrado

    // Coloca historias_estructuradas.json en /public para poder hacer fetch
    let historias;
    try {
        const resp = await fetch('/historias_estructuradas.json', { cache: 'no-store' });
        historias = await resp.json();
    } catch (e) {
        console.warn('[seed-idb] No pude cargar historias_estructuradas.json', e);
        return;
    }
    if (!Array.isArray(historias)) return;

    await idb.transaction('rw', idb.historias, idb.frases, idb.config, async () => {
        await idb.historias.clear();
        await idb.frases.clear();

        const ordenadas = [...historias].sort(
            (a, b) => Number(a.orden || 0) - Number(b.orden || 0)
        );

        for (const h of ordenadas) {
            const historiaId = await idb.historias.add({
                orden: Number(h.orden),
                titulo: h.titulo ?? h.title ?? null,
                descripcion: h.descripcion ?? h.description ?? null,
            });

            const frases = Array.isArray(h.frases) ? h.frases : [];
            for (let i = 0; i < frases.length; i++) {
                const f = frases[i];
                await idb.frases.add({
                    historiaId,
                    historiaOrden: Number(h.orden),
                    orden: Number(f.orden ?? i + 1),
                    textoIngles: f.textoIngles ?? f.en ?? f.english ?? '',
                    traduccion:  f.traduccion  ?? f.es ?? f.spanish  ?? '',
                    nivelActual: 0,
                    ultimaRespuesta: null,
                    fechaUltimoEstudio: null,
                    revisarEnFecha: new Date().toISOString(), // “para hoy”
                });
            }
        }

        await idb.config.put({
            id: 'appConfig',
            maxOrden: 1,
            metaDefault: 20,
            lastPracticeDate: null,
            practicedTodayNew: 0,
            practicedTodayTotal: 0,
        });
    });

    console.log('[seed-idb] IndexedDB listo ✅');
}
