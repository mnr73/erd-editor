import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildSampleDocument } from "@/model/sample";
import { serializeErd } from "@/model/serialize";
import { parseErd } from "@/model/validate";

const root = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(root + p, "utf8");
const dir = mkdtempSync(join(tmpdir(), "erd-skill-"));

/** Run the standalone checker on a document (object) and return { code, out }. */
function check(doc) {
    const f = join(dir, `${Math.random().toString(36).slice(2)}.erd.json`);
    writeFileSync(f, typeof doc === "string" ? doc : JSON.stringify(doc));
    const r = spawnSync("node", [root + "scripts/check-erd.mjs", f], {
        encoding: "utf8",
    });
    return { code: r.status, out: r.stdout + r.stderr };
}

const shop = () => JSON.parse(read("tests/fixtures/shop.erd.json"));

describe("scripts/check-erd.mjs agrees with the app", () => {
    it("accepts the fixtures, the site example and the app's own sample board", () => {
        for (const f of [
            "tests/fixtures/shop.erd.json",
            "site/example.erd.json",
        ])
            expect(check(read(f)).code, f).toBe(0);
        const sample = serializeErd(buildSampleDocument((k) => k));
        expect(check(sample).code).toBe(0);
    });

    it("rejects what the app rejects (fatal)", () => {
        for (const bad of [
            "not json",
            "[]",
            { format: "other", version: 1 },
            { format: "erd-editor", version: "x" },
            { format: "erd-editor", version: 99 },
            { format: "erd-editor", version: 1, tables: 5 },
        ]) {
            const txt = typeof bad === "string" ? bad : JSON.stringify(bad);
            const app = parseErd(txt);
            expect(app.doc, txt).toBeNull();
            expect(check(txt).code, txt).not.toBe(0);
        }
    });

    it("finds duplicate ids and dangling references (the app warns or refuses)", () => {
        const dup = shop();
        dup.tables[1].id = dup.tables[0].id;
        expect(check(dup).out).toMatch(/duplicate id/);

        const ref = shop();
        ref.refs[0].from.table = "orders"; // a name instead of an id
        expect(check(ref).out).toMatch(/is not a table id/);
        expect(
            parseErd(JSON.stringify(ref)).issues.map((i) => i.code),
        ).toContain("ref-table-missing");

        const col = shop();
        col.refs[0].to.columns = ["c_nope"];
        expect(check(col).out).toMatch(/is not a column of table/);

        const idx = shop();
        idx.tables[0].indexes[0].columns = ["email"]; // name instead of id
        expect(check(idx).out).toMatch(/column ids, not names/);
    });

    it("finds bad cardinality, action, colour, length mismatch and duplicate names", () => {
        const a = shop();
        a.refs[0].from.cardinality = "many";
        expect(check(a).out).toMatch(/cardinality/);
        const b = shop();
        b.refs[0].onDelete = "explode";
        expect(check(b).out).toMatch(/onDelete/);
        const c = shop();
        c.tables[0].color = "blue";
        expect(check(c).out).toMatch(/#RRGGBB/);
        const d = shop();
        d.refs[0].to.columns = [
            ...d.refs[0].to.columns,
            d.refs[0].to.columns[0],
        ];
        expect(check(d).out).toMatch(/same length/);
        const e = shop();
        e.tables[0].columns.push({
            ...e.tables[0].columns[0],
            id: "c_dupname",
        });
        expect(check(e).out).toMatch(/two columns are named/);
    });
});

describe("skills/erd-editor/SKILL.md", () => {
    const md = read("skills/erd-editor/SKILL.md");

    it("has the front matter an agent loader needs", () => {
        const m = md.match(/^---\nname: (.+)\ndescription: (.+)\n---\n/);
        expect(m, "front matter").not.toBeNull();
        expect(m[1]).toBe("erd-editor");
        expect(m[2].length).toBeGreaterThan(40);
        expect(m[2].length).toBeLessThan(400);
    });

    it("every JSON example in it is valid JSON, and the full ones pass the checker", () => {
        const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map(
            (x) => x[1],
        );
        expect(blocks.length).toBeGreaterThanOrEqual(4);
        for (const b of blocks) expect(() => JSON.parse(b), b).not.toThrow();
        const full = blocks.filter((b) => b.includes('"format"'));
        expect(full.length).toBeGreaterThanOrEqual(1);
        for (const b of full) expect(check(b).code, b).toBe(0);
    });

    it("the recipes work when applied to a real document", () => {
        // add table + FK + index exactly as the skill describes, then validate with the app
        const doc = shop();
        const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map((x) =>
            JSON.parse(x[1]),
        );
        const table = blocks.find((b) => b.id === "t_invoices");
        const ref = blocks.find((b) => b.id === "r_orders_user");
        const idx = blocks.find((b) => b.id === "i_orders_status_user");
        expect(table && ref && idx).toBeTruthy();
        doc.tables.push(table);
        expect(check(doc).code).toBe(0);
        expect(parseErd(JSON.stringify(doc)).issues).toEqual([]);
        // the FK recipe: the ref in the skill points at ids that exist only after adding the column
        const fk = shop();
        fk.tables = fk.tables.filter(
            (t) => !["t_users", "t_orders"].includes(t.id),
        );
        fk.refs = [];
        fk.tables.push(
            {
                id: "t_users",
                name: "users",
                columns: [
                    { id: "c_users_id", name: "id", type: "bigint", pk: true },
                ],
            },
            {
                id: "t_orders",
                name: "orders",
                columns: [
                    { id: "c_orders_id", name: "id", type: "bigint", pk: true },
                    {
                        id: "c_orders_user",
                        name: "user_id",
                        type: "bigint",
                        notNull: true,
                    },
                    {
                        id: "c_orders_status",
                        name: "status",
                        type: "varchar(20)",
                    },
                ],
                indexes: [idx],
            },
        );
        fk.refs.push(ref);
        expect(check(fk).code).toBe(0);
        const { doc: loaded, issues } = parseErd(JSON.stringify(fk));
        expect(issues).toEqual([]);
        expect(loaded.refs[0].onDelete).toBe("cascade");
    });

    it("everything it says exists in the repository", () => {
        for (const f of [
            "docs/FORMAT.md",
            "schema/erd.schema.json",
            "scripts/check-erd.mjs",
        ])
            expect(md, f).toContain(f);
        expect(() => read("scripts/check-erd.mjs")).not.toThrow();
    });

    it("the id prefixes and constants it lists match the code", async () => {
        const { ID_PREFIX } = await import("@/model/ids");
        for (const [kind, p] of Object.entries(ID_PREFIX))
            expect(md, kind).toContain(`\`${p}_\``);
        const c = await import("@/model/constants");
        for (const v of [...c.CARDINALITIES, ...c.REF_ACTIONS, ...c.DB_TYPES])
            expect(md, v).toContain(v);
        expect(md).toContain(`"version": ${c.VERSION}`);
    });
});
