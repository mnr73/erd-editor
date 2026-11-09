/** The list of recently opened files: newest first, no duplicates, at most `MAX_RECENT`. */
export const MAX_RECENT = 5;

/** Put `path` at the front. Anything that is not a non-empty string is ignored. */
export function addRecent(list, path, max = MAX_RECENT) {
    if (typeof path !== "string" || !path) return list;
    return [path, ...list.filter((p) => p !== path)].slice(0, max);
}

export function removeRecent(list, path) {
    return list.filter((p) => p !== path);
}

/** Read the stored JSON; anything unexpected gives an empty list. */
export function parseRecent(raw, max = MAX_RECENT) {
    try {
        const v = JSON.parse(raw);
        if (!Array.isArray(v)) return [];
        const seen = new Set();
        return v
            .filter(
                (p) =>
                    typeof p === "string" && p && !seen.has(p) && seen.add(p),
            )
            .slice(0, max);
    } catch {
        return [];
    }
}
