// /pages/api/plan-dia.js
import clientPromise from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

function toObjectIds(csv) {
    return String(csv || '')
        .split(',').map(s => s.trim()).filter(Boolean)
        .map(id => { try { return new ObjectId(id); } catch { return null; } })
        .filter(Boolean);
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function interleaveRandom(a, b) {
    const res = [];
    const A = [...a], B = [...b];
    while (A.length || B.length) {
        if (A.length && B.length) {
            if (Math.random() < 0.5) res.push(A.shift());
            else res.push(B.shift());
        } else if (A.length) res.push(A.shift());
        else if (B.length) res.push(B.shift());
    }
    return res;
}

function ymdInTZ(date = new Date(), timeZone = 'America/Bogota') {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    });
    return fmt.format(date);
}

export default async function handler(req, res) {
    try {
        const client = await clientPromise;
        const db = client.db('ingles');

        const excludeIds = toObjectIds(req.query.exclude);
        const baseExclude = excludeIds.length ? { _id: { $nin: excludeIds } } : {};
        const now = new Date();
        const todayYMD = ymdInTZ(now, 'America/Bogota');

        const cfgId = { _id: 'appConfig' };
        const cfg = await db.collection('config').findOne(cfgId) || {};
        const maxOrden = Math.max(1, parseInt(req.query.maxOrden ?? cfg.maxOrden ?? '7', 10));

        const metaTotal = Math.max(
            1,
            parseInt(req.query.limit ?? req.query.nuevas ?? cfg.metaDefault ?? '20', 10)
        );

        let lastPracticeDate = cfg.lastPracticeDate || null;
        let practicedTodayNew = Number.isFinite(cfg.practicedTodayNew) ? cfg.practicedTodayNew : 0;

        // 🔹 Aquí se añade practicedTodayTotal al reset diario
        if (lastPracticeDate !== todayYMD) {
            await db.collection('config').updateOne(
                cfgId,
                {
                    $set: {
                        lastPracticeDate: todayYMD,
                        practicedTodayNew: 0,
                        practicedTodayTotal: 0
                    },
                    $setOnInsert: { maxOrden: 7, metaDefault: 20 }
                },
                { upsert: true }
            );
            lastPracticeDate = todayYMD;
            practicedTodayNew = 0;
        }

        const cupoNuevasHoy = Math.max(0, metaTotal - practicedTodayNew);

        const historias = await db.collection('historias')
            .find({ orden: { $lte: maxOrden } }, { projection: { _id: 1 } })
            .toArray();

        if (!historias.length) {
            return res.status(200).json({
                ok: true, dueCount: 0, nuevasCount: 0, total: 0,
                items: [], seleccionadas: [],
                metaNuevasSolicitadas: metaTotal, nuevasCupoHoy: cupoNuevasHoy,
                practicedTodayNew, lastPracticeDate
            });
        }

        const historiaObjIds = historias.map(h => h._id);
        const historiaStrIds = historiaObjIds.map(id => id.toString());
        const inHistorias = { $or: [
                { historiaId: { $in: historiaObjIds } },
                { historiaId: { $in: historiaStrIds } }
            ]};

        const due = await db.collection('frases').aggregate([
            { $match: { ...baseExclude, ...inHistorias, revisarEnFecha: { $lte: now } } },
            { $addFields: { rand: { $rand: {} } } },
            { $sort: { rand: 1 } }
        ]).toArray();

        const usedIds = new Set(due.map(d => String(d._id)));
        const usedFilter = usedIds.size ? { _id: { $nin: [...usedIds].map(id => new ObjectId(id)) } } : {};

        const nuevasPool = await db.collection('frases').find({
            ...baseExclude,
            ...usedFilter,
            ...inHistorias,
            nivelActual: 0,
            fechaUltimoEstudio: { $exists: false },
            $or: [
                { revisarEnFecha: { $exists: false } },
                { revisarEnFecha: { $gt: now } }
            ]
        }, { projection: { _id: 1, texto: 1, textoIngles: 1, traduccion: 1, historiaId: 1, nivelActual: 1 } }).toArray();

        const faltanParaMeta = Math.max(0, metaTotal - due.length);
        const cupoNuevasEfectivo = Math.max(0, Math.min(cupoNuevasHoy, faltanParaMeta));

        shuffle(nuevasPool);
        const nuevas = nuevasPool.slice(0, cupoNuevasEfectivo);

        const mezcladas = interleaveRandom(shuffle(due), shuffle(nuevas)).slice(0, metaTotal);

        const items = mezcladas.map(doc => ({
            ...doc,
            textoIngles: doc.textoIngles ?? doc.texto ?? '',
        }));

        return res.status(200).json({
            ok: true,
            dueCount: due.length,
            nuevasCount: nuevas.length,
            nuevasPoolTotal: nuevasPool.length,
            metaNuevasSolicitadas: metaTotal,
            nuevasCupoHoy: cupoNuevasHoy,
            practicedTodayNew,
            lastPracticeDate,
            total: items.length,
            items,
            seleccionadas: items
        });

    } catch (e) {
        console.error(e);
        return res.status(500).json({ ok: false, error: e.message });
    }
}
