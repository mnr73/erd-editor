import { tableHeight, tableWidth } from "../geometry";

/**
 * Places freshly imported tables (they have no positions). Related tables end up next to each other:
 * tables are ordered by a breadth-first walk over the relationships (most connected first), then laid
 * out in rows of roughly square shape with a fixed gap. Pure and deterministic.
 */
export const GRID_GAP_X = 80;
export const GRID_GAP_Y = 60;

export function layoutGrid(
    doc,
    { origin = { x: 0, y: 0 }, maxRowWidth = null } = {},
) {
    const tables = doc.tables;
    if (!tables.length) return;
    const degree = new Map(tables.map((t) => [t.id, 0]));
    const adj = new Map(tables.map((t) => [t.id, new Set()]));
    for (const r of doc.refs) {
        const a = r.from.table;
        const b = r.to.table;
        if (a === b || !adj.has(a) || !adj.has(b)) continue;
        adj.get(a).add(b);
        adj.get(b).add(a);
        degree.set(a, degree.get(a) + 1);
        degree.set(b, degree.get(b) + 1);
    }
    const order = [];
    const seen = new Set();
    const byDegree = [...tables].sort(
        (a, b) => degree.get(b.id) - degree.get(a.id),
    );
    for (const start of byDegree) {
        if (seen.has(start.id)) continue;
        const queue = [start.id];
        seen.add(start.id);
        while (queue.length) {
            const id = queue.shift();
            order.push(id);
            const next = [...adj.get(id)]
                .filter((n) => !seen.has(n))
                .sort((x, y) => degree.get(y) - degree.get(x));
            for (const n of next) {
                seen.add(n);
                queue.push(n);
            }
        }
    }
    const byId = new Map(tables.map((t) => [t.id, t]));
    const ordered = order.map((id) => byId.get(id));
    const total = ordered.reduce((s, t) => s + tableWidth(t) + GRID_GAP_X, 0);
    const rowWidth =
        maxRowWidth ?? Math.max(900, Math.sqrt(total * 520) * 1.25);
    let x = origin.x;
    let y = origin.y;
    let rowH = 0;
    for (const t of ordered) {
        const w = tableWidth(t);
        if (x > origin.x && x + w > origin.x + rowWidth) {
            x = origin.x;
            y += rowH + GRID_GAP_Y;
            rowH = 0;
        }
        t.x = Math.round(x);
        t.y = Math.round(y);
        x += w + GRID_GAP_X;
        rowH = Math.max(rowH, tableHeight(t));
    }
}
