import { idb } from '../idb';

// Busca robustamente por la CLAVE REAL (keyPath = 'id').
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

    // 3) Fallback: buscar por cualquier campo id
    f = await t.filter(x => String(x.id) === s || String(x._id) === s).first();
    return f;
}

/**
 * Sistema de Repetición Espaciada:
 * - Nivel 0: Aparece hoy mismo (nueva)
 * - Nivel 1: Aparece mañana (1 día)
 * - Nivel 2: Aparece en 3 días
 * - Nivel 3: Aparece en 7 días
 * - Nivel 4: Aparece en 30 días
 *
 * Si falla (incorrecta), retrocede un nivel (mínimo 0)
 */
function calcularProximaFecha(nivelActual, respuesta) {
    const ahora = new Date();
    let dias = 0;

    if (respuesta === 'correcta') {
        // Avanza de nivel
        switch (nivelActual) {
            case 0: dias = 1; break;   // nivel 0 → 1: mañana
            case 1: dias = 3; break;   // nivel 1 → 2: en 3 días
            case 2: dias = 7; break;   // nivel 2 → 3: en 1 semana
            case 3: dias = 30; break;  // nivel 3 → 4: en 1 mes
            default: dias = 30; break; // nivel 4+: mantener en 1 mes
        }
    } else {
        // Retrocede un nivel (incorrecta)
        if (nivelActual === 0) {
            dias = 0; // Si es nivel 0, vuelve a aparecer hoy mismo
        } else {
            // Retrocede: aparece mañana para repasar
            dias = 1;
        }
    }

    const proxima = new Date(ahora);
    proxima.setDate(ahora.getDate() + dias);
    return proxima.toISOString();
}

function calcularNuevoNivel(nivelActual, respuesta) {
    if (respuesta === 'correcta') {
        // Avanza de nivel (máximo 4)
        return Math.min(4, (nivelActual || 0) + 1);
    } else {
        // Retrocede un nivel (mínimo 0)
        return Math.max(0, (nivelActual || 0) - 1);
    }
}

export async function responderLocal({ id, respuesta }) {
    const frase = await getFraseByAnyId(id);
    if (!frase) throw new Error('Frase no encontrada: ' + id);

    const nivelAnterior = frase.nivelActual ?? 0;
    const nuevoNivel = calcularNuevoNivel(nivelAnterior, respuesta);
    const proximaFecha = calcularProximaFecha(nivelAnterior, respuesta);
    const ahora = new Date().toISOString();

    // Actualizar la frase con los nuevos valores
    const actualizada = {
        ...frase,
        nivelActual: nuevoNivel,
        ultimaRespuesta: respuesta,
        fechaUltimoEstudio: ahora,
        revisarEnFecha: proximaFecha,
    };

    // Guardar usando la clave primaria correcta
    await idb.table('frases').put({ ...actualizada, id: frase.id });

    // Actualizar config (contadores del día) - tu código de AppUI.jsx ya hace esto
    // No duplicamos la lógica aquí

    return { ok: true, frase: actualizada };
}
