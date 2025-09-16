// pages/api/responder.js
import clientPromise from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

function dayIdBogota(d = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d); // YYYY-MM-DD
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { id, respuesta } = req.body;

    try {
        const client = await clientPromise;
        const db = client.db('ingles');

        const _id = new ObjectId(id);
        const frase = await db.collection('frases').findOne({ _id });
        if (!frase) return res.status(404).json({ error: 'Frase no encontrada' });

        const wasNew = (frase.nivelActual ?? 0) === 0;

        // ---- Lógica de SRS ----
        let nuevoNivel = 0;
        let diasParaRepetir = 0;

        if (respuesta === 'correcta') {
            if (frase.nivelActual === 0) { nuevoNivel = 1; diasParaRepetir = 1; }
            else if (frase.nivelActual === 1) { nuevoNivel = 2; diasParaRepetir = 7; }
            else { nuevoNivel = 3; diasParaRepetir = 30; }
        } else {
            nuevoNivel = 0; diasParaRepetir = 0;
        }

        const ahora = new Date();
        const proxima = new Date();
        proxima.setDate(ahora.getDate() + diasParaRepetir);

        // 1) Actualiza la frase
        await db.collection('frases').updateOne(
            { _id },
            {
                $set: {
                    nivelActual: nuevoNivel,
                    ultimaRespuesta: respuesta,
                    fechaUltimoEstudio: ahora,
                    revisarEnFecha: proxima,
                }
            }
        );

        // 2) Actualiza contadores en config (sin guardar en "respuestas")
        const dayId = dayIdBogota(ahora);
        const cfgId = { _id: 'appConfig' };
        const cfg = await db.collection('config').findOne(cfgId) || {};

        // Si es un nuevo día, reiniciar contadores
        if (cfg.lastPracticeDate !== dayId) {
            await db.collection('config').updateOne(
                cfgId,
                {
                    $set: {
                        lastPracticeDate: dayId,
                        practicedTodayNew: 0,
                        practicedTodayTotal: 0
                    },
                    $setOnInsert: { maxOrden: 7, metaDefault: 20 }
                },
                { upsert: true }
            );
        }

        // Incrementar contadores
        const incDoc = { practicedTodayTotal: 1 };
        if (wasNew) incDoc.practicedTodayNew = 1;

        await db.collection('config').updateOne(
            cfgId,
            { $inc: incDoc },
            { upsert: true }
        );

        return res.status(200).json({ ok: true, message: 'Frase actualizada' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error al actualizar la frase' });
    }
}
