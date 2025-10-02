import { useEffect, useState, useRef } from 'react';
import { seedIfNeeded } from '../lib/seed-idb';
import { getPlanDelDiaLocal } from '../lib/repo-local/plan-dia';
import { responderLocal } from '../lib/repo-local/responder';
import { getConfig as getCfgLocal, setConfig as setCfgLocal } from '../lib/idb';
import { exportAvance, importAvanceFromFile, resetLocal } from '../lib/backup';

// ========= Helpers de fecha/progreso por día (America/Bogota) =========
const PROGRESS_KEY = 'progressByDay';
const SESSION_KEY = 'sessionPhrasesByDay';
const SNAPSHOT_KEY = 'studySessionSnapshot';

function getDayIdBogota(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return fmt.format(date); // YYYY-MM-DD
}

function loadDoneToday() {
    if (typeof window === 'undefined') return 0;
    const dayId = getDayIdBogota();
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return all[dayId] || 0;
}
function incDoneToday(delta = 1) {
    const dayId = getDayIdBogota();
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    all[dayId] = (all[dayId] || 0) + delta;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    return all[dayId];
}

function loadSessionIds() {
    if (typeof window === 'undefined') return [];
    const dayId = getDayIdBogota();
    const all = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    return all[dayId] || [];
}
function addSessionId(id) {
    const dayId = getDayIdBogota();
    const all = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    const set = new Set(all[dayId] || []);
    set.add(String(id));
    all[dayId] = Array.from(set);
    localStorage.setItem(SESSION_KEY, JSON.stringify(all));
}
function ensureSessionBucket() {
    const dayId = getDayIdBogota();
    const all = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    if (!all[dayId]) {
        all[dayId] = [];
        localStorage.setItem(SESSION_KEY, JSON.stringify(all));
    }
}

// ---- Snapshot helpers ----
function loadSnapshot() {
    try { return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null'); } catch { return null; }
}
function saveSnapshot(snap) {
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap)); } catch {}
}
function clearSnapshot() {
    try { localStorage.removeItem(SNAPSHOT_KEY); } catch {}
}

// ---- Config 100% LOCAL (IndexedDB) ----
const leerConfig = async () => {
    return (
        (await getCfgLocal()) || {
            id: 'appConfig',
            maxOrden: 1,
            metaDefault: 20,
            lastPracticeDate: null,
            practicedTodayNew: 0,
            practicedTodayTotal: 0,
        }
    );
};

const guardarConfig = async (partial) => {
    const current = (await getCfgLocal()) || {
        id: 'appConfig',
        maxOrden: 1,
        metaDefault: 20,
        lastPracticeDate: null,
        practicedTodayNew: 0,
        practicedTodayTotal: 0,
    };
    const merged = { ...current, ...partial, id: 'appConfig' };
    await setCfgLocal(merged);
    const updated = await getCfgLocal();
    return { ok: true, config: updated || merged };
};

// --- Sincroniza localStorage con config (para respetar trabajo hecho hoy importado de IDB)
function syncProgressFromConfig(cfg) {
    try {
        const today = getDayIdBogota();
        if (!cfg || cfg.lastPracticeDate !== today) return;
        const fromCfg = Number(cfg.practicedTodayTotal ?? 0);
        const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
        const current = Number(all[today] || 0);
        if (fromCfg > current) {
            all[today] = fromCfg;
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
        }
    } catch {}
}

export default function AppUI() {
    useEffect(() => { seedIfNeeded(); }, []);

    // Config
    const [config, setConfig] = useState(null);
    const [cargandoConfig, setCargandoConfig] = useState(true);
    const [abrirConfig, setAbrirConfig] = useState(false);

    // Sesión de estudio (plan del día)
    const [metaDia, setMetaDia] = useState(null);
    const [maxOrden, setMaxOrden] = useState(null);
    const [hechasHoy, setHechasHoy] = useState(0); // total hechas hoy (obligatorias + nuevas)
    const [targetTotalHoy, setTargetTotalHoy] = useState(null); // baseDue + meta
    const [metaNuevasHoy, setMetaNuevasHoy] = useState(null); // meta de nuevas de hoy
    const [plan, setPlan] = useState([]);
    const [idx, setIdx] = useState(0);
    const [mostrarTraduccion, setMostrarTraduccion] = useState(false);
    const [cargandoPlanDia, setCargandoPlanDia] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false); // bloquear botones mientras suena el audio
    const fraseActual = plan[idx];

    // 🔐 Anti-doble-disparo (mutex + flag visual)
    const advancingRef = useRef(false);
    const [advancing, setAdvancing] = useState(false);

    // Refs para auto-ajuste de texto
    const titleBoxRef = useRef(null);
    const titleRef = useRef(null);
    const [titleFontPx, setTitleFontPx] = useState(28);

    // Backup (import/export)
    const [importBusy, setImportBusy] = useState(false);
    const fileInputRef = useRef(null);

    const onImportClick = () => fileInputRef.current?.click();
    const onFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ok = confirm('Esto reemplazará tus datos locales con los del archivo seleccionado. ¿Continuar?');
        if (!ok) { e.target.value = ''; return; }
        try {
            setImportBusy(true);
            await importAvanceFromFile(file);
            alert('Importación completada. Se actualizaron tus datos.');
            location.reload(); // refrescar plan/contadores
        } catch (err) {
            alert('Error importando: ' + err.message);
            console.error(err);
        } finally {
            setImportBusy(false);
            e.target.value = '';
        }
    };

    // ---- Cargar config + progreso del día (todo local) ----
    useEffect(() => {
        (async () => {
            try {
                const cfg = await leerConfig();
                setConfig(cfg);
                if (typeof window !== 'undefined') syncProgressFromConfig(cfg);
            } finally {
                setCargandoConfig(false);
                const doneLocal = loadDoneToday();
                setHechasHoy(doneLocal);
                ensureSessionBucket();
            }
        })();
    }, []);

    // ---- Auto TTS on card change ----
    useEffect(() => {
        try {
            if (fraseActual?.textoIngles) {
                if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(fraseActual.textoIngles);
                u.lang = 'en-US';
                setIsSpeaking(true);
                u.onend = () => setIsSpeaking(false);
                u.onerror = () => setIsSpeaking(false);
                speechSynthesis.speak(u);
            } else {
                setIsSpeaking(false);
            }
        } catch {
            setIsSpeaking(false);
        }
    }, [fraseActual?.textoIngles]);

    // ---- Ajuste automático del tamaño del texto (encajar) ----
    useEffect(() => {
        const fit = () => {
            const box = titleBoxRef.current;
            const el = titleRef.current;
            if (!box || !el) return;
            const maxPx = 32;
            const minPx = 14;
            let size = maxPx;
            el.style.whiteSpace = 'normal';
            el.style.wordBreak = 'break-word';
            el.style.hyphens = 'auto';
            el.style.lineHeight = '1.15';
            while (size >= minPx) {
                el.style.fontSize = size + 'px';
                const tooTall = el.scrollHeight > box.clientHeight;
                const tooWide = el.scrollWidth > box.clientWidth;
                if (!tooTall && !tooWide) break;
                size -= 1;
            }
            setTitleFontPx(size);
        };
        const id = requestAnimationFrame(fit);
        return () => cancelAnimationFrame(id);
    }, [fraseActual?.textoIngles, mostrarTraduccion]);

    // ---- TTS manual ----
    const hablar = (texto) => {
        try {
            if (!texto) return;
            if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(texto);
            u.lang = 'en-US';
            setIsSpeaking(true);
            u.onend = () => setIsSpeaking(false);
            u.onerror = () => setIsSpeaking(false);
            speechSynthesis.speak(u);
        } catch {
            setIsSpeaking(false);
        }
    };

    // ---- Snapshot: restaurar si existe para hoy ----
    const tryRestoreSnapshot = () => {
        const dayId = getDayIdBogota();
        const snap = loadSnapshot();
        if (snap && snap.dayId === dayId) {
            setPlan(snap.plan || []);
            setIdx(Math.max(0, Number.isFinite(snap?.idx) ? snap.idx : 0));
            setTargetTotalHoy(snap.targetTotalHoy || 0);
            setMetaNuevasHoy(snap.meta || 0);
            return snap;
        }
        return null;
    };

    const persistSnapshot = (updater) => {
        const dayId = getDayIdBogota();
        const snap = loadSnapshot();
        const base = snap && snap.dayId === dayId ? snap : { dayId, baseDueCount: 0, meta: 0, targetTotalHoy: 0, plan: [], idx: 0 };
        const next = typeof updater === 'function' ? updater(base) : updater;
        saveSnapshot(next);
    };

    // ---- Util para saber si una tarjeta es nueva
    const isNuevaCard = (card) => ((card?.nivelActual ?? 0) === 0) && !card?.fechaUltimoEstudio;

    // Cargar/actualizar plan del día
    const cargarPlan = async (limitSolicitado, ordenMax) => {
        setCargandoPlanDia(true);
        try {
            const dayId = getDayIdBogota();
            const snap = tryRestoreSnapshot(); // también setea plan/meta/target si existía

            // Si ya había snapshot y el usuario aumenta la meta -> anexar SOLO nuevas faltantes
            if (snap && limitSolicitado && limitSolicitado > (snap.meta || 0)) {
                const cfg = await leerConfig();
                const practicedNew = Number(cfg?.practicedTodayNew || 0);
                const newCardsStillNeeded = Math.max(0, limitSolicitado - practicedNew);

                if (newCardsStillNeeded > 0) {
                    // Exclusiones: vistas hoy + ya en el plan
                    const excludeIds = new Set([
                        ...loadSessionIds(),
                        ...(snap.plan || []).map(it => String(it._id)),
                    ]);

                    // 🔎 Construir pool de NUEVAS directamente desde IDB (no usar .seleccionadas que viene recortado)
                    const m = await import('../lib/idb');
                    const idb = m.idb || (m.default && m.default.idb);
                    if (!idb) throw new Error('IDB no disponible');

                    const historias = await idb.table('historias')
                        .where('orden').belowOrEqual(ordenMax).toArray();
                    const ids = new Set(historias.map(h => h.id));

                    const frases = await idb.table('frases')
                        .filter(f => ids.has(f.historiaId))
                        .toArray();

                    const candidatesRaw = frases
                        .filter(f => (f.nivelActual ?? 0) === 0 && !f.fechaUltimoEstudio)
                        .filter(f => !excludeIds.has(String(f._id || f.id)));

                    // Mezclar y tomar lo necesario
                    const shuffled = [...candidatesRaw];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = (Math.random() * (i + 1)) | 0;
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }

                    const take = Math.min(newCardsStillNeeded, shuffled.length);
                    const toAdd = shuffled.slice(0, take);
                    const mergedPlan = [...(snap.plan || []), ...toAdd];

                    // Ajustar target a lo realmente alcanzable hoy
                    const feasibleTarget = Number(snap.baseDueCount || 0) + practicedNew + take;

                    setPlan(mergedPlan);
                    setIdx(Math.max(0, Number.isFinite(snap?.idx) ? snap.idx : 0));
                    setTargetTotalHoy(feasibleTarget);
                    setMetaNuevasHoy(limitSolicitado);

                    persistSnapshot({
                        ...snap,
                        meta: limitSolicitado,
                        targetTotalHoy: feasibleTarget,
                        plan: mergedPlan,
                        idx: Math.min(snap.idx || 0, mergedPlan.length - 1)
                    });

                    setHechasHoy(loadDoneToday());
                    return;
                } else {
                    // Ya tienes suficientes nuevas practicadas para la nueva meta: solo actualiza target
                    const newTarget = Number(snap.baseDueCount || 0) + Number(limitSolicitado);
                    setPlan(snap.plan || []);
                    setIdx(Math.max(0, Number.isFinite(snap?.idx) ? snap.idx : 0));
                    setTargetTotalHoy(newTarget);
                    setMetaNuevasHoy(limitSolicitado);

                    persistSnapshot({
                        ...snap,
                        meta: limitSolicitado,
                        targetTotalHoy: newTarget
                    });

                    setHechasHoy(loadDoneToday());
                    return;
                }
            }

            // Si hay snapshot y NO se aumentó meta -> no tocar nada
            if (snap) {
                setHechasHoy(loadDoneToday());
                return;
            }

            // 2) No había snapshot -> crear desde cero
            const excludeIds = loadSessionIds();
            const data = await getPlanDelDiaLocal({
                limit: limitSolicitado,
                maxOrden: ordenMax,
                excludeIds,
            });

            const items = (data?.itemsLimited && data.itemsLimited.length ? data.itemsLimited : (data?.seleccionadas || []));
            const baseDue = Number(data?.dueCount || 0);
            const target = baseDue + Number(limitSolicitado || data?.metaNuevasSolicitadas || 0);

            setPlan(items);
            setIdx(0);
            setMostrarTraduccion(false);

            setTargetTotalHoy(target);
            setMetaNuevasHoy(Number(limitSolicitado || data?.metaNuevasSolicitadas || 0));

            // Sincronizar contadores a estado
            setConfig((prev) => ({
                ...(prev || {}),
                lastPracticeDate: data?.lastPracticeDate || prev?.lastPracticeDate,
                practicedTodayNew: Number(data?.practicedTodayNew ?? prev?.practicedTodayNew ?? 0),
                practicedTodayTotal: Number(data?.practicedTodayTotal ?? prev?.practicedTodayTotal ?? 0),
            }));

            setHechasHoy(Number(data?.practicedTodayTotal || 0));

            // Guardar snapshot base del día
            persistSnapshot({
                dayId,
                baseDueCount: baseDue,
                meta: Number(limitSolicitado || data?.metaNuevasSolicitadas || 0),
                targetTotalHoy: target,
                plan: items,
                idx: 0,
            });
        } finally {
            setCargandoPlanDia(false);
        }
    };

    // ---- Marcar respuesta (con anti-doble-disparo y anti-doble-contador) ----
    const marcarRespuesta = async (respuesta) => {
        if (!fraseActual) return;
        if (isSpeaking) return; // bloquea clicks mientras suena el audio

        // ⛔ Evita doble disparo
        if (advancingRef.current) return;
        advancingRef.current = true;
        setAdvancing(true);
        try {
            const eraNueva = (fraseActual?.nivelActual ?? 0) === 0 && !fraseActual?.fechaUltimoEstudio;

            // 1) Lee contadores ANTES
            const cfgBefore = await leerConfig();
            const beforeNew = Number(cfgBefore?.practicedTodayNew || 0);
            const beforeTot = Number(cfgBefore?.practicedTodayTotal || 0);

            // 2) Guardar respuesta
            await responderLocal({ id: (fraseActual.id ?? fraseActual._id), respuesta });

            // 3) Lee contadores DESPUÉS
            const cfgAfter = await leerConfig();
            const afterNew = Number(cfgAfter?.practicedTodayNew || 0);
            const afterTot = Number(cfgAfter?.practicedTodayTotal || 0);

            const responderYaSumoNew = afterNew > beforeNew;
            const responderYaSumoTot = afterTot > beforeTot;

            // 🔄 SIEMPRE refleja IDB en UI (evita “optimista” en nuevas)
            setConfig(cfgAfter);

            // (mantén tu UX rápida de “Trabajar hoy”)
            const newDone = incDoneToday(1);
            setHechasHoy(newDone);
            if (fraseActual._id) addSessionId(fraseActual._id);

            // Si responderLocal NO sumó, suma tú en IDB y luego refleja UNA sola vez
            if (!responderYaSumoTot || (eraNueva && !responderYaSumoNew)) {
                const today = getDayIdBogota();
                const cfg = await leerConfig();
                if (cfg.lastPracticeDate !== today) {
                    cfg.lastPracticeDate = today;
                    cfg.practicedTodayNew = 0;
                    cfg.practicedTodayTotal = 0;
                }
                if (!responderYaSumoTot) cfg.practicedTodayTotal = Number(cfg.practicedTodayTotal || 0) + 1;
                if (eraNueva && !responderYaSumoNew) cfg.practicedTodayNew = Number(cfg.practicedTodayNew || 0) + 1;

                const saved = await guardarConfig(cfg);
                if (saved?.config) setConfig(saved.config); // ← un solo setConfig final
            }


            // Avanzar y actualizar snapshot
            setPlan((prev) => {
                const copy = [...prev];
                if (respuesta === 'incorrecta') {
                    const current = copy[idx];
                    copy.splice(idx, 1);
                    copy.push(current);
                } else {
                    copy.splice(idx, 1);
                }
                const newIdx = Math.min(idx, copy.length - 1);
                persistSnapshot(snap => {
                    const nextLen = copy.length;
                    const curIdx = Number.isFinite(idx) ? idx : 0;
                    const nextIdx = Math.max(0, Math.min(curIdx, nextLen - 1));
                    return { ...snap, plan: copy, idx: nextIdx };
                });
                if (idx + 1 >= prev.length) setIdx(prev.length); else setIdx((i) => i);
                return copy;
            });

            // 🚦 Parar sesión al alcanzar el objetivo total (baseDue + meta)
            setTimeout(() => {
                const cap = Number((loadSnapshot()?.targetTotalHoy) || targetTotalHoy || 0);
                const done = loadDoneToday();
                if (cap && done >= cap) {
                    setPlan([]);
                    setIdx(0);
                    persistSnapshot(snap => ({ ...snap, plan: [], idx: 0 }));
                }
            }, 0);
        } finally {
            advancingRef.current = false;
            setAdvancing(false);
        }
    };

    // ---- Pantallas ----

    if (cargandoConfig) {
        return (
            <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4 text-gray-100">
                <div className="bg-gray-800 shadow-xl rounded-2xl p-8 max-w-md w-full text-center border border-gray-700">
                    <h1 className="text-xl font-semibold">Cargando configuración…</h1>
                </div>
            </main>
        );
    }

    if (cargandoPlanDia) {
        return (
            <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4 text-gray-100">
                <div className="bg-gray-800 shadow-xl rounded-2xl p-8 max-w-md w-full text-center border border-gray-700">
                    <h1 className="text-xl font-semibold">Preparando tu plan de hoy…</h1>
                </div>
            </main>
        );
    }

    if (metaDia === null || maxOrden === null) {
        return (
            <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4 text-gray-100">
                <div className="bg-gray-800 shadow-xl rounded-2xl p-8 max-w-md w-full space-y-4 border border-gray-700">
                    <h1 className="text-2xl font-bold text-center">Configura tu sesión de hoy</h1>

                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const meta = parseInt(e.target.meta.value, 10);
                            const orden = parseInt(e.target.orden.value, 10);
                            if (!isNaN(meta) && meta > 0 && !isNaN(orden) && orden > 0) {
                                setMetaDia(meta);
                                setMaxOrden(orden);
                                try {
                                    const resp = await guardarConfig({ maxOrden: orden, metaDefault: meta });
                                    if (resp?.ok) setConfig(resp.config);
                                } catch (err) {
                                    console.warn('No se pudo guardar config por defecto (local):', err);
                                }
                                await cargarPlan(meta, orden);
                            }
                        }}
                        className="space-y-3"
                    >
                        <div>
                            <label className="block text-sm text-gray-300">¿Cuántas frases hoy? (meta nuevas)</label>
                            <input
                                name="meta"
                                type="number"
                                min="1"
                                defaultValue={config?.metaDefault ?? 20}
                                className="w-full border border-gray-600 rounded-lg p-2 bg-gray-700 text-gray-100"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-300">¿Hasta qué historia vas? (maxOrden)</label>
                            <input
                                name="orden"
                                type="number"
                                min="1"
                                defaultValue={config?.maxOrden ?? 1}
                                className="w-full border border-gray-600 rounded-lg p-2 bg-gray-700 text-gray-100"
                            />
                        </div>

                        <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            Empezar
                        </button>
                    </form>

                    <button
                        type="button"
                        onClick={() => setAbrirConfig((v) => !v)}
                        className="w-full bg-gray-700 text-gray-100 px-4 py-2 rounded-lg hover:bg-gray-600"
                    >
                        ⚙️ Configurar</button>

                    {abrirConfig && config && (
                        <div className="mt-4 border border-gray-700 rounded-lg p-4 bg-gray-800">
                            <h2 className="font-semibold mb-2 text-gray-100">Configuración</h2>
                            <form
                                onSubmit={async (e) => { e.preventDefault(); const maxOrdenNuevo = parseInt(e.target.maxOrden.value, 10); const resp = await guardarConfig({ maxOrden: maxOrdenNuevo, }); setConfig(resp.config); setAbrirConfig(false); }}
                                className="space-y-3"
                            >
                                <div>
                                    <label className="block text-sm text-gray-300">Por cual Historia vas:</label>
                                    <input
                                        name="maxOrden"
                                        type="number"
                                        min="1"
                                        defaultValue={config.maxOrden}
                                        className="w-full border border-gray-600 rounded-lg p-2 bg-gray-700 text-gray-100"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                                        Guardar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAbrirConfig(false)}
                                        className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>

                            {/* Herramientas de respaldo de avance */}
                            <div className="mt-4 p-3 rounded-lg border border-gray-700 bg-gray-900/60">
                                <h3 className="font-semibold mb-2 text-gray-100">Respaldo y traslado de avance</h3>
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => exportAvance()}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg"
                                    >
                                        ⬇️ Exportar avance (JSON)
                                    </button>

                                    <button
                                        type="button"
                                        disabled={importBusy}
                                        onClick={onImportClick}
                                        className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg"
                                    >
                                        ⬆️ Importar avance (JSON)
                                    </button>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const ok = confirm('Esto borrará todo tu avance local y reiniciará la app. ¿Seguro?');
                                            if (!ok) return;
                                            await resetLocal();
                                            try {
                                                localStorage.removeItem(PROGRESS_KEY);
                                                localStorage.removeItem(SESSION_KEY);
                                                clearSnapshot();
                                            } catch {}
                                            location.reload();
                                        }}
                                        className="w-full bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded-lg"
                                    >
                                        🗑️ Reset de fábrica
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    Exporta tu avance para llevarlo a otra máquina. En la otra máquina, abre la app, ve a “Configurar” y usa “Importar avance (JSON)”.
                                </p>
                            </div>

                            {/* Input oculto para importar */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/json"
                                onChange={onFileChange}
                                style={{ display: 'none' }}
                            />
                        </div>
                    )}

                    <p className="text-xs text-gray-400">
                        Solo se tomarán frases que “toquen hoy” (revisarEnFecha ≤ hoy) y de historias con orden ≤ al que indiques.
                    </p>
                </div>
            </main>
        );
    }

    // Completado: solo si NO estamos cargando y no hay frase actual (plan vacío)
    if (!fraseActual && !cargandoPlanDia) {
        return (
            <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4 text-gray-100">
                <div className="bg-gray-800 shadow-xl rounded-2xl p-8 max-w-lg w-full text-center border border-gray-700">
                    <h1 className="text-2xl font-bold">¡Plan del día completado! 🎉</h1>
                    <p className="text-gray-300 mt-2">
                        Hechas hoy: <strong>{config?.practicedTodayNew ?? 0}</strong> / {metaNuevasHoy ?? 0}
                    </p>
                    <div className="mt-6 flex justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => { setMetaDia(null); setMaxOrden(null); setPlan([]); setIdx(0); }}
                            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100"
                        >
                            Nueva sesión
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // Tarjeta de estudio (462x378; si hay traducción, puede crecer)
    const containerBase = "bg-gray-800 shadow-xl rounded-2xl p-4 border border-gray-700 w-[462px]";
    const containerClass = mostrarTraduccion ? (containerBase + " min-h-[378px]") : (containerBase + " h-[378px]");

    return (
        <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4 text-gray-100">
            <div className={containerClass + " flex flex-col"}>
                {/* Contadores superiores */}
                <div className="w-full flex justify-between text-[11px] text-gray-300 mb-1">
                    <span>Trabajar hoy: {hechasHoy}/{targetTotalHoy ?? "…"}</span>
                    <span>Nuevas hoy: {config?.practicedTodayNew ?? 0}/{metaNuevasHoy ?? 0}</span>
                </div>

                {/* Área de texto principal con auto-fit */}
                <div ref={titleBoxRef} className="flex-1 overflow-hidden flex items-center justify-center text-center px-2">
                    <h2
                        ref={titleRef}
                        style={{ fontSize: `${titleFontPx}px`, lineHeight: 1.15 }}
                        className="font-semibold text-blue-400 break-words"
                    >
                        {fraseActual?.textoIngles}
                        { (fraseActual && ((fraseActual.nivelActual ?? 0) === 0) && !fraseActual.fechaUltimoEstudio) && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border border-amber-400 text-amber-300">Nueva</span>
                        ) }
                    </h2>
                </div>

                {/* Controles */}
                <div className="mt-2 flex flex-col gap-2">
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => fraseActual?.textoIngles && hablar(fraseActual.textoIngles)}
                            disabled={isSpeaking || advancing}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            🔊 Escuchar
                        </button>
                    </div>

                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => setMostrarTraduccion(!mostrarTraduccion)}
                            disabled={advancing}
                            className="text-xs text-blue-400 underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {mostrarTraduccion ? 'Ocultar traducción' : 'Mostrar traducción'}
                        </button>
                    </div>

                    {mostrarTraduccion && (
                        <div className="text-sm text-center text-gray-200 bg-gray-700 p-2 rounded w-full max-h-28 overflow-auto">
                            {fraseActual?.traduccion}
                        </div>
                    )}

                    <div className="flex justify-between w-full mt-1 gap-2">
                        <button
                            type="button"
                            onClick={() => marcarRespuesta('incorrecta')}
                            disabled={isSpeaking || advancing}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 w-1/2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ❌ No la entendí
                        </button>
                        <button
                            type="button"
                            onClick={() => marcarRespuesta('correcta')}
                            disabled={isSpeaking || advancing}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 w-1/2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ✅ La entendí
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
