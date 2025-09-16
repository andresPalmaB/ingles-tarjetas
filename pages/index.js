import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';

// Storage helpers
import { getCfgLocal, setCfgLocal, syncProgressFromConfig } from '../storage/cfg';
import { loadDoneToday, setDoneToday } from '../storage/progress';
import { loadSessionIds, addSessionId } from '../storage/session';

export default function Home() {
    // --- State
    const [cfg, setCfg] = useState({ maxOrden: 999999, metaDiariaTotal: 30, metaNuevasHoy: 10 });
    const [hechasHoy, setHechasHoy] = useState(0);
    const [plan, setPlan] = useState([]); // historias seleccionadas
    const [idx, setIdx] = useState(0); // índice de historia actual
    const [mostrarTraduccion, setMostrarTraduccion] = useState(false);
    const [cargandoPlanDia, setCargandoPlanDia] = useState(false);
    const current = plan[idx] || null;

    // --- Load config/progress on mount
    useEffect(() => {
        try {
            const local = syncProgressFromConfig(getCfgLocal());
            setCfg(local);
            setHechasHoy(loadDoneToday());
        } catch (e) {
            console.error('[index] init error', e);
        }
    }, []);

    // --- Derived: remaining today
    const remainingToday = useMemo(() => {
        const total = parseInt(cfg?.metaDiariaTotal ?? 0, 10) || 0;
        return Math.max(0, total - (hechasHoy | 0));
    }, [cfg, hechasHoy]);

    function onCfgChange(partial) {
        const next = { ...cfg, ...(partial || {}) };
        setCfg(next);
        setCfgLocal(next);
    }

    // --- Core: cargar plan según remaining y exclusiones de sesión
    async function cargarPlan(limitSolicitado, ordenMax) {
        setCargandoPlanDia(true);
        try {
            const alreadyDone = loadDoneToday(); // persistente de hoy
            const remaining = Math.max(0, (limitSolicitado | 0) - alreadyDone);

            // Si la meta ya se cumplió no rompemos la UI, solo vaciamos plan y mostramos estado
            if (remaining === 0) {
                setPlan([]);
                setIdx(0);
                setMostrarTraduccion(false);
                setHechasHoy(alreadyDone);
                setCargandoPlanDia(false);
                return;
            }

            // Excluir historias ya vistas en esta sesión (usaremos 'orden' como ID estable)
            const excludeIds = loadSessionIds();
            const withExclude = new URLSearchParams();
            withExclude.set('limit', String(remaining));
            withExclude.set('maxOrden', String(ordenMax));
            if (excludeIds.length) withExclude.set('exclude', excludeIds.join(','));

            const url = `/api/plan?${withExclude.toString()}`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (!data?.ok) throw new Error(data?.error || 'API plan error');
            const items = Array.isArray(data?.items) ? data.items : [];

            setPlan(items);
            setIdx(0);
            setMostrarTraduccion(false);
            setHechasHoy(alreadyDone);
        } catch (e) {
            console.error('[index] cargarPlan error', e);
            alert('No se pudo cargar el plan. Revisa la consola.');
        } finally {
            setCargandoPlanDia(false);
        }
    }

    // --- UI handlers
    function handleEmpezar() {
        const total = parseInt(cfg?.metaDiariaTotal ?? 0, 10) || 0;
        const maxOrd = parseInt(cfg?.maxOrden ?? 999999, 10) || 999999;
        cargarPlan(total, maxOrd);
    }

    function handleSiguiente() {
        if (!current) return;
        // Marcar hecho +1, persistir y sumar a sesión (ID por 'orden' de la historia actual)
        const id = String(current?.orden ?? idx);
        addSessionId(id);
        const nuevoHechas = (loadDoneToday() | 0) + 1;
        setDoneToday(nuevoHechas);
        setHechasHoy(nuevoHechas);

        // Siguiente item del plan
        const nextIdx = idx + 1;
        if (nextIdx < plan.length) {
            setIdx(nextIdx);
            setMostrarTraduccion(false);
        } else {
            // Plan del día (este lote) completado
            setPlan([]);
            setIdx(0);
            setMostrarTraduccion(false);
        }
    }

    function handleReiniciarSesion() {
        // Si el usuario quiere forzar nuevas historias en esta sesión, puede refrescar la página.
        // Aquí solo dejamos atajo visual.
        if (confirm('Esto recargará la página para limpiar el estado de la UI.')) {
            window.location.reload();
        }
    }

    // --- Render helpers
    function MetaInfo() {
        const total = parseInt(cfg?.metaDiariaTotal ?? 0, 10) || 0;
        return (
            <div className="text-sm text-gray-300">
                <div>Hechas hoy: <b>{hechasHoy}</b> / <b>{total}</b></div>
                {remainingToday > 0 ? (
                    <div>Faltan: <b>{remainingToday}</b></div>
                ) : (
                    <div className="text-green-400">¡Plan del día completado! 🎉</div>
                )}
            </div>
        );
    }

    function HistoriaCard({ item }) {
        if (!item) return null;
        const frases = Array.isArray(item.frases) ? item.frases : [];
        const primera = frases[0] || null;
        return (
            <div className="border border-gray-700 rounded-2xl p-4 bg-gray-900 shadow">
                <div className="text-xs uppercase tracking-wide text-gray-400">Historia #{item.orden ?? '-'}</div>
                <h2 className="text-xl font-semibold text-gray-100 mb-2">{item.titulo || '—'}</h2>
                {primera ? (
                    <div className="mt-3">
                        <p className="text-gray-100 text-lg">{primera.textoIngles}</p>
                        {mostrarTraduccion && (
                            <p className="text-gray-300 mt-2">{primera.traduccion}</p>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-400">Sin frases en esta historia.</p>
                )}
                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setMostrarTraduccion(v => !v)}
                        className="px-4 py-2 rounded-xl bg-gray-700 text-gray-100 hover:bg-gray-600"
                    >
                        {mostrarTraduccion ? 'Ocultar traducción' : 'Mostrar traducción'}
                    </button>
                    <button
                        type="button"
                        onClick={handleSiguiente}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>Inglés - Tarjetas</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <main className="min-h-screen bg-black text-gray-100">
                <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
                    <header className="flex items-center justify-between">
                        <h1 className="text-2xl md:text-3xl font-bold">Tarjetas de Estudio</h1>
                        <button
                            type="button"
                            onClick={handleReiniciarSesion}
                            className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm"
                        >
                            Refrescar
                        </button>
                    </header>

                    <section className="grid gap-4 md:grid-cols-3">
                        <div className="col-span-2 space-y-4">
                            <div className="border border-gray-800 rounded-2xl p-4 bg-gray-950">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <label className="block">
                                        <span className="block text-sm text-gray-300">Max orden</span>
                                        <input
                                            type="number"
                                            min={1}
                                            defaultValue={cfg.maxOrden}
                                            onChange={(e) => onCfgChange({ maxOrden: parseInt(e.target.value || '0', 10) || 1 })}
                                            className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-100"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="block text-sm text-gray-300">Meta diaria total</span>
                                        <input
                                            type="number"
                                            min={1}
                                            defaultValue={cfg.metaDiariaTotal}
                                            onChange={(e) => onCfgChange({ metaDiariaTotal: Math.max(1, parseInt(e.target.value || '0', 10) || 1) })}
                                            className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-100"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="block text-sm text-gray-300">Nuevas hoy</span>
                                        <input
                                            type="number"
                                            min={0}
                                            defaultValue={cfg.metaNuevasHoy}
                                            onChange={(e) => onCfgChange({ metaNuevasHoy: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })}
                                            className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-100"
                                        />
                                    </label>
                                </div>
                                <div className="mt-4 flex items-center justify-between">
                                    <MetaInfo />
                                    <button
                                        type="button"
                                        onClick={handleEmpezar}
                                        disabled={cargandoPlanDia}
                                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                                    >
                                        {cargandoPlanDia ? 'Cargando...' : 'Empezar'}
                                    </button>
                                </div>
                            </div>

                            {current ? (
                                <HistoriaCard item={current} />
                            ) : (
                                <div className="border border-gray-800 rounded-2xl p-6 text-gray-300 bg-gray-950">
                                    {remainingToday > 0
                                        ? 'Presiona “Empezar” para cargar tu plan de hoy.'
                                        : '¡Plan del día completado! Puedes aumentar la meta diaria si quieres practicar más.'}
                                </div>
                            )}
                        </div>

                        <aside className="space-y-4">
                            <div className="border border-gray-800 rounded-2xl p-4 bg-gray-950">
                                <h3 className="font-semibold mb-2">Plan actual</h3>
                                {plan.length > 0 ? (
                                    <ul className="text-sm text-gray-300 space-y-1 max-h-64 overflow-auto pr-2">
                                        {plan.map((h, i) => (
                                            <li key={`${h.orden}-${i}`} className={i === idx ? 'text-white' : ''}>
                                                {i === idx ? '→ ' : ''}
                                                #{h.orden ?? '-'} — {h.titulo ?? '—'}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-400 text-sm">Sin elementos cargados.</p>
                                )}
                            </div>
                        </aside>
                    </section>
                </div>
            </main>
        </>
    );
}