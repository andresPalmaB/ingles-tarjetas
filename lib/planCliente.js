export async function fetchPlan({ limit, maxOrden, excludeIds = [] }) {
    const qs = new URLSearchParams();
    if (limit != null) qs.set('limit', String(limit));
    if (maxOrden != null) qs.set('maxOrden', String(maxOrden));
    if (excludeIds?.length) qs.set('exclude', excludeIds.join(','));

    const resp = await fetch(`/api/plan?${qs.toString()}`);
    const data = await resp.json();
    if (!data?.ok) throw new Error(data?.error || 'API error');
    return Array.isArray(data.items) ? data.items : [];
}