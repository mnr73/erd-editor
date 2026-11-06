/**
 * Search over a document (pure). Matches table, column, section and relationship names, types,
 * labels and notes, case-insensitively. Results are ranked: exact name > name starts with >
 * name contains > other fields (type / note / label), then tables before columns before the rest.
 */

const KIND_ORDER = { table: 0, column: 1, group: 2, ref: 3 };

/** Rank of `text` for query `q` (lower is better), or null when it does not match. */
function rank(text, q, base) {
    const s = String(text ?? "").toLowerCase();
    if (!s) return null;
    if (s === q) return base;
    if (s.startsWith(q)) return base + 1;
    if (s.includes(q)) return base + 2;
    return null;
}

const best = (...ranks) => {
    const r = ranks.filter((x) => x !== null);
    return r.length ? Math.min(...r) : null;
};

/**
 * Returns [{ kind, id, tableId?, name, detail, rank }] sorted best first, at most `limit`.
 * `kind` is "table" | "column" | "group" | "ref"; for a column `id` is the column id.
 */
export function searchDocument(doc, query, limit = 40) {
    const q = String(query ?? "")
        .trim()
        .toLowerCase();
    if (!q) return [];
    const out = [];
    const tableName = (id) => doc.tables.find((t) => t.id === id)?.name ?? "?";

    for (const t of doc.tables) {
        const r = best(
            rank(t.name, q, 0),
            rank(`${t.schema}.${t.name}`, q, 0),
            rank(t.note, q, 10),
        );
        if (r !== null)
            out.push({
                kind: "table",
                id: t.id,
                name: t.name,
                detail: `${t.columns.length}`,
                rank: r,
            });
        for (const c of t.columns) {
            const cr = best(
                rank(c.name, q, 3),
                rank(c.type, q, 10),
                rank(c.note, q, 10),
                rank(c.default, q, 11),
            );
            if (cr !== null)
                out.push({
                    kind: "column",
                    id: c.id,
                    tableId: t.id,
                    name: c.name,
                    detail: `${t.name} · ${c.type}`,
                    rank: cr,
                });
        }
    }
    for (const g of doc.groups) {
        const r = best(rank(g.name, q, 6), rank(g.note, q, 10));
        if (r !== null)
            out.push({
                kind: "group",
                id: g.id,
                name: g.name,
                detail: "",
                rank: r,
            });
    }
    for (const r of doc.refs) {
        const rr = best(rank(r.label, q, 8), rank(r.note, q, 10));
        if (rr !== null)
            out.push({
                kind: "ref",
                id: r.id,
                name:
                    r.label ||
                    `${tableName(r.from.table)} → ${tableName(r.to.table)}`,
                detail: `${tableName(r.from.table)} → ${tableName(r.to.table)}`,
                rank: rr,
            });
    }
    return out
        .sort(
            (a, b) =>
                a.rank - b.rank ||
                KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
                a.name.localeCompare(b.name),
        )
        .slice(0, limit);
}
