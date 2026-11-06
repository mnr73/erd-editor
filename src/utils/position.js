const OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" };

/** `inline-start` / `inline-end` follow the document direction; others pass through. */
export function resolveSide(side, dir) {
    if (side === "inline-start") return dir === "rtl" ? "right" : "left";
    if (side === "inline-end") return dir === "rtl" ? "left" : "right";
    return side;
}

/** A point (context menu) as a zero-size anchor rect. */
export function pointRect(x, y) {
    return { left: x, right: x, top: y, bottom: y, width: 0, height: 0 };
}

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

/**
 * Place a floating box next to an anchor rect (all viewport coordinates).
 *
 * - `side`: top | bottom | left | right | inline-start | inline-end
 * - `align`: start | center | end. For top/bottom it is the inline axis (follows `dir`);
 *   for left/right it is the vertical axis.
 * Flips to the opposite side if it overflows and the other side fits; then clamps into the viewport.
 */
export function computePosition({
    anchor,
    size,
    side = "bottom",
    align = "start",
    dir = "ltr",
    offset = 6,
    pad = 8,
    viewport,
}) {
    const wanted = resolveSide(side, dir);

    const place = (s) => {
        if (s === "top" || s === "bottom") {
            const y =
                s === "bottom"
                    ? anchor.bottom + offset
                    : anchor.top - offset - size.h;
            const startX = dir === "rtl" ? anchor.right - size.w : anchor.left;
            const endX = dir === "rtl" ? anchor.left : anchor.right - size.w;
            const centerX = anchor.left + anchor.width / 2 - size.w / 2;
            return {
                x:
                    align === "start"
                        ? startX
                        : align === "end"
                          ? endX
                          : centerX,
                y,
            };
        }
        const x =
            s === "right"
                ? anchor.right + offset
                : anchor.left - offset - size.w;
        const startY = anchor.top;
        const endY = anchor.bottom - size.h;
        const centerY = anchor.top + anchor.height / 2 - size.h / 2;
        return {
            x,
            y: align === "start" ? startY : align === "end" ? endY : centerY,
        };
    };

    const fits = (s, p) => {
        if (s === "bottom") return p.y + size.h <= viewport.height - pad;
        if (s === "top") return p.y >= pad;
        if (s === "right") return p.x + size.w <= viewport.width - pad;
        return p.x >= pad;
    };

    let final = wanted;
    let pos = place(wanted);
    if (!fits(wanted, pos)) {
        const flipped = place(OPPOSITE[wanted]);
        if (fits(OPPOSITE[wanted], flipped)) {
            final = OPPOSITE[wanted];
            pos = flipped;
        }
    }

    return {
        x: Math.round(
            clamp(pos.x, pad, Math.max(pad, viewport.width - size.w - pad)),
        ),
        y: Math.round(
            clamp(pos.y, pad, Math.max(pad, viewport.height - size.h - pad)),
        ),
        side: final,
    };
}
