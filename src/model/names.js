/** Case-insensitive name helpers for new tables / columns. */

const lower = (s) => s.toLowerCase();

/** `base` if free, otherwise `base_2`, `base_3`, ... */
export function uniqueName(taken, base) {
    const set = new Set([...taken].map(lower));
    if (!set.has(lower(base))) return base;
    let n = 2;
    while (set.has(lower(`${base}_${n}`))) n++;
    return `${base}_${n}`;
}

/** `base_1`, `base_2`, ... first one that is free (names for brand-new items). */
export function nextName(taken, base) {
    const set = new Set([...taken].map(lower));
    let n = 1;
    while (set.has(lower(`${base}_${n}`))) n++;
    return `${base}_${n}`;
}
