import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { pngSize } from "@/model/export/svg";

const locale = (l) => JSON.parse(readFileSync(`src/locales/${l}.json`, "utf8"));
const read = (f) => readFileSync(f, "utf8");

/** Every `code: "x"` / `warn("x"` the exporters and the importer can produce. */
function codes(file, pattern) {
    return [...read(file).matchAll(pattern)].map((m) => m[1]);
}

describe("every warning has a text in both languages", () => {
    const exportCodes = new Set([
        ...codes("src/model/export/sql.js", /warn\(\s*"([a-z-]+)"/g),
        ...codes("src/model/export/common.js", /code: "([a-z-]+)"/g),
    ]);
    const importCodes = new Set([
        ...codes("src/model/import/sql.js", /warn\(\s*"([a-z-]+)"/g),
        ...codes("src/model/import/sql.js", /code: "([a-z-]+)"/g),
    ]);

    it("found the codes (the patterns above still match the source)", () => {
        expect(exportCodes.size).toBeGreaterThanOrEqual(5);
        expect(importCodes.size).toBeGreaterThanOrEqual(10);
    });

    for (const l of ["en", "fa"]) {
        it(`${l}: export.warn.* and import.warn.* cover every code`, () => {
            const j = locale(l);
            for (const c of exportCodes)
                expect(j.export.warn[c], `export ${c}`).toBeTruthy();
            for (const c of importCodes)
                expect(j.import.warn[c], `import ${c}`).toBeTruthy();
        });
    }

    it("en and fa have the same export / import keys", () => {
        const flat = (o, p = "") =>
            Object.entries(o).flatMap(([k, v]) =>
                typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`],
            );
        for (const part of ["export", "import"])
            expect(flat(locale("fa")[part]).sort()).toEqual(
                flat(locale("en")[part]).sort(),
            );
    });
});

describe("pngSize", () => {
    it("scales normally", () => {
        expect(pngSize(1000, 500, 2)).toMatchObject({
            width: 2000,
            height: 1000,
        });
    });
    it("never exceeds the canvas limits", () => {
        const big = pngSize(20000, 10000, 3);
        expect(Math.max(big.width, big.height)).toBeLessThanOrEqual(12000);
        expect(big.width * big.height).toBeLessThanOrEqual(50_000_000);
        const huge = pngSize(10000, 10000, 3);
        expect(huge.width * huge.height).toBeLessThanOrEqual(50_000_000);
    });
    it("keeps the aspect ratio and at least one pixel", () => {
        const s = pngSize(30000, 100, 3);
        expect(s.width / s.height).toBeCloseTo(300, 0);
        expect(pngSize(1, 1, 0.01).width).toBeGreaterThanOrEqual(1);
    });
});
