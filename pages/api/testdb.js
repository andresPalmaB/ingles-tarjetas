import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(req, res) {
    try {
        const { db } = await connectToDatabase();
        const dbName = db.databaseName;
        const collections = await db.listCollections().toArray();

        const historiasCount = await db.collection('historias').countDocuments().catch(() => 0);
        const frasesCount = await db.collection('frases').countDocuments().catch(() => 0);

        res.status(200).json({
            status: 'ok',
            dbName,
            collections: collections.map(c => c.name),
            historiasCount,
            frasesCount,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error conectando a la base' });
    }
}
