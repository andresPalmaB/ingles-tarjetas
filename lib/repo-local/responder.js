import { idb } from '../idb';

// Busca robustamente por la CLAVE REAL (keyPath = 'id').
// Acepta cualquier 'anyId' (string/number), por si la UI manda _id.
async function getFraseByAnyId(anyId) {
    const s = String(anyId);
    const t = idb.table('frases');

    // 1) clave primaria (string)
    let f = await t.get(s);
    if (f) return f;

    // 2) clave primaria (number)
    const n = Number(s);
    if (!Number.isNaN(n)) {
        f = await t.get(n);
        if (f) return f;
    }

    // 3) por índice 'id' (si lo tuvieras definido adicionalmente)
    try {
        f = await t.where('id').equals(s).first();
        if (f) return f;
    } catch {}

    try {
        if (!Number.isNaN(n)) {
            f = await t.where('id').equals(n).first();
            if (f) return f;
        }
    } catch {}

    // 4) Fallback sin índice (no usar where('_id') porque NO existe índice):
    f = await t.filter(x => String(x.id) === s).first();
    return f;
}

export async function responderLocal({ id, respuesta }) {
    // Acepta tanto id real como _id desde la UI
    const frase = await getFraseByAnyId(id);
    if (!frase) throw new Error('Frase no encontrada: ' + id);

    // ---- TU LÓGICA ACTUAL PARA ACTUALIZAR LA FRASE ----
    // Ejemplo (ajusta a tu lógica real):
    // const nowISO = new Date().toISOString();
    // const siguienteFecha = calcularProximaRepeticion(frase, respuesta); // tu función
    // const updated = {
    //   ...frase,
    //   nivelActual: nuevoNivel(frase.nivelActual, respuesta), // tu función
    //   fechaUltimoEstudio: nowISO,
    //   revisarEnFecha: siguienteFecha,
    // };

    // IMPORTANTE: guarda usando la CLAVE REAL 'id' (no metas _id como key).
    // await idb.table('frases').put({ ...updated, id: frase.id });
}
