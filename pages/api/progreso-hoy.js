import clientPromise from '../../lib/mongodb';

export default async function handler(req, res) {
    try {
        const client = await clientPromise;
        const db = client.db('ingles');

        // Leemos el contador del día desde config (sin usar la colección "respuestas")
        const cfg = await db.collection('config').findOne({ _id: 'appConfig' }) || {};
        const doneToday = Number.isFinite(cfg.practicedTodayTotal) ? cfg.practicedTodayTotal : 0;

        return res.status(200).json({ ok: true, doneToday });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ ok: false, error: e.message });
    }
}