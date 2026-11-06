/** Pure helpers for (composite) indexes. Column order inside an index is the index order. */

/** Name shown when the user did not give one: `<table>_<col1>_<col2>_idx` (`_uq` when unique). */
export function indexName(table, ix) {
    if (ix.name) return ix.name;
    const names = ix.columns.map(
        (id) => table.columns.find((c) => c.id === id)?.name || "?",
    );
    return [table.name, ...names, ix.unique ? "uq" : "idx"]
        .filter(Boolean)
        .join("_");
}

/** Indexes of a table that contain the column. */
export const indexesOfColumn = (table, columnId) =>
    table.indexes.filter((ix) => ix.columns.includes(columnId));

/** Column ids in the order they appear in the table (a selection Set has no order of its own). */
export const inTableOrder = (table, ids) => {
    const set = new Set(ids);
    return table.columns.filter((c) => set.has(c.id)).map((c) => c.id);
};

/** An existing index with exactly these columns in this order, or undefined. */
export const findSameIndex = (table, columns, ignoreId = null) =>
    table.indexes.find(
        (ix) =>
            ix.id !== ignoreId &&
            ix.columns.length === columns.length &&
            ix.columns.every((c, i) => c === columns[i]),
    );

/** Move item `from` to `to` (clamped). Returns a new array, or null when nothing changes. */
export function moveItem(list, from, to) {
    const target = Math.max(0, Math.min(list.length - 1, to));
    if (from < 0 || from >= list.length || target === from) return null;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(target, 0, item);
    return next;
}
