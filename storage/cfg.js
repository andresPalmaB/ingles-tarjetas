const KEY_CFG = 'cfg_v1';

// Defaults seguros
const DEFAULTS = {
    maxOrden: 999999,
    metaDiariaTotal: 30,  // total del día (nuevas + repaso)
    metaNuevasHoy: 10     // nuevas del día
};

export function getCfgLocal() {
    try {
        const raw = localStorage.getItem(KEY_CFG);
        const parsed = raw ? JSON.parse(raw) : {};
        return { ...DEFAULTS, ...(parsed || {}) };
    } catch {
        return { ...DEFAULTS };
    }
}

export function setCfgLocal(nextCfg) {
    const merged = { ...DEFAULTS, ...(nextCfg || {}) };
    localStorage.setItem(KEY_CFG, JSON.stringify(merged));
    return merged;
}

// Si más adelante decides que el progreso dependa de la config (p. ej. reiniciar metas al cambiar),
// deja este hook preparado:
export function syncProgressFromConfig(cfg = getCfgLocal()) {
    // Por ahora no hace nada destructivo. Aquí podríamos validar rangos, etc.
    return cfg;
}
