/**
 * Pure helpers for selecting and moving columns. A "selection" is a Set of column ids of ONE table.
 */

/** Ids from `a` to `b` inclusive, in table order (either direction). */
export function rangeIds(columns, a, b) {
    const i = columns.findIndex((c) => c.id === a);
    const j = columns.findIndex((c) => c.id === b);
    if (i < 0 || j < 0) return [];
    const [from, to] = i < j ? [i, j] : [j, i];
    return columns.slice(from, to + 1).map((c) => c.id);
}

/**
 * Move the selected columns one step up (dir -1) or down (+1), keeping their relative order.
 * Blocks stop at the edge as a whole. Returns the new array, or null when nothing can move.
 */
export function moveSelection(columns, selected, dir) {
    const cols = [...columns];
    const sel = (c) => selected.has(c.id);
    let moved = false;
    if (dir < 0) {
        for (let i = 1; i < cols.length; i++) {
            if (sel(cols[i]) && !sel(cols[i - 1])) {
                [cols[i - 1], cols[i]] = [cols[i], cols[i - 1]];
                moved = true;
            }
        }
    } else {
        for (let i = cols.length - 2; i >= 0; i--) {
            if (sel(cols[i]) && !sel(cols[i + 1])) {
                [cols[i + 1], cols[i]] = [cols[i], cols[i + 1]];
                moved = true;
            }
        }
    }
    return moved ? cols : null;
}

/** Id of the column `dir` steps from `id`, clamped to the table; null for an empty table. */
export function stepColumn(columns, id, dir) {
    if (!columns.length) return null;
    const i = columns.findIndex((c) => c.id === id);
    const next = Math.max(
        0,
        Math.min(columns.length - 1, (i < 0 ? 0 : i) + dir),
    );
    return columns[next].id;
}
