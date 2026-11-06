import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
    createColumn,
    createDocument,
    createGroup,
    createNote,
    createRef,
    createRefEnd,
    createTable,
} from "@/model/document";
import { toAgentMarkdown } from "@/model/export/agent";
import { defaultKind } from "@/model/export/common";
import { toDbml } from "@/model/export/dbml";
import { toSql } from "@/model/export/sql";
import { toSvg, wrapText } from "@/model/export/svg";
import { mixHex } from "@/model/export/theme";
import { parseErd } from "@/model/validate";

const shop = () =>
    parseErd(readFileSync("tests/fixtures/shop.erd.json", "utf8")).doc;
const sample = () =>
    parseErd(readFileSync("src/dev/sample.erd.json", "utf8")).doc;

function rich() {
    const doc = createDocument("rich");
    doc.meta.dbType = "postgres";
    const a = createTable({
        id: "t_a",
        name: "accounts",
        schema: "app",
        note: "Who pays",
        columns: [
            createColumn({
                id: "a_id",
                name: "id",
                type: "bigint",
                pk: true,
                increment: true,
                notNull: true,
            }),
            createColumn({ id: "a_tags", name: "tags", type: "text[]" }),
            createColumn({
                id: "a_kind",
                name: "kind",
                type: "enum('free','paid')",
                default: "'free'",
            }),
            createColumn({
                id: "a_n",
                name: "n",
                type: "int unsigned",
                default: "0",
            }),
            createColumn({
                id: "a_at",
                name: "created",
                type: "timestamp",
                default: "now()",
                note: "it's UTC",
            }),
        ],
        indexes: [
            {
                id: "i1",
                name: "",
                columns: ["a_kind", "a_n"],
                unique: true,
                type: "hash",
            },
        ],
    });
    const b = createTable({
        id: "t_b",
        name: "orders",
        columns: [
            createColumn({
                id: "b_id",
                name: "id",
                type: "int",
                pk: true,
                notNull: true,
            }),
            createColumn({
                id: "b_a",
                name: "account_id",
                type: "bigint",
                notNull: true,
            }),
        ],
    });
    doc.tables.push(a, b);
    doc.refs.push(
        createRef({
            id: "r1",
            label: "owns",
            from: createRefEnd({
                table: "t_b",
                columns: ["b_a"],
                cardinality: "0..*",
            }),
            to: createRefEnd({
                table: "t_a",
                columns: ["a_id"],
                cardinality: "1",
            }),
            onDelete: "cascade",
        }),
        createRef({
            id: "r_nm",
            from: createRefEnd({
                table: "t_a",
                columns: ["a_id"],
                cardinality: "0..*",
            }),
            to: createRefEnd({
                table: "t_b",
                columns: ["b_id"],
                cardinality: "0..*",
            }),
        }),
        createRef({
            id: "r_bad",
            from: createRefEnd({
                table: "t_a",
                columns: ["nope"],
                cardinality: "0..*",
            }),
            to: createRefEnd({
                table: "t_b",
                columns: ["b_id"],
                cardinality: "1",
            }),
        }),
    );
    doc.groups.push(
        createGroup({
            id: "g1",
            name: "Billing",
            color: "#E8B54A",
            x: -20,
            y: -20,
            w: 2000,
            h: 2000,
            note: "money",
        }),
    );
    doc.notes.push(
        createNote({
            id: "n1",
            text: "TODO: split\nlater",
            color: "#4CB86B",
            x: 3000,
            y: 0,
        }),
    );
    return doc;
}

describe("defaultKind", () => {
    it("classifies what the user typed", () => {
        expect(defaultKind("")).toBe("none");
        expect(defaultKind("0")).toBe("number");
        expect(defaultKind("-1.5")).toBe("number");
        expect(defaultKind("'x'")).toBe("string");
        expect(defaultKind("NULL")).toBe("keyword");
        expect(defaultKind("now()")).toBe("expr");
        expect(defaultKind("CURRENT_TIMESTAMP")).toBe("expr");
        expect(defaultKind("uuid_generate_v4()")).toBe("expr");
        expect(defaultKind("draft")).toBe("bare");
    });
});

describe("DBML export", () => {
    const out = toDbml(rich());

    it("writes tables with settings, schema, enums as types and notes", () => {
        expect(out.text).toContain("Table app.accounts {");
        expect(out.text).toContain("id bigint [pk, increment]");
        expect(out.text).toContain("tags text[]");
        expect(out.text).toContain("Note: 'Who pays'");
        expect(out.text).toContain("note: 'it\\'s UTC'");
        expect(out.text).toContain("default: `now()`");
        expect(out.text).toContain("default: 'free'");
        expect(out.text).toContain("database_type: 'PostgreSQL'");
    });

    it("writes composite indexes, refs with actions, sections and free notes", () => {
        expect(out.text).toMatch(/\(kind, n\) \[unique, type: hash\]/);
        expect(out.text).toContain(
            "Ref owns: orders.account_id > app.accounts.id [delete: cascade]",
        );
        expect(out.text).toContain("TableGroup Billing [color: #E8B54A]");
        expect(out.text).toContain("Note note_1");
        expect(out.text).toContain("'''\nTODO: split\nlater\n'''");
    });

    it("skips what DBML cannot say and reports it", () => {
        expect(out.warnings.map((w) => w.code).sort()).toEqual([
            "ref-many-to-many",
            "ref-skipped",
        ]);
        expect(out.text).not.toContain("nope");
    });

    it("quotes odd names", () => {
        const d = createDocument();
        d.tables.push(
            createTable({
                id: "t",
                name: "order items",
                columns: [
                    createColumn({
                        id: "c",
                        name: "user-id",
                        type: "weird type",
                    }),
                ],
            }),
        );
        expect(toDbml(d).text).toContain('Table "order items" {');
        expect(toDbml(d).text).toContain('"user-id" "weird type"');
    });
});

describe("SQL export", () => {
    const doc = rich();

    it("MySQL: backticks, AUTO_INCREMENT, ENUM, comments, USING", () => {
        const { sql } = toSql(doc, "mysql");
        expect(sql).toContain("CREATE TABLE `app`.`accounts`");
        expect(sql).toContain("AUTO_INCREMENT");
        expect(sql).toContain("`kind` enum('free','paid')");
        expect(sql).toContain(
            "`n` int unsigned NOT NULL".replace(" NOT NULL", ""),
        );
        expect(sql).toContain("COMMENT 'it''s UTC'");
        expect(sql).toContain("COMMENT='Who pays'");
        expect(sql).toContain("USING HASH");
    });

    it("PostgreSQL: identity, array, enum as CHECK, unsigned dropped, COMMENT ON, schema", () => {
        const { sql, warnings } = toSql(doc, "postgres");
        expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "app";');
        expect(sql).toContain("GENERATED BY DEFAULT AS IDENTITY");
        expect(sql).toContain('"tags" text[]');
        expect(sql).toMatch(
            /"kind" varchar\(4\) DEFAULT 'free' CHECK \("kind" IN \('free', 'paid'\)\)/,
        );
        expect(sql).not.toMatch(/unsigned/i);
        expect(sql).toContain(
            'COMMENT ON TABLE "app"."accounts" IS \'Who pays\';',
        );
        expect(sql).toContain('USING hash ("kind", "n")');
        const codes = warnings.map((w) => w.code);
        expect(codes).toContain("enum-as-check");
        expect(codes).toContain("unsigned-dropped");
        expect(codes).toContain("ref-many-to-many");
    });

    it("SQL Server and SQLite spell things their way", () => {
        const ms = toSql(doc, "mssql").sql;
        expect(ms).toContain("IDENTITY(1,1)");
        expect(ms).toContain("[accounts]");
        expect(ms).toContain("nvarchar(4)");
        expect(ms).toContain("datetime2");
        const lite = toSql(doc, "sqlite");
        expect(lite.sql).toContain(
            "INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT",
        );
        expect(lite.sql).toContain('FOREIGN KEY ("account_id") REFERENCES');
        expect(lite.sql).not.toContain("ALTER TABLE");
    });

    it("arrays on MySQL become json with a warning", () => {
        const r = toSql(doc, "mysql");
        expect(r.sql).toContain("`tags` json");
        expect(r.warnings.map((w) => w.code)).toContain("array-unsupported");
    });

    it("unknown dialect falls back to generic; every dialect ends with a newline", () => {
        expect(toSql(doc, "oracle").sql).toContain('"accounts"');
        for (const d of ["generic", "mysql", "postgres", "sqlite", "mssql"])
            expect(toSql(doc, d).sql.endsWith(";\n")).toBe(true);
    });

    it("composite primary key, string escaping, empty doc", () => {
        const d = createDocument("x");
        d.tables.push(
            createTable({
                id: "t",
                name: "t",
                columns: [
                    createColumn({ id: "a", name: "a", type: "int", pk: true }),
                    createColumn({
                        id: "b",
                        name: "b",
                        type: "int",
                        pk: true,
                        default: "draft",
                    }),
                ],
            }),
        );
        expect(toSql(d, "generic").sql).toContain('PRIMARY KEY ("a", "b")');
        expect(toSql(d, "generic").sql).toContain("DEFAULT 'draft'");
        expect(toSql(createDocument(), "mysql").sql).toContain(
            "-- generated by ERD Editor",
        );
    });
});

describe("agent Markdown", () => {
    const { text } = toAgentMarkdown(rich());

    it("starts with a guide, then the model, with every note", () => {
        expect(text.startsWith("# rich")).toBe(true);
        expect(text.indexOf("## How to read this")).toBeLessThan(
            text.indexOf("## Tables"),
        );
        expect(text).toContain("> Who pays");
        expect(text).toContain("it's UTC");
        expect(text).toContain("> TODO: split\n> later");
        expect(text).toContain("### Billing");
        expect(text).toContain("> money");
    });

    it("describes columns, indexes and relationships", () => {
        expect(text).toMatch(
            /\| `id` \| `bigint` \| PK, FK, NOT NULL, AUTO \|/,
        );
        expect(text).toContain("`accounts_kind_n_uq` (kind, n) UNIQUE hash");
        expect(text).toContain(
            "`orders.account_id` → `accounts.id` — N:1 (0..* → 1), ON DELETE cascade — owns",
        );
    });

    it("lists open points instead of hiding problems", () => {
        expect(text).toContain("## Open points");
        expect(text).toContain("Many-to-many between `accounts` and `orders`");
        expect(text).toContain("points at a missing table or column");
    });

    it("the guide can be left out", () => {
        expect(toAgentMarkdown(rich(), { guide: false }).text).not.toContain(
            "How to read this",
        );
    });
});

describe("SVG export", () => {
    it("is a standalone document of the right size with tables, lines and notes", () => {
        const { svg, width, height } = toSvg(sample(), { theme: "dark" });
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(
            true,
        );
        expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
        expect(svg).toContain(`width="${width}" height="${height}"`);
        expect(svg).not.toMatch(/var\(--|<script|href=/);
        expect((svg.match(/<path d="M/g) ?? []).length).toBeGreaterThan(10);
        expect(svg).toContain("order_items");
    });

    it("escapes text and survives an empty diagram", () => {
        const d = createDocument();
        d.tables.push(createTable({ id: "t", name: 'a<b>&"c', columns: [] }));
        expect(toSvg(d).svg).toContain("a&lt;b&gt;&amp;&quot;c");
        expect(toSvg(createDocument()).svg).toContain("Empty diagram");
    });

    it("light and dark use different colors; background can be dropped", () => {
        const dark = toSvg(sample(), { theme: "dark" }).svg;
        const light = toSvg(sample(), { theme: "light" }).svg;
        expect(dark).toContain("#0d1015");
        expect(light).toContain("#f6f7f9");
        const withBg = toSvg(sample(), { theme: "dark" });
        const noBg = toSvg(sample(), { theme: "dark", background: false });
        const bg = `height="${withBg.height}" fill="#0d1015"/>`;
        expect(withBg.svg).toContain(bg);
        expect(noBg.svg).not.toContain(bg);
    });

    it("free notes and pinned notes are drawn with their text", () => {
        const { svg } = toSvg(rich());
        expect(svg).toContain("TODO: split");
        expect(svg).toContain("#4CB86B");
    });

    it("wrapText wraps words and long tokens", () => {
        expect(wrapText("aaa bbb ccc", 7)).toEqual(["aaa bbb", "ccc"]);
        expect(wrapText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
        expect(wrapText("a\n\nb", 10)).toEqual(["a", "", "b"]);
    });

    it("mixHex matches CSS color-mix in sRGB", () => {
        expect(mixHex("#ffffff", "#000000", 50)).toBe("#808080");
        expect(mixHex("#4C8DFF", "#151920", 0)).toBe("#151920");
        expect(mixHex("#4C8DFF", "#151920", 100)).toBe("#4c8dff");
    });
});

describe("exporters never throw on odd documents", () => {
    it("shop and sample go through everything", () => {
        for (const doc of [shop(), sample(), createDocument()]) {
            expect(() => toDbml(doc)).not.toThrow();
            expect(() => toAgentMarkdown(doc)).not.toThrow();
            expect(() => toSvg(doc)).not.toThrow();
            for (const d of ["generic", "mysql", "postgres", "sqlite", "mssql"])
                expect(() => toSql(doc, d)).not.toThrow();
        }
    });
});

describe("subsetDocument (export selection)", () => {
    const doc = () => {
        const d = createDocument("s");
        const col = (id) => createColumn({ id, name: id, type: "int" });
        d.tables.push(
            createTable({
                id: "a",
                name: "a",
                x: 0,
                y: 0,
                columns: [col("a1")],
            }),
            createTable({
                id: "b",
                name: "b",
                x: 100,
                y: 0,
                columns: [col("b1")],
            }),
            createTable({
                id: "c",
                name: "c",
                x: 5000,
                y: 0,
                columns: [col("c1")],
            }),
        );
        const ref = (id, f, t) =>
            createRef({
                id,
                from: createRefEnd({
                    table: f,
                    columns: [`${f}1`],
                    cardinality: "0..*",
                }),
                to: createRefEnd({
                    table: t,
                    columns: [`${t}1`],
                    cardinality: "1",
                }),
            });
        d.refs.push(
            ref("ab", "a", "b"),
            ref("bc", "b", "c"),
            ref("ca", "c", "a"),
        );
        d.groups.push(
            createGroup({ id: "g", name: "G", x: -50, y: -50, w: 600, h: 400 }),
        );
        d.notes.push(
            createNote({
                id: "n_in",
                x: 10,
                y: 200,
                w: 100,
                h: 80,
                text: "inside",
            }),
            createNote({ id: "n_out", x: 9000, y: 0, text: "outside" }),
        );
        return d;
    };

    it("selected tables and the lines between them; lines to the rest are counted", async () => {
        const { subsetDocument } = await import("@/model/export/subset");
        const r = subsetDocument(doc(), ["a", "b"]);
        expect(r.doc.tables.map((t) => t.id)).toEqual(["a", "b"]);
        expect(r.doc.refs.map((x) => x.id)).toEqual(["ab"]);
        expect(r.cut).toBe(2);
        expect(r.counts).toMatchObject({
            tables: 2,
            refs: 1,
            groups: 0,
            notes: 0,
        });
    });

    it("a section brings what is completely inside it, nothing else", async () => {
        const { subsetDocument } = await import("@/model/export/subset");
        const r = subsetDocument(doc(), ["g"]);
        expect(r.doc.tables.map((t) => t.id)).toEqual(["a", "b"]);
        expect(r.doc.groups.map((g) => g.id)).toEqual(["g"]);
        expect(r.doc.notes.map((n) => n.id)).toEqual(["n_in"]);
    });

    it("a free note alone, and an empty selection", async () => {
        const { subsetDocument } = await import("@/model/export/subset");
        expect(
            subsetDocument(doc(), ["n_out"]).doc.notes.map((n) => n.id),
        ).toEqual(["n_out"]);
        const none = subsetDocument(doc(), []);
        expect(none.counts).toEqual({
            tables: 0,
            refs: 0,
            groups: 0,
            notes: 0,
        });
        expect(subsetDocument(doc(), ["nope"]).doc.tables).toEqual([]);
    });

    it("does not change the original and every exporter accepts the subset", async () => {
        const { subsetDocument } = await import("@/model/export/subset");
        const d = doc();
        const before = JSON.stringify(d);
        const r = subsetDocument(d, ["a", "b"]);
        expect(JSON.stringify(d)).toBe(before);
        expect(toSql(r.doc, "mysql").sql).not.toContain("`c`");
        expect(toDbml(r.doc).text).not.toContain("Table c");
        const svg = toSvg(r.doc);
        expect(svg.svg).not.toContain(">c<");
        expect(svg.width).toBeLessThan(1500); // only a and b: 5000 away is not in the picture
        expect(toAgentMarkdown(r.doc).text).not.toContain("### c");
    });
});
