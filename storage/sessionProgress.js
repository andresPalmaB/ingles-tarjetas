// storage/sessionProgress.js
const PROGRESS_KEY = 'progressByDay';
const SESSION_KEY = 'sessionPhrasesByDay';

export function getDayIdBogota(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return fmt.format(date); // YYYY-MM-DD
}

// ---- Progreso (hechas hoy) ----
export function loadDoneToday() {
    if (typeof window === 'undefined') return 0;
    const dayId = getDayIdBogota();
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return all[dayId] || 0;
}

export function incDoneToday(delta = 1) {
    const dayId = getDayIdBogota();
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    all[dayId] = (all[dayId] || 0) + delta;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    return all[dayId];
}

export function resetDailyProgress() {
    try { localStorage.removeItem(PROGRESS_KEY); } catch {}
}

// ---- Sesión (IDs vistos hoy) ----
export function loadSessionIds() {
    if (typeof window === 'undefined') return [];
    const dayId = getDayIdBogota();
    const all = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    return all[dayId] || [];
}

export function addSessionId(id) {
    const dayId = getDayIdBogota();
    const all = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    const set = new Set(all[dayId] || []);
    set.add(String(id));
    all[dayId] = Array.from(set);
    localStorage.setItem(SESSION_KEY, JSON.stringify(all));
}

export function ensureSessionBucket() {
    const dayId = getDayIdBogota();
    const all = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    if (!all[dayId]) {
        all[dayId] = [];
        localStorage.setItem(SESSION_KEY, JSON.stringify(all));
    }
}

export function resetSessionIds() {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
}
