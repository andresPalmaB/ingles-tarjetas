// storage/snapshot.js
const SNAPSHOT_KEY = 'studySessionSnapshot';

export function loadSnapshot() {
    try { return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null'); } catch { return null; }
}

export function saveSnapshot(snap) {
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap)); } catch {}
}

export function clearSnapshot() {
    try { localStorage.removeItem(SNAPSHOT_KEY); } catch {}
}
