import connectToDatabase from "../../../lib/mongodb"; // desde /pages/api/debug/db.js

export default async function handler(req, res) {
    try {
        const { db } = await connectToDatabase();

        const dbName = db.databaseName;
        const historiasCount = await db.collection("historias").countDocuments();
        const frasesCount = await db.collection("frases").countDocuments();

        // Ajusta "historiaId" al campo real que relaciona la frase con su historia
        const dist = await db.collection("frases").aggregate([
            { $sample: { size: 100 } },
            { $group: { _id: "$historiaId", count: { $sum: 1 } } }
        ]).toArray();

        res.status(200).json({
            ok: true,
            dbName,
            historiasCount,
            frasesCount,
            distribucionPorHistoria: dist
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
}

