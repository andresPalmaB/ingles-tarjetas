import data from '../../data/historias_estructuradas.json';

export default function handler(req, res) {
    try {
        const { limit = '10', maxOrden = '999999', exclude = '' } = req.query;
        const lim = Math.max(0, parseInt(limit, 10) || 0);
        const maxOrd = parseInt(maxOrden, 10) || 999999;
        const excludeSet = new Set((exclude || '').split(',').filter(Boolean));

        // Filtro base por orden y exclusiones
        const pool = (Array.isArray(data) ? data : data.items || [])
            .filter(x => (x?.orden || 0) <= maxOrd)
            .filter(x => !excludeSet.has(String(x?.id)));

        // Toma primeras 'lim' (luego afinamos aleatoriedad/espaciado)
        const pick = pool.slice(0, lim);

        res.status(200).json({ ok: true, items: pick });
    } catch (e) {
        res.status(500).json({ ok: false, error: e?.message || 'error' });
    }
}
