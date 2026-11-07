import { BODY_PAD, BORDER, HEADER_H, ROW_H, tableRect } from "./geometry";

/**
 * Relationship geometry (pure, shared by the canvas, minimap and exporters).
 *
 * A ref connects ONE row of the `from` table to ONE row of the `to` table (the first column of a
 * composite key). Lines leave the table sideways: on the side facing the other table, or on the same
 * side (a loop) when the tables are stacked above each other or the ref points at its own table.
 * Collapsed tables connect at the header.
 */

const STUB = 12; // straight piece next to the table before the line bends
const LOOP = 40; // how far a same-side loop sticks out
const SELF_LOOP = 34;
const CORNER = 6;
const FACING_GAP = 40; // tables need at least this much empty space between them (in x) to face each other

/** Y (world) of the anchor of column `columnId`; collapsed tables and unknown columns use the header. */
export function anchorY(table, columnId) {
    const i = table.columns.findIndex((c) => c.id === columnId);
    const r = tableRect(table);
    if (table.collapsed || i < 0) return r.y + BORDER + HEADER_H / 2;
    return r.y + BORDER + HEADER_H + BODY_PAD + i * ROW_H + ROW_H / 2;
}

/** The two side signs (+1 right edge, -1 left edge) for an `a → b` connection. */
export function sides(a, b) {
    const ra = tableRect(a);
    const rb = tableRect(b);
    if (a.id === b.id) return [1, 1];
    // Compare the real gap between the edges, not the centres: a narrow table under a wide one has
    // centres far apart while the two still overlap, and a line "between" them would run backwards.
    const gapRight = rb.x - (ra.x + ra.w); // b is to the right of a
    const gapLeft = ra.x - (rb.x + rb.w); // b is to the left of a
    if (gapRight >= FACING_GAP) return [1, -1];
    if (gapLeft >= FACING_GAP) return [-1, 1];
    return [1, 1];
}

/**
 * Path of a relation. `bend` shifts the vertical segment sideways (used to separate parallel lines).
 * Returns { d, p, q, sa, sb, lx, ly }: SVG path, both end points `{x, y, o}` (o = outward direction),
 * and the label anchor.
 */
export function routeRef(ref, from, to, bend = 0) {
    const ra = tableRect(from);
    const rb = tableRect(to);
    const [sa, sb] = sides(from, to);
    const p = {
        x: sa > 0 ? ra.x + ra.w : ra.x,
        y: anchorY(from, ref.from.columns[0]),
        o: sa,
    };
    const q = {
        x: sb > 0 ? rb.x + rb.w : rb.x,
        y: anchorY(to, ref.to.columns[0]),
        o: sb,
    };

    if (sa === sb) {
        // both ends on the same side: a C-shaped loop around the outer edge
        const self = from.id === to.id;
        const out =
            (sa > 0 ? Math.max(p.x, q.x) : Math.min(p.x, q.x)) +
            sa * ((self ? SELF_LOOP : LOOP) + Math.abs(bend));
        const d =
            `M${p.x} ${p.y}H${p.x + sa * STUB}` +
            `C${out} ${p.y} ${out} ${q.y} ${q.x + sa * STUB} ${q.y}H${q.x}`;
        return { d, p, q, sa, sb, lx: out - sa * 8, ly: (p.y + q.y) / 2 };
    }

    const mx = (p.x + q.x) / 2 + bend;
    const dy = q.y - p.y;
    const sy = dy >= 0 ? 1 : -1;
    const rr = Math.min(CORNER, Math.abs(dy) / 2);
    const d =
        `M${p.x} ${p.y}H${mx - sa * rr}` +
        `Q${mx} ${p.y} ${mx} ${p.y + sy * rr}` +
        `V${q.y - sy * rr}` +
        `Q${mx} ${q.y} ${mx - sb * rr} ${q.y}H${q.x}`;
    return { d, p, q, sa, sb, lx: mx, ly: (p.y + q.y) / 2 };
}

/**
 * Crow's Foot end for a cardinality at point `pt` ({x, y, o}). `m` are strokes, `c` is the optional
 * circle (drawn with the card background as fill so the line does not show through it).
 */
export function markerPath(pt, cardinality) {
    const { x, y, o } = pt;
    const bar = (d) => `M${x + o * d} ${y - 5}V${y + 5}`;
    const circle = (d) => {
        const cx = x + o * d;
        return `M${cx - 3.5} ${y}a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0`;
    };
    const foot =
        `M${x + o * 11} ${y}L${x} ${y - 5}` +
        `M${x + o * 11} ${y}L${x} ${y + 5}`;
    switch (cardinality) {
        case "1":
            return { m: bar(7) + bar(11), c: "" };
        case "0..1":
            return { m: bar(7), c: circle(15) };
        case "1..*":
            return { m: foot + bar(14), c: "" };
        case "0..*":
            return { m: foot, c: circle(15) };
        default:
            return { m: bar(9), c: "" };
    }
}

/** Parallel refs between the same pair of tables get different bends so they do not overlap. */
export function bendFor(index, count) {
    if (count <= 1) return 0;
    return (index - (count - 1) / 2) * 14;
}

/**
 * Geometry of every ref of a document, keyed by ref id. Refs whose tables or columns are missing
 * (a broken file) are skipped, never thrown on.
 */
export function layoutRefs(doc) {
    const tables = new Map(doc.tables.map((t) => [t.id, t]));
    const groups = new Map();
    for (const r of doc.refs) {
        const key = [r.from.table, r.to.table].sort().join("|");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r.id);
    }
    const out = new Map();
    for (const r of doc.refs) {
        const from = tables.get(r.from.table);
        const to = tables.get(r.to.table);
        if (!from || !to) continue;
        if (!r.from.columns.length || !r.to.columns.length) continue;
        const peers = groups.get([r.from.table, r.to.table].sort().join("|"));
        const bend = bendFor(peers.indexOf(r.id), peers.length);
        const route = routeRef(r, from, to, bend);
        out.set(r.id, {
            ...route,
            a: markerPath(route.p, r.from.cardinality),
            b: markerPath(route.q, r.to.cardinality),
        });
    }
    return out;
}

/** Refs touching a table (optionally only a column of it). */
export function refsOf(doc, tableId, columnId = null) {
    return doc.refs.filter((r) =>
        [r.from, r.to].some(
            (e) =>
                e.table === tableId &&
                (columnId === null || e.columns.includes(columnId)),
        ),
    );
}

/** Set of `${tableId}.${columnId}` keys that the given refs connect (for row highlighting). */
export function columnKeysOf(refs) {
    const keys = new Set();
    for (const r of refs)
        for (const e of [r.from, r.to])
            for (const c of e.columns) keys.add(`${e.table}.${c}`);
    return keys;
}

/**
 * The ref to highlight: the focused one wins; else everything touching the selected column;
 * else everything touching the selected table(s). Returns a Set of ref ids (empty = no focus).
 */
export function focusedRefIds(doc, { refId, hoverRefId, columnSel, tableIds }) {
    const one = refId ?? hoverRefId;
    if (one) return new Set(doc.refs.some((r) => r.id === one) ? [one] : []);
    if (columnSel?.ids?.size) {
        const ids = new Set();
        for (const c of columnSel.ids)
            for (const r of refsOf(doc, columnSel.tableId, c)) ids.add(r.id);
        return ids;
    }
    const ids = new Set();
    for (const t of tableIds ?? [])
        for (const r of refsOf(doc, t)) ids.add(r.id);
    return ids;
}
