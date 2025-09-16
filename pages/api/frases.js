import clientPromise from '../../lib/mongodb';

export default async function handler(req, res) {
    try {
        const client = await clientPromise;
        const db = client.db('ingles');

        const ahora = new Date();
        const limit = Math.max(1, parseInt(req.query.limit || '50', 10));

        const filtro = {
            $or: [
                { revisarEnFecha: { $exists: false } },
                { revisarEnFecha: null },
                { revisarEnFecha: { $lte: ahora } },
            ],
        };

        const frases = await db
            .collection('frases')
            .aggregate([
                { $match: filtro },
                { $sample: { size: limit } }, // ← aleatorias
            ])
            .toArray();

        res.status(200).json(frases);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'No se pudieron cargar las frases' });
    }
}
