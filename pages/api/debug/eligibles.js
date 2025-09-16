import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    try {
        const client = await clientPromise;
        const db = client.db('ingles');

        const maxOrden = Math.max(1, parseInt(req.query.maxOrden || '30', 10));

        const historias = await db.collection('historias')
            .find({ orden: { $lte: maxOrden } }, { projection: { _id: 1, orden: 1, titulo: 1 } })
            .toArray();

        const historiaObjIds = historias.map(h => h._id);
        const historiaStrIds = historiaObjIds.map(id => id.toString());

        const now = new Date();

        const match = {
            $and: [
                {
                    $or: [
                        { historiaId: { $in: historiaObjIds } },
                        { historiaId: { $in: historiaStrIds } },
                    ]
                },
                {
                    $or: [
                        { revisarEnFecha: { $exists: false } },
                        { revisarEnFecha: { $lte: now } },
                    ]
                }
            ]
        };

        const total = await db.collection('frases').countDocuments(match);
        const sample = await db.collection('frases')
            .find(match)
            .limit(5)
            .project({ _id: 1, historiaId: 1, textoIngles: 1, revisarEnFecha: 1 })
            .toArray();

        res.status(200).json({
            ok: true,
            maxOrden,
            historiasElegibles: historias.length,
            frasesElegibles: total,
            muestra: sample
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: e.message });
    }
}