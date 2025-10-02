import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPlan } from '../lib/planCliente';
import {
    getCfgLocal, setCfgLocal, syncProgressFromConfig,
    loadDoneToday, setDoneToday,
    loadSessionIds, addSessionId
} from '../lib/storageBridge';

export function usePlanDia() {
    const [cfg, setCfg] = useState({ maxOrden: 999999, metaDiariaTotal: 30, metaNuevasHoy: 10 });
    const [hechasHoy, setHechasHoy] = useState(0);
    const [plan, setPlan] = useState([]);
    const [idx, setIdx] = useState(0);
    const [cargando, setCargando] = useState(false);
    const [mostrarTraduccion, setMostrarTraduccion] = useState(false);

    useEffect(() => {
        try {
            const local = syncProgressFromConfig(getCfgLocal());
            setCfg(local);
            setHechasHoy(loadDoneToday());
        } catch (e) { console.error('[usePlanDia] init', e); }
    }, []);

    const remainingToday = useMemo(() => {
        const total = parseInt(cfg?.metaDiariaTotal ?? 0, 10) || 0;
        return Math.max(0, total - (hechasHoy | 0));
    }, [cfg, hechasHoy]);

    const current = plan[idx] || null;

    const updateCfg = useCallback((partial) => {
        const next = { ...cfg, ...(partial || {}) };
        setCfg(next);
        setCfgLocal(next);
    }, [cfg]);

    const cargarPlan = useCallback(async () => {
        setCargando(true);
        try {
            const total = parseInt(cfg?.metaDiariaTotal ?? 0, 10) || 0;
            const maxOrd = parseInt(cfg?.maxOrden ?? 999999, 10) || 999999;
            const alreadyDone = loadDoneToday();
            const remaining = Math.max(0, total - alreadyDone);
            if (remaining === 0) {
                setPlan([]);
                setIdx(0);
                setMostrarTraduccion(false);
                setHechasHoy(alreadyDone);
                return;
            }
            const excludeIds = loadSessionIds();
            const items = await fetchPlan({ limit: remaining, maxOrden: maxOrd, excludeIds });
            setPlan(items);
            setIdx(0);
            setMostrarTraduccion(false);
            setHechasHoy(alreadyDone);
        } catch (e) {
            console.error('[usePlanDia] cargarPlan', e);
            throw e;
        } finally {
            setCargando(false);
        }
    }, [cfg]);

    const siguiente = useCallback(() => {
        if (!current) return;
        const id = String(current?.orden ?? idx);
        addSessionId(id);
        const nuevoHechas = (loadDoneToday() | 0) + 1;
        setDoneToday(nuevoHechas);
        setHechasHoy(nuevoHechas);

        setIdx(prev => {
            const next = prev + 1;
            if (next < plan.length) return next;
            setPlan([]);
            return 0;
        });
        setMostrarTraduccion(false);
    }, [current, idx, plan.length]);

    return {
        cfg, hechasHoy, remainingToday, plan, idx, current, cargando, mostrarTraduccion,
        updateCfg, cargarPlan, siguiente, setMostrarTraduccion,
    };
}