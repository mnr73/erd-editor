import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FEATURE_GROUPS, TIPS } from "@/help/features";
import { SHORTCUT_GROUPS, allCaps } from "@/help/shortcuts";

const read = (f) => readFileSync(f, "utf8");
const loc = (l) => JSON.parse(read(`src/locales/${l}.json`));

const KNOWN_CAPS = new Set([
    "Ctrl",
    "Shift",
    "Alt",
    "Tab",
    "Esc",
    "Del",
    "Enter",
    "Space",
    "F1",
    "F2",
    "?",
    "\\",
    "+",
    "−",
    "…",
    "↑",
    "↓",
    "Click",
    "Double-click",
    "Middle-click",
    "Right-click",
    "Drag",
    "Wheel",
    "+ drag",
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
]);

describe("help content", () => {
    it("only uses key names a reader can find on a keyboard or in the gestures list", () => {
        for (const cap of allCaps())
            expect(KNOWN_CAPS.has(cap), cap).toBe(true);
    });

    it("every shortcut / feature / tip has a text in both languages", () => {
        for (const l of ["en", "fa"]) {
            const h = loc(l).help;
            for (const g of SHORTCUT_GROUPS) {
                expect(h.group[g.id], `${l} group ${g.id}`).toBeTruthy();
                for (const it of g.items)
                    expect(h.s[it.id], `${l} s.${it.id}`).toBeTruthy();
            }
            for (const g of FEATURE_GROUPS) {
                expect(h.about.group[g.id], `${l} group ${g.id}`).toBeTruthy();
                for (const f of g.items) {
                    expect(h.f[f]?.title, `${l} f.${f}.title`).toBeTruthy();
                    expect(h.f[f]?.text, `${l} f.${f}.text`).toBeTruthy();
                }
            }
            for (const tip of TIPS)
                expect(h.tip[tip], `${l} tip ${tip}`).toBeTruthy();
        }
    });

    it("en and fa have exactly the same help keys", () => {
        const flat = (o, p = "") =>
            Object.entries(o).flatMap(([k, v]) =>
                typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`],
            );
        expect(flat(loc("fa").help).sort()).toEqual(
            flat(loc("en").help).sort(),
        );
    });

    it("no shortcut id is listed twice inside one group", () => {
        for (const g of SHORTCUT_GROUPS) {
            const ids = g.items.map((i) => i.id);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });
});

describe("help matches the code (shortcuts that really exist)", () => {
    const canvas = read("src/canvas/EditorCanvas.vue");
    const app = read("src/App.vue");
    const table = read("src/canvas/CanvasTable.vue");
    const editor = read("src/components/ui/UiInlineEdit.vue");

    // [help id, source, regexp that proves the key is handled]
    const proofs = [
        ["select", canvas, /k === "v"/],
        ["pan", canvas, /k === "h"/],
        ["table", canvas, /k === "t"/],
        ["section", canvas, /k === "s"/],
        ["note", canvas, /editor\.setTool\("note"\)/],
        ["relation", canvas, /k === "r"/],
        ["help", canvas, /e\.key === "\?"/],
        ["help", app, /"F1"/],
        ["zoomIn", canvas, /camera\.zoomStep\(1\)/],
        ["zoomOut", canvas, /camera\.zoomStep\(-1\)/],
        ["zoomReset", canvas, /k === "0"/],
        ["fitAll", canvas, /Digit1/],
        ["fitSelection", canvas, /Digit2/],
        ["undo", canvas, /k === "z"/],
        ["redo", canvas, /k === "y"/],
        ["selectAll", canvas, /k === "a"/],
        ["duplicate", canvas, /k === "d"/],
        ["delete", canvas, /k === "delete"/],
        ["rename", canvas, /code === "F2"/],
        ["groupTables", canvas, /k === "g"/],
        ["indexes", canvas, /k === "i"/],
        ["search", app, /k === "k"/],
        ["inspector", app, /k === "\\\\"/],
        ["export", app, /k === "e"/],
        ["import", app, /k === "i" && e\.shiftKey/],
        ["save", app, /k === "s"/],
        ["open", app, /k === "o"/],
        ["new", app, /k === "n"/],
        ["closeTab", app, /k === "w"/],
        ["nextTab", app, /"Tab"/],
        ["gotoTab", app, /\[1-9\]/],
        ["colReorder", table, /e\.altKey && \(e\.key === "ArrowUp"/],
        ["colMove", table, /stepColumn/],
        ["colExtend", table, /shift: e\.shiftKey/],
        ["colPick", table, /ctrl: e\.ctrlKey/],
        ["colDelete", table, /"Delete"/],
        ["colRename", table, /"F2"/],
        ["colClear", table, /"Escape"/],
        ["colTab", editor, /"Tab"/],
    ];
    for (const [id, src, re] of proofs)
        it(`“${id}” is handled in the code`, () =>
            expect(re.test(src), `${id}: ${re}`).toBe(true));

    it("the shortcut list covers each of those ids", () => {
        const listed = new Set(
            SHORTCUT_GROUPS.flatMap((g) => g.items.map((i) => i.id)),
        );
        for (const [id] of proofs) expect(listed.has(id), id).toBe(true);
    });

    it("Enter does not rename a table (so the help must not claim it)", () => {
        const rename = SHORTCUT_GROUPS.flatMap((g) => g.items).find(
            (i) => i.id === "rename",
        );
        expect(rename.keys.flat()).not.toContain("Enter");
    });
});

describe("inline key markers in tips", () => {
    it("every [[..]] is closed and the same keys appear in both languages", () => {
        const en = loc("en").help.tip;
        const fa = loc("fa").help.tip;
        const keys = (s) =>
            [...s.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
        for (const id of TIPS) {
            expect(en[id].split("[[").length).toBe(en[id].split("]]").length);
            expect(fa[id].split("[[").length).toBe(fa[id].split("]]").length);
            expect(keys(fa[id]), id).toEqual(keys(en[id]));
        }
    });
});
