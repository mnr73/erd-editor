/**
 * World-space geometry of canvas items, computed from the document (never measured from the DOM),
 * so hit-testing, the minimap, fit-to-screen and (stage 6) relation anchors all agree with what is drawn.
 * The table card is rendered with exactly these width/height values.
 */

export const BORDER = 1;
export const HEADER_H = 30;
export const ROW_H = 22;
export const BODY_PAD = 3;
/** Body height of a table with no columns (placeholder + "new column" button) */
export const EMPTY_BODY_H = 64;
export const MIN_TABLE_W = 200;
export const MAX_TABLE_W = 360;

// Average glyph widths (px) of the mono font at the sizes used in the card
const NAME_CH = 6.9;
const TYPE_CH = 6.3;
const HEAD_CH = 7.6;

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

export function tableWidth(table) {
    // header: dot + name + note icon + collapse button
    let w = 8 + 7 + table.name.length * HEAD_CH + 7 + 16 + 7 + 16 + 8;
    for (const c of table.columns) {
        // key label + name + attribute icons + type (+ "?") + paddings
        const typeLen = c.type.length + (c.notNull || c.pk ? 0 : 1);
        const row =
            8 +
            18 +
            5 +
            c.name.length * NAME_CH +
            38 +
            typeLen * TYPE_CH +
            8 +
            16;
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
