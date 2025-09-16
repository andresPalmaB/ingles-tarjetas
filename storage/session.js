const KEY_SESSION_IDS = 'session_ids_v1';

export function loadSessionIds() {
    try { return JSON.parse(sessionStorage.getItem(KEY_SESSION_IDS)) || []; }
    catch { return []; }
}

export function addSessionId(id) {
    const arr = loadSessionIds();
    const s = String(id);
    if (!arr.includes(s)) arr.push(s);
    sessionStorage.setItem(KEY_SESSION_IDS, JSON.stringify(arr));
}

export function clearSessionIds() {
    sessionStorage.removeItem(KEY_SESSION_IDS);
}
