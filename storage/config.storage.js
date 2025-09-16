// storage/config.storage.js
import { getConfig as getCfgLocal, setConfig as setCfgLocal } from '../lib/idb';

export const leerConfig = async () => {
    return (
        (await getCfgLocal()) || {
            id: 'appConfig',
            maxOrden: 1,
            metaDefault: 20,
            lastPracticeDate: null,
            practicedTodayNew: 0,
            practicedTodayTotal: 0,
        }
    );
};

export const guardarConfig = async (partial) => {
    const current = (await getCfgLocal()) || {
        id: 'appConfig',
        maxOrden: 1,
        metaDefault: 20,
        lastPracticeDate: null,
        practicedTodayNew: 0,
        practicedTodayTotal: 0,
    };
    const merged = { ...current, ...partial, id: 'appConfig' };
    await setCfgLocal(merged);
    const updated = await getCfgLocal();
    return { ok: true, config: updated || merged };
};