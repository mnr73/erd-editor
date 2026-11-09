/**
 * Camera math. `view` = { x, y, zoom } maps world → screen:  screen = world * zoom + (x, y)
 * (x, y is where the world origin sits inside the viewport, in screen px). Pure functions.
 */

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 3;
export const ZOOM_STEPS = [
    0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3,
];

export const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function worldToScreen(view, p) {
    return { x: p.x * view.zoom + view.x, y: p.y * view.zoom + view.y };
}

export function screenToWorld(view, p) {
    return { x: (p.x - view.x) / view.zoom, y: (p.y - view.y) / view.zoom };
}

/** The part of the world currently visible in a viewport of `size` {w, h}. */
export function visibleWorldRect(view, size) {
    const tl = screenToWorld(view, { x: 0, y: 0 });
    return { x: tl.x, y: tl.y, w: size.w / view.zoom, h: size.h / view.zoom };
}

/** Change zoom keeping the world point under screen point `anchor` fixed. */
export function zoomAt(view, newZoom, anchor) {
    const zoom = clampZoom(newZoom);
    const world = screenToWorld(view, anchor);
    return { x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom, zoom };
}

export function panBy(view, dx, dy) {
    return { ...view, x: view.x + dx, y: view.y + dy };
}

/** Next preset zoom above/below `zoom` (dir = 1 or -1); stays put at the ends. */
export function stepZoom(zoom, dir) {
    const eps = 1e-6;
    if (dir > 0) return ZOOM_STEPS.find((s) => s > zoom + eps) ?? ZOOM_MAX;
    return [...ZOOM_STEPS].reverse().find((s) => s < zoom - eps) ?? ZOOM_MIN;
}

/**
 * View that shows `rect` (world) centered in a viewport of `size`, with `padding` px around it.
 * `maxZoom` stops tiny content from being blown up.
 */
export function fitRect(
    rect,
    size,
    { padding = 64, maxZoom = 1, inset = {} } = {},
) {
    // `inset` reserves extra px on a side (e.g. the minimap): { right?, bottom?, left?, top? }
    const l = padding + (inset.left ?? 0);
    const r = padding + (inset.right ?? 0);
    const t = padding + (inset.top ?? 0);
    const b = padding + (inset.bottom ?? 0);
    const availW = Math.max(1, size.w - l - r);
    const availH = Math.max(1, size.h - t - b);
    const zoom = clampZoom(
        Math.min(
            availW / Math.max(rect.w, 1),
            availH / Math.max(rect.h, 1),
            maxZoom,
        ),
    );
    return {
        zoom,
        x: l + (availW - rect.w * zoom) / 2 - rect.x * zoom,
        y: t + (availH - rect.h * zoom) / 2 - rect.y * zoom,
    };
}

/** Keep the view's zoom, center the viewport on world point `p`. */
export function centerOn(view, p, size) {
    return {
        ...view,
        x: size.w / 2 - p.x * view.zoom,
        y: size.h / 2 - p.y * view.zoom,
    };
}

/**
 * Minimap transform: fits (content ∪ visible area) into `size` {w, h} with `pad` px.
 * Returns { scale, ox, oy } so that  mini = world * scale + (ox, oy).
 */
export function minimapTransform(bounds, size, pad = 8) {
    const scale = Math.min(
        (size.w - pad * 2) / Math.max(bounds.w, 1),
        (size.h - pad * 2) / Math.max(bounds.h, 1),
    );
    return {
        scale,
        ox: (size.w - bounds.w * scale) / 2 - bounds.x * scale,
        oy: (size.h - bounds.h * scale) / 2 - bounds.y * scale,
    };
}

/** Distance from the edge where auto-scroll starts, and the fastest speed (screen px per frame at 60 fps). */
export const EDGE_ZONE = 48;
export const EDGE_MAX_SPEED = 12;

/**
 * Auto-scroll while something is dragged to the edge of the canvas. `p` is the pointer relative to the
 * canvas, `size` its { w, h }. Returns how far to move the view this frame ({ dx, dy }, the view moves
 * opposite to the pointer so the content under it scrolls into sight). Speed grows the closer the pointer
 * is to the edge, and keeps growing a little past it, so dragging outside the window still scrolls.
 */
export function edgeScroll(p, size, zone = EDGE_ZONE, max = EDGE_MAX_SPEED) {
    const axis = (v, len) => {
        // a canvas smaller than two zones would scroll all the time: shrink the zone to fit
        const z = Math.min(zone, len / 3);
        if (v < z) return Math.min(1, (z - v) / z) * max;
        if (v > len - z) return -Math.min(1, (v - (len - z)) / z) * max;
        return 0;
    };
    return { dx: axis(p.x, size.w), dy: axis(p.y, size.h) };
}
