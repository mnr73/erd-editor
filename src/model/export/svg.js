import { fkColumnKeys } from "../document";
import {
    BODY_PAD,
    BORDER,
    HEADER_H,
    ROW_H,
    contentBounds,
    groupRect,
    noteRect,
    pinnedNotes,
    tableRect,
} from "../geometry";
import { layoutRefs } from "../relations";
import {
    DEFAULT_NOTE_COLOR_HEX,
    DEFAULT_TABLE_COLOR,
    EXPORT_THEMES,
    mixHex,
} from "./theme";

/**
 * Document → standalone SVG (also the source of PNG export). Draws what the canvas shows: sections,
 * relation lines with Crow's Foot ends, tables (header color, PK/FK keys, types, nullable marks),
 * pinned notes and free notes. Geometry comes from the same pure modules as the canvas, so the
 * picture matches the screen. No scripts, no external resources, no CSS variables.
 */

const MONO = "'JetBrains Mono','DejaVu Sans Mono',Menlo,Consolas,monospace";
const SANS = "Inter,'Vazirmatn','DejaVu Sans',Arial,sans-serif";

const esc = (s) =>
    String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const num = (n) => Math.round(n * 100) / 100;

/** Greedy word wrap at ~`perLine` characters (matches the rough metrics of `noteHeight`). */
export function wrapText(text, perLine) {
    const lines = [];
    for (const para of String(text).split("\n")) {
        let line = "";
        for (const word of para.split(/(\s+)/)) {
            if ((line + word).length > perLine && line.trim()) {
                lines.push(line.trimEnd());
                line = word.trimStart();
            } else line += word;
            while (line.length > perLine) {
                lines.push(line.slice(0, perLine));
                line = line.slice(perLine);
            }
        }
        lines.push(line.trimEnd());
    }
    return lines;
}

const truncate = (s, max) =>
    s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s;

/**
 * `{ svg, width, height }`. `scale` only affects the width / height attributes (the viewBox is in
 * world units), `padding` is the empty margin around the content.
 */
export function toSvg(
    doc,
    { theme = "dark", padding = 40, background = true } = {},
) {
    const th = EXPORT_THEMES[theme] ?? EXPORT_THEMES.dark;
    const pinned = pinnedNotes(doc);
    const bounds = contentBounds({
        ...doc,
        notes: doc.notes ?? [],
        tables: doc.tables,
        groups: doc.groups,
    });
    const extra = pinned.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
    const all = [bounds, ...extra].filter(Boolean);
    if (!all.length)
        return { svg: emptySvg(th, background), width: 320, height: 160 };
    const x1 = Math.min(...all.map((r) => r.x)) - padding;
    const y1 = Math.min(...all.map((r) => r.y)) - padding;
    const x2 = Math.max(...all.map((r) => r.x + r.w)) + padding;
    const y2 = Math.max(...all.map((r) => r.y + r.h)) + padding;
    const width = Math.ceil(x2 - x1);
    const height = Math.ceil(y2 - y1);

    const out = [];
    out.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${num(x1)} ${num(y1)} ${width} ${height}" font-family="${SANS}">`,
    );
    if (doc.meta?.name) out.push(`<title>${esc(doc.meta.name)}</title>`);
    if (background)
        out.push(
            `<rect x="${num(x1)}" y="${num(y1)}" width="${width}" height="${height}" fill="${th.canvas}"/>`,
        );

    // sections: outermost (largest) first so inner ones are drawn on top
    const groups = [...doc.groups].sort((a, b) => b.w * b.h - a.w * a.h);
    for (const g of groups) {
        const c = g.color ?? DEFAULT_TABLE_COLOR;
        const r = groupRect(g);
        out.push(
            `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${mixHex(c, th.canvas, th.sectionMix)}" stroke="${mixHex(c, th.canvas, 30)}"/>`,
        );
        const label = truncate(g.name || "", 40);
        const lw = Math.max(40, label.length * 7 + 24);
        out.push(
            `<rect x="${r.x + 16}" y="${r.y - 11}" width="${lw}" height="22" rx="6" fill="${mixHex(c, th.card, 18)}" stroke="${mixHex(c, th.canvas, 45)}"/>`,
            `<text x="${r.x + 16 + 12}" y="${r.y + 4}" font-size="11.5" font-weight="600" fill="${mixHex(c, th.fg, 60)}">${esc(label)}</text>`,
        );
    }

    // relations (under the tables)
    const layout = layoutRefs(doc);
    for (const r of doc.refs) {
        const g = layout.get(r.id);
        if (!g) continue;
        out.push(
            `<g fill="none" stroke="${th.rel}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">`,
            `<path d="${g.d}"/>`,
            `<path d="${g.a.m}"/><path d="${g.b.m}"/>`,
            g.a.c ? `<path d="${g.a.c}" fill="${th.canvas}"/>` : "",
            g.b.c ? `<path d="${g.b.c}" fill="${th.canvas}"/>` : "",
            `</g>`,
        );
        if (r.label) {
            const w = r.label.length * 6.4 + 14;
            out.push(
                `<rect x="${num(g.lx - w / 2)}" y="${num(g.ly - 9)}" width="${num(w)}" height="18" rx="5" fill="${th.card}" stroke="${th.lineStrong}"/>`,
                `<text x="${num(g.lx)}" y="${num(g.ly + 3.5)}" font-size="10.5" text-anchor="middle" fill="${th.fgSoft}">${esc(r.label)}</text>`,
            );
        }
    }

    // tables
    const fks = fkColumnKeys(doc);
    for (const t of doc.tables) out.push(tableSvg(t, fks, th));

    // notes: pinned (table / section) and free
    for (const n of pinned)
        out.push(
            cardNote(
                n.x,
                n.y,
                n.w,
                n.h,
                n.text,
                DEFAULT_NOTE_COLOR_HEX,
                th,
                true,
            ),
        );
    for (const n of doc.notes ?? []) {
        const r = noteRect(n);
        out.push(
            cardNote(
                r.x,
                r.y,
                r.w,
                r.h,
                n.text,
                n.color ?? DEFAULT_NOTE_COLOR_HEX,
                th,
                false,
            ),
        );
    }

    out.push("</svg>");
    return { svg: out.join("\n") + "\n", width, height };
}

function emptySvg(th, background) {
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160" font-family="${SANS}">` +
        (background
            ? `<rect width="320" height="160" fill="${th.canvas}"/>`
            : "") +
        `<text x="160" y="84" font-size="13" text-anchor="middle" fill="${th.muted}">Empty diagram</text></svg>\n`
    );
}

function tableSvg(t, fks, th) {
    const r = tableRect(t);
    const c = t.color ?? DEFAULT_TABLE_COLOR;
    const out = [`<g>`];
    out.push(
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8" fill="${th.card}" stroke="${th.lineStrong}"/>`,
        // header: rounded top, flat bottom
        `<path d="M${r.x + BORDER} ${r.y + BORDER + HEADER_H}V${r.y + 8}a7 7 0 0 1 7 -7H${r.x + r.w - 8}a7 7 0 0 1 7 7V${r.y + BORDER + HEADER_H}Z" fill="${mixHex(c, th.card, th.headerMix)}"/>`,
        `<circle cx="${r.x + 8 + 5}" cy="${r.y + BORDER + HEADER_H / 2}" r="5" fill="${c}"/>`,
        `<text x="${r.x + 8 + 10 + 7}" y="${r.y + BORDER + HEADER_H / 2 + 4}" font-size="12" font-weight="600" fill="${th.fg}" font-family="${MONO}">${esc(truncate(t.schema ? `${t.schema}.${t.name}` : t.name, Math.floor((r.w - 50) / 7.2)))}</text>`,
    );
    if (t.collapsed) {
        out.push(`</g>`);
        return out.join("");
    }
    const top = r.y + BORDER + HEADER_H + BODY_PAD;
    const indexed = new Set(t.indexes.flatMap((ix) => ix.columns));
    t.columns.forEach((col, i) => {
        const cy = top + i * ROW_H + ROW_H / 2 + 4;
        const key = col.pk ? "PK" : fks.has(`${t.id}.${col.id}`) ? "FK" : "";
        const maxName = Math.floor((r.w - 8 - 18 - 5 - 8) / 6.9);
        if (key)
            out.push(
                `<text x="${r.x + 8}" y="${cy}" font-size="9" font-weight="700" fill="${key === "PK" ? th.pk : th.fk}" font-family="${MONO}">${key}</text>`,
            );
        const flags = [
            col.unique ? "U" : "",
            indexed.has(col.id) ? "I" : "",
            col.increment ? "A" : "",
        ]
            .filter(Boolean)
            .join("");
        const type = `${col.type}${col.notNull || col.pk ? "" : "?"}`;
        const typeW = type.length * 6.3;
        out.push(
            `<text x="${r.x + 8 + 18 + 5}" y="${cy}" font-size="11.5" fill="${th.fg}" font-family="${MONO}">${esc(truncate(col.name, Math.max(4, maxName - Math.ceil(typeW / 6.9) - 2)))}</text>`,
            `<text x="${r.x + r.w - 8}" y="${cy}" font-size="10.5" text-anchor="end" fill="${th.muted}" font-family="${MONO}">${esc(type)}</text>`,
        );
        if (flags)
            out.push(
                `<text x="${r.x + r.w - 8 - typeW - 8}" y="${cy}" font-size="9" text-anchor="end" fill="${th.faint}" font-family="${MONO}">${flags}</text>`,
            );
    });
    out.push(`</g>`);
    return out.join("");
}

function cardNote(x, y, w, h, text, color, th, pinned) {
    const perLine = Math.max(12, Math.floor((w - 24) / 6.2));
    const maxLines = Math.max(1, Math.floor((h - (pinned ? 12 : 22)) / 20));
    const lines = wrapText(text, perLine).slice(0, maxLines);
    const top = pinned ? 0 : 4;
    const out = [
        `<g>`,
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${mixHex(color, th.card, th.noteMix)}" stroke="${mixHex(color, th.canvas, 55)}"/>`,
    ];
    if (!pinned)
        out.push(
            `<path d="M${x} ${y + 4}V${y + 8}a8 8 0 0 1 8 -8H${x + w - 8}a8 8 0 0 1 8 8V${y + 4}Z" fill="${color}"/>`,
        );
    lines.forEach((l, i) =>
        out.push(
            `<text x="${x + 10}" y="${y + top + 18 + i * 20}" font-size="12.5" fill="${th.fg}" xml:space="preserve">${esc(l)}</text>`,
        ),
    );
    out.push(`</g>`);
    return out.join("");
}

const MAX_SIDE = 12000;
const MAX_PIXELS = 50_000_000;

/** Size the PNG will have for an SVG of `w × h` at the wanted scale, limited so the canvas stays valid. */
export function pngSize(w, h, scale = 2) {
    let s = scale;
    s = Math.min(s, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
    s = Math.max(0.1, s);
    return {
        width: Math.max(1, Math.round(w * s)),
        height: Math.max(1, Math.round(h * s)),
        scale: s,
    };
}
