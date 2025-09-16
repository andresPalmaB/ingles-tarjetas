import Dexie from 'dexie';

export const idb = new Dexie('ingles_tarjetas');

idb.version(1).stores({
    historias: '++id, orden',
    frases: '++id, historiaId, historiaOrden, orden, revisarEnFecha, nivelActual',
    config: 'id' // usaremos 'appConfig'
});

// Helpers opcionales (aún no usados por la UI; sirven después)
export async function getConfig() {
    return (await idb.table('config').get('appConfig')) || null;
}
export async function setConfig(partial) {
    const prev = (await getConfig()) || { id: 'appConfig' };
    await idb.table('config').put({ ...prev, ...partial, id: 'appConfig' });
}
