// pages/api/config.js
import clientPromise from '../../lib/mongodb';

const CONFIG_ID = 'appConfig'; // id fijo para un único doc de config

export default async function handler(req, res) {
    try {
        const client = await clientPromise;
        const db = client.db('ingles');
        const collection = db.collection('config');

        if (req.method === 'GET') {
            // trae config o crea una por defecto
            let cfg = await collection.findOne({ _id: CONFIG_ID });
            if (!cfg) {
                cfg = { _id: CONFIG_ID, maxOrden: 1, metaDefault: 20 };
                await collection.insertOne(cfg);
            }
            return res.status(200).json(cfg);
        }

        if (req.method === 'PUT') {
            const { maxOrden, metaDefault } = req.body || {};

            // construye el $set solo con lo que venga
            const set = {};
            if (typeof maxOrden === 'number') set.maxOrden = maxOrden;
            if (typeof metaDefault === 'number') set.metaDefault = metaDefault;

            const result = await collection.updateOne(
                { _id: CONFIG_ID },
                { $set: set },
                { upsert: true }
            );

            const cfgActualizada = await collection.findOne({ _id: CONFIG_ID });
            return res.status(200).json({ ok: true, result, config: cfgActualizada });
        }

        return res.status(405).json({ error: 'Método no permitido' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Error en /api/config' });
    }
}
