import clientPromise from '../../../lib/mongodb';

export default async function handler(req, res) {
    try {
        const client = await clientPromise;
        const db = client.db('ingles');

        await db.collection('frases').createIndex({ historiaId: 1 });
        await db.collection('frases').createIndex({ revisarEnFecha: 1 });
        await db.collection('historias').createIndex({ orden: 1 });

        res.status(200).json({ ok: true, message: 'Índices creados' });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
}
