import { getDb } from '../../lib/mongodb';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    // ✅ Acepta GET y POST (para poder ejecutarlo desde el navegador)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Usa GET o POST.' });
    }

    try {
        const db = await getDb(); // usa la DB por defecto de tu MONGODB_URI (ingles)

        // Crear colecciones si no existen
        for (const name of ['historias', 'frases', 'config']) {
            const exists = (await db.listCollections({ name }).toArray()).length > 0;
            if (!exists) await db.createCollection(name);
        }

        // (Opcional) Reset via ?reset=true
        const reset = String(req.query.reset || '').toLowerCase() === 'true';
        if (reset) {
            // Si quieres borrar índices también, podrías usar drop() en lugar de deleteMany({})
            await db.collection('frases').deleteMany({});
            await db.collection('historias').deleteMany({});
            await db.collection('config').deleteMany({});
        }

        // Índices (seguros de ejecutar varias veces)
        await db.collection('historias').createIndex({ orden: 1 }, { unique: true });
        await db.collection('frases').createIndex({ historiaId: 1 });
        await db.collection('frases').createIndex({ historiaOrden: 1 });
        await db.collection('frases').createIndex({ historiaId: 1, orden: 1 }, { unique: true });

        // Leer JSON de historias
        const filePath = path.join(process.cwd(), 'data', 'historias_estructuradas.json');
        const raw = fs.readFileSync(filePath, 'utf8');
        const historiasJson = JSON.parse(raw);

        if (!Array.isArray(historiasJson)) {
            return res.status(400).json({ ok: false, error: 'El JSON debe ser un array' });
        }

        // Orden consistente por 'orden'
        const historiasOrdenadas = [...historiasJson].sort(
            (a, b) => Number(a.orden || 0) - Number(b.orden || 0)
        );

        // 1) Insertar HISTORIAS (ajusta campos si tu JSON trae otros)
        const historiasDocs = historiasOrdenadas.map(h => ({
            titulo: h.titulo ?? h.title ?? null,
            descripcion: h.descripcion ?? h.description ?? null,
            orden: Number(h.orden),
        }));

        // Inserta (si ya hay duplicados por 'orden', limpiamos e intentamos una vez más)
        let resultHistorias;
        try {
            resultHistorias = await db.collection('historias').insertMany(historiasDocs, { ordered: true });
        } catch (e) {
            if (e?.code === 11000) {
                // Duplicados: limpiamos e insertamos de nuevo
                await db.collection('historias').deleteMany({});
                resultHistorias = await db.collection('historias').insertMany(historiasDocs, { ordered: true });
            } else {
                throw e;
            }
        }

        // Mapa orden -> _id según el orden de inserción
        const ordenToId = {};
        historiasOrdenadas.forEach((h, idx) => {
            ordenToId[Number(h.orden)] = resultHistorias.insertedIds[idx];
        });

        // 2) Construir e insertar FRASES a partir de las historias
        const ahora = new Date();
        const frasesDocs = [];

        for (const h of historiasOrdenadas) {
            const historiaId = ordenToId[Number(h.orden)];
            const frases = Array.isArray(h.frases) ? h.frases : [];

            for (let i = 0; i < frases.length; i++) {
                const f = frases[i];
                frasesDocs.push({
                    // Ajusta estos nombres a tu JSON real:
                    textoIngles: f.textoIngles ?? f.en ?? f.english ?? null,
                    traduccion:  f.traduccion  ?? f.es ?? f.spanish  ?? null,

                    historiaId,
                    historiaOrden: Number(h.orden),    // útil para filtro "1 a 7"
                    orden: Number(f.orden ?? i + 1),   // orden dentro de la historia

                    // estado inicial para tu app
                    nivelActual: 0,
                    ultimaRespuesta: null,
                    fechaUltimoEstudio: null,
                    revisarEnFecha: ahora,             // “para hoy”
                });
            }
        }

        let resultFrases = { insertedCount: 0 };
        if (frasesDocs.length) {
            // ordered:false para que si hay choque con índice único historiaId+orden, continúe
            resultFrases = await db.collection('frases').insertMany(frasesDocs, { ordered: false });
        }

        // Config mínima si está vacía (inicializa contadores de progreso)
        if (await db.collection('config').countDocuments() === 0) {
            const dayId = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Bogota',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date());

            await db.collection('config').insertOne({
                _id: 'appConfig', // ID fijo para usar en todo el sistema
                createdAt: new Date(),
                version: 1,
                notas: 'Seed inicial desde historias_estructuradas.json',
                maxOrden: 1,
                metaDefault: 20,
                lastPracticeDate: dayId,
                practicedTodayNew: 0,
                practicedTodayTotal: 0
            });
        }

        return res.status(200).json({
            ok: true,
            reset,
            historiasInsertadas: resultHistorias.insertedCount,
            frasesInsertadas: resultFrases.insertedCount,
        });
    } catch (e) {
        console.error('Seed error:', e);
        return res.status(500).json({ ok: false, error: e?.message || 'Error insertando datos' });
    }
}