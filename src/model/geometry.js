/**
 * World-space geometry of canvas items, computed from the document (never measured from the DOM),
 * so hit-testing, the minimap, fit-to-screen, group membership and relation anchors all agree with
 * what is drawn. The table card is rendered with exactly these width / height values.
 *
 * Pure JS (no Vue, no DOM): the same code runs in exporters and in the MCP server.
 */
import { MIN_GROUP_SIZE } from "./constants";

export const BORDER = 1;
export const HEADER_H = 30;
export const ROW_H = 22;
export const BODY_PAD = 3;
/** Body height of a table with no columns (placeholder + "new column" button) */
export const EMPTY_BODY_H = 64;
export const MIN_TABLE_W = 200;
/** A table grows with its longest name / type up to this width, then text is truncated. */
export const MAX_TABLE_W = 800;

const COLLAPSED_BADGE_W = 56;
const ICON_W = 15;

/** Advance width of one glyph in em: JetBrains Mono is exactly 0.6em; other scripts are wider. */
const LATIN_EM = 0.6;
const OTHER_EM = 0.7;

export function textWidth(text, size) {
    let em = 0;
    for (const ch of text)
        em += ch.codePointAt(0) < 0x250 ? LATIN_EM : OTHER_EM;
    return em * size;
}

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

/** Natural width of a table: the widest of its header and its rows, in whole 10px steps. */
export function tableWidth(table) {
    // header: padding + dot + gap + name + gap + chevron + padding (+ note icon, + "N columns" badge)
    let w = 8 + 10 + 7 + textWidth(table.name, 12) + 7 + 16 + 8;
    if (table.note) w += 21;
    if (table.collapsed) w += 7 + COLLAPSED_BADGE_W;

    const indexed = new Set(table.indexes.flatMap((ix) => ix.columns));
    for (const c of table.columns) {
        const icons =
            (c.unique ? 1 : 0) +
            (c.increment ? 1 : 0) +
            (c.default ? 1 : 0) +
            (c.note ? 1 : 0) +
            (indexed.has(c.id) ? 1 : 0);
        const type = c.type + (c.notNull || c.pk ? "" : "?");
        // padding + key label + gap + name + gap + icons + gap + type + gap + "more" button (reserved
        // so hovering a row never reflows it) + padding
        const row =
            8 +
            18 +
            5 +
            textWidth(c.name, 11.5) +
            5 +
            (icons ? icons * ICON_W + 2 : 0) +
            5 +
            textWidth(type, 10.5) +
            5 +
            16 +
            8;
        if (row > w) w = row;
    }
    return clamp(Math.ceil(w / 10) * 10, MIN_TABLE_W, MAX_TABLE_W);
}

export function tableHeight(table) {
    if (table.collapsed) return HEADER_H + BORDER * 2;
    const body = table.columns.length
        ? table.columns.length * ROW_H + BODY_PAD * 2
        : EMPTY_BODY_H;
    return HEADER_H + body + BORDER * 2;
}

export function tableRect(table) {
    return {
        x: table.x,
        y: table.y,
        w: tableWidth(table),
        h: tableHeight(table),
    };
}

/** Y (world) of the vertical center of column row `index`; used as relation anchor in stage 6. */
export function columnCenterY(table, index) {
    return table.y + BORDER + HEADER_H + BODY_PAD + index * ROW_H + ROW_H / 2;
}

export function groupRect(group) {
    return { x: group.x, y: group.y, w: group.w, h: group.h };
}

export function rectsIntersect(a, b) {
    return (
        a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
}

/** True when `inner` lies completely inside `outer`. */
export function rectContains(outer, inner) {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.w <= outer.x + outer.w &&
        inner.y + inner.h <= outer.y + outer.h
    );
}

export function unionRects(rects) {
    if (!rects.length) return null;
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const r of rects) {
        x1 = Math.min(x1, r.x);
        y1 = Math.min(y1, r.y);
        x2 = Math.max(x2, r.x + r.w);
        y2 = Math.max(y2, r.y + r.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Rect spanned by two corner points (any order). */
export function rectFromPoints(a, b) {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(a.x - b.x),
        h: Math.abs(a.y - b.y),
    };
}

/** Bounding box of every table and group in the document, or null when empty. */
export function contentBounds(doc) {
    return unionRects([
        ...doc.groups.map(groupRect),
        ...doc.tables.map(tableRect),
    ]);
}

/* -------------------------------- sections --------------------------------- */

/**
 * The group a rect belongs to: the innermost (smallest) group that contains it COMPLETELY, or null.
 * Membership is never stored: it is a pure function of positions, so dragging a table out of a
 * section, resizing a section, or moving a table in all just work.
 */
export function groupAt(doc, rect) {
    let best = null;
    let bestArea = Infinity;
    for (const g of doc.groups) {
        const r = groupRect(g);
        if (!rectContains(r, rect)) continue;
        const area = r.w * r.h;
        if (area < bestArea) {
            best = g.id;
            bestArea = area;
        }
    }
    return best;
}

/** Map tableId → groupId for every table that is completely inside some group. */
export function groupMembership(doc) {
    const out = new Map();
    for (const t of doc.tables) {
        const id = groupAt(doc, tableRect(t));
        if (id) out.set(t.id, id);
    }
    return out;
}

/**
 * Everything that moves when the items in `ids` move: the items themselves plus, for every moved
 * group, each table and each group lying completely inside it. Returns { tables, groups } as Sets of ids.
 */
export function movedWith(doc, ids) {
    const idSet = new Set(ids);
    const groups = new Set(
        doc.groups.filter((g) => idSet.has(g.id)).map((g) => g.id),
    );
    const tables = new Set(
        doc.tables.filter((t) => idSet.has(t.id)).map((t) => t.id),
    );
    for (const gid of [...groups]) {
        const outer = groupRect(doc.groups.find((g) => g.id === gid));
        for (const g of doc.groups) {
            if (g.id !== gid && rectContains(outer, groupRect(g)))
                groups.add(g.id);
        }
        for (const t of doc.tables) {
            if (rectContains(outer, tableRect(t))) tables.add(t.id);
        }
    }
    return { tables, groups };
}

/** Space a section keeps around the tables it was built from (extra on top for the title chip). */
export const SECTION_PAD = 32;
export const SECTION_TOP = 48;

/** Frame rect around `rects` with padding; every rect ends up completely inside it. */
export function sectionAround(rects, pad = SECTION_PAD, top = SECTION_TOP) {
    const u = unionRects(rects);
    if (!u) return null;
    return {
        x: u.x - pad,
        y: u.y - top,
        w: Math.max(MIN_GROUP_SIZE, u.w + pad * 2),
        h: Math.max(MIN_GROUP_SIZE, u.h + pad + top),
    };
}

export const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/**
 * Rect after dragging `handle` (compass name: n, s, e, w, ne, ...) by (dx, dy) world px.
 * The opposite edge stays put; the rect never gets smaller than `min` in either direction.
 */
export function resizeRect(rect, handle, dx, dy, min = MIN_GROUP_SIZE) {
    let { x, y, w, h } = rect;
    if (handle.includes("e")) w = Math.max(min, rect.w + dx);
    if (handle.includes("s")) h = Math.max(min, rect.h + dy);
    if (handle.includes("w")) {
        w = Math.max(min, rect.w - dx);
        x = rect.x + rect.w - w;
    }
    if (handle.includes("n")) {
        h = Math.max(min, rect.h - dy);
        y = rect.y + rect.h - h;
    }
    return { x, y, w, h };
}

/** Width of a pinned note card: as wide as its owner, within sensible limits. */
export const NOTE_MIN_W = 180;
export const NOTE_MAX_W = 320;
const NOTE_GAP = 8;
const NOTE_LINE = 20;
const NOTE_PAD = 16;

/** Rough height of a note card: wrapped lines at ~6px/char, plus padding. */
export function noteHeight(text, w) {
    const perLine = Math.max(12, Math.floor((w - 40) / 6.2));
    const lines = String(text)
        .split("\n")
        .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
    return lines * NOTE_LINE + NOTE_PAD;
}

/**
 * Pinned notes of a document, positioned from the (possibly live-dragged) geometry:
 * a table's note sits right under the table, a section's note under its frame.
 * Returns [{ id, kind, text, x, y, w, h }].
 */
export function pinnedNotes(doc) {
    const out = [];
    const place = (id, kind, text, rect) => {
        const w = Math.min(NOTE_MAX_W, Math.max(NOTE_MIN_W, rect.w));
        out.push({
            id,
            kind,
            text,
            x: rect.x,
            y: rect.y + rect.h + NOTE_GAP,
            w,
            h: noteHeight(text, w),
        });
    };
    for (const t of doc.tables)
        if (t.noteVisible && t.note) place(t.id, "table", t.note, tableRect(t));
    for (const g of doc.groups)
        if (g.noteVisible && g.note) place(g.id, "group", g.note, groupRect(g));
    return out;
}
