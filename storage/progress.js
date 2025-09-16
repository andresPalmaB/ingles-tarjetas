function kToday() {
    const d = new Date();
    const key = d.toISOString().slice(0,10); // YYYY-MM-DD
    return `done_today_v1:${key}`;
}

export function loadDoneToday() {
    const n = parseInt(localStorage.getItem(kToday()) || '0', 10);
    return Number.isNaN(n) ? 0 : n;
}

export function setDoneToday(n) {
    localStorage.setItem(kToday(), String(Math.max(0, n|0)));
}

export function resetDoneToday() {
    localStorage.removeItem(kToday());
}
