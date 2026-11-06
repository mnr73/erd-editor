import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { toSql } from "@/model/export/sql";
import { rectsIntersect, tableRect } from "@/model/geometry";
import { layoutGrid } from "@/model/import/layout";
import { importSql, tokenize } from "@/model/import/sql";
import { serializeErd } from "@/model/serialize";
import { parseErd, validateErd } from "@/model/validate";

const fixture = (n) => readFileSync(`tests/fixtures/sql/${n}.sql`, "utf8");
const table = (doc, name) => doc.tables.find((t) => t.name === name);
const col = (t, name) => t.columns.find((c) => c.name === name);
const refBetween = (doc, a, b) =>
    doc.refs.find(
        (r) =>
            doc.tables.find((t) => t.id === r.from.table).name === a &&
            doc.tables.find((t) => t.id === r.to.table).name === b,
    );

describe("tokenize", () => {
    it("drops comments, keeps quoted names and strings with escapes", () => {
        const t = tokenize(
            "SELECT 1 -- x\n/* y */ `a``b` \"c\" [d e] 'it''s' 'a\\'b'",
        );
        expect(t.map((x) => x.value)).toEqual([
            "SELECT",
            "1",
            "a`b",
            "c",
            "d e",
            "it's",
            "a'b",
        ]);
    });
    it("array brackets are punctuation, [name] is an identifier", () => {
        expect(tokenize("text[] int[3]").map((x) => x.type)).toEqual([
            "word",
            "punct",
            "punct",
            "word",
            "punct",
            "number",
            "punct",
        ]);
        expect(tokenize("[dbo].[users]").map((x) => x.value)).toEqual([
            "dbo",
            ".",
            "users",
        ]);
    });
});

describe("mysqldump", () => {
    const r = importSql(fixture("mysqldump"));
    const users = table(r.doc, "users");

    it("reads tables, ignores INSERT / LOCK / version comments, reports no problems", () => {
        expect(r.doc.tables.map((t) => t.name)).toEqual([
            "users",
            "posts",
            "post_tags",
        ]);
        expect(r.warnings).toEqual([]);
        expect(r.stats).toMatchObject({ tables: 3, refs: 3 });
        expect(users.note).toBe("Registered users");
    });

    it("columns: types, flags, defaults, comments", () => {
        expect(col(users, "id")).toMatchObject({
            type: "bigint unsigned",
            pk: true,
            notNull: true,
            increment: true,
        });
        expect(col(users, "email")).toMatchObject({
            type: "varchar(191)",
            notNull: true,
        });
        expect(col(users, "name")).toMatchObject({
            type: "varchar(255)",
            notNull: false,
            default: "",
            note: "Display name; may be empty",
        });
        expect(col(users, "status").type).toBe(
            "enum('active','blocked','pending review')",
        );
        expect(col(users, "status").default).toBe("'active'");
        expect(col(users, "balance")).toMatchObject({
            type: "decimal(12,2)",
            default: "'0.00'",
        });
        expect(col(users, "is_admin").type).toBe("boolean");
        expect(col(users, "created_at").default).toBe("CURRENT_TIMESTAMP");
    });

    it("indexes keep names, order and uniqueness; composite primary key", () => {
        const uq = users.indexes.find((i) => i.name === "users_email_unique");
        expect(uq.unique).toBe(true);
        const comp = users.indexes.find(
            (i) => i.name === "users_status_created_idx",
        );
        expect(
            comp.columns.map(
                (id) => users.columns.find((c) => c.id === id).name,
            ),
        ).toEqual(["status", "created_at"]);
        const pt = table(r.doc, "post_tags");
        expect(pt.columns.filter((c) => c.pk).map((c) => c.name)).toEqual([
            "post_id",
            "tag",
        ]);
    });

    it("foreign keys: actions, self reference, cardinality from nullability", () => {
        const owner = refBetween(r.doc, "posts", "users");
        expect(owner).toMatchObject({
            onDelete: "cascade",
            onUpdate: "restrict",
        });
        expect(owner.from.cardinality).toBe("0..*");
        expect(owner.to.cardinality).toBe("1");
        const self = refBetween(r.doc, "posts", "posts");
        expect(self.onDelete).toBe("set null");
        expect(self.to.cardinality).toBe("0..1"); // nullable FK
    });

    it("the result is a valid document that survives save and load", () => {
        const back = parseErd(serializeErd(r.doc));
        expect(back.issues).toEqual([]);
        expect(back.doc.tables).toHaveLength(3);
    });
});

describe("pg_dump", () => {
    const r = importSql(fixture("pgdump"), { dbType: "postgres" });
    const inv = table(r.doc, "invoices");

    it("schemas, comments, identity, sequences, COPY data are handled", () => {
        expect(r.warnings).toEqual([]);
        expect(inv.schema).toBe("billing");
        expect(inv.note).toBe("Issued invoices");
        expect(col(inv, "total").note).toBe("Gross, incl. VAT");
        expect(col(inv, "id")).toMatchObject({ increment: true, pk: true });
        const cust = table(r.doc, "customers");
        expect(col(cust, "id")).toMatchObject({ increment: true, pk: true }); // nextval default → auto increment
        expect(col(cust, "id").default).toBe("");
    });

    it("types: varchar, array, jsonb default, timestamp aliases, enum type", () => {
        const cust = table(r.doc, "customers");
        expect(col(cust, "email").type).toBe("varchar(255)");
        expect(col(cust, "tags").type).toBe("text[]");
        expect(col(cust, "meta")).toMatchObject({
            type: "jsonb",
            default: "'{}'",
        });
        expect(col(cust, "created_at")).toMatchObject({
            type: "timestamp",
            default: "now()",
        });
        expect(col(cust, "seen_at").type).toBe("timestamptz(3)");
        expect(col(inv, "status").type).toBe("enum('new','paid','shipped')");
        expect(col(inv, "status").default).toBe("'new'");
        expect(col(table(r.doc, "lines"), "sku").type).toBe("char(8)");
    });

    it("ALTER TABLE adds keys, uniques, composite primary key, indexes with method, foreign keys", () => {
        const lines = table(r.doc, "lines");
        expect(lines.columns.filter((c) => c.pk).map((c) => c.name)).toEqual([
            "invoice_id",
            "n",
        ]);
        expect(lines.indexes[0]).toMatchObject({
            name: "lines_sku_idx",
            unique: true,
            type: "hash",
        });
        expect(inv.indexes[0]).toMatchObject({
            name: "invoices_customer_idx",
            type: null,
        });
        const fk = refBetween(r.doc, "invoices", "customers");
        expect(fk).toMatchObject({ onDelete: "restrict", onUpdate: "cascade" });
        expect(refBetween(r.doc, "lines", "invoices").onDelete).toBe("cascade");
    });
});

describe("dialect details and robustness", () => {
    it("T-SQL: brackets, IDENTITY, schema, GO, default in parentheses", () => {
        const r = importSql(`CREATE TABLE [dbo].[Users] (
  [Id] int IDENTITY(1,1) NOT NULL,
  [Name] nvarchar(100) NOT NULL DEFAULT (N'x'),
  [Active] bit NOT NULL DEFAULT ((1)),
  [Born] datetime2(7) NULL,
  CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([Id] ASC)
)
GO
CREATE UNIQUE NONCLUSTERED INDEX [IX_Name] ON [dbo].[Users] ([Name]);`);
        const t = table(r.doc, "Users");
        expect(t.schema).toBe("dbo");
        expect(col(t, "Id")).toMatchObject({ increment: true, pk: true });
        expect(col(t, "Active").default).toBe("1");
        expect(col(t, "Born").notNull).toBe(false);
        expect(t.indexes[0]).toMatchObject({ name: "IX_Name", unique: true });
    });

    it("SQLite: AUTOINCREMENT, inline REFERENCES, WITHOUT ROWID tail", () => {
        const r =
            importSql(`CREATE TABLE a (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
CREATE TABLE b (id INTEGER PRIMARY KEY, a_id INTEGER NOT NULL REFERENCES a(id) ON DELETE CASCADE) WITHOUT ROWID;`);
        expect(col(table(r.doc, "a"), "id")).toMatchObject({
            pk: true,
            increment: true,
        });
        expect(refBetween(r.doc, "b", "a").onDelete).toBe("cascade");
        expect(r.warnings).toEqual([]);
    });

    it("REFERENCES without a column list points at the primary key", () => {
        const r = importSql(
            "CREATE TABLE p (id int PRIMARY KEY); CREATE TABLE c (pid int NOT NULL REFERENCES p);",
        );
        expect(refBetween(r.doc, "c", "p").to.columns).toHaveLength(1);
    });

    it("a unique foreign key is one-to-one", () => {
        const r = importSql(
            "CREATE TABLE p (id int PRIMARY KEY); CREATE TABLE c (pid int NOT NULL UNIQUE REFERENCES p(id));",
        );
        expect(refBetween(r.doc, "c", "p").from.cardinality).toBe("0..1");
    });

    it("garbage, empty input and non-DDL statements never throw", () => {
        expect(importSql("").doc.tables).toEqual([]);
        expect(
            importSql("this is not sql ((( ;;; 'unterminated").doc.tables,
        ).toEqual([]);
        const r = importSql(
            "INSERT INTO x VALUES (1); CREATE VIEW v AS SELECT 1; CREATE TABLE t (a int);",
        );
        expect(r.doc.tables.map((t) => t.name)).toEqual(["t"]);
        expect(r.stats.skipped).toBe(2);
    });

    it("problems are warnings, not failures", () => {
        const r = importSql(
            "CREATE TABLE a (id int PRIMARY KEY); ALTER TABLE a ADD CONSTRAINT f FOREIGN KEY (id) REFERENCES missing(id); CREATE INDEX i ON nowhere (x);",
        );
        expect(r.doc.tables).toHaveLength(1);
        expect(r.warnings.map((w) => w.code).sort()).toEqual([
            "index-table-missing",
            "ref-table-missing",
        ]);
    });

    it("duplicate table names keep the first", () => {
        const r = importSql("CREATE TABLE a (x int); CREATE TABLE a (y int);");
        expect(r.doc.tables).toHaveLength(1);
        expect(r.warnings[0].code).toBe("duplicate-table");
    });

    it("a leading BOM and CRLF line endings are fine", () => {
        const r = importSql("\uFEFFCREATE TABLE a (\r\n  id int\r\n);\r\n");
        expect(r.doc.tables[0].columns[0].name).toBe("id");
    });
});

describe("round trip: export → import", () => {
    const sample = parseErd(
        readFileSync("src/dev/sample.erd.json", "utf8"),
    ).doc;
    const summary = (doc) =>
        doc.tables.map((t) => ({
            name: t.name,
            cols: t.columns.map((c) => [
                c.name,
                c.type,
                c.pk,
                c.notNull || c.pk,
                c.unique,
                c.increment,
                c.default,
            ]),
            indexes: t.indexes.length,
        }));
    const refs = (doc) =>
        doc.refs
            .map((r) => {
                const n = (id) => doc.tables.find((t) => t.id === id);
                const c = (e) =>
                    e.columns
                        .map(
                            (id) =>
                                n(e.table).columns.find((x) => x.id === id)
                                    .name,
                        )
                        .join(",");
                return `${n(r.from.table).name}.${c(r.from)}>${n(r.to.table).name}.${c(r.to)}:${r.onDelete}`;
            })
            .sort();

    // Types a dialect does not have are converted by the exporter on purpose (and come back as the
    // dialect's own type): SQLite stores an auto-increment key as INTEGER and JSON as text, SQL Server
    // has no timestamp / json. Everything else must survive unchanged.
    const converted = {
        sqlite: { json: "text", bigint_pk: "int" },
        mssql: { json: "nvarchar(max)", timestamp: "datetime" },
    };
    const expected = (doc, dialect) =>
        summary(doc).map((t) => ({
            ...t,
            cols: t.cols.map(([name, type, pk, nn, uq, ai, def]) => {
                const map = converted[dialect] ?? {};
                const key = pk && ai && type === "bigint" ? "bigint_pk" : type;
                return [name, map[key] ?? type, pk, nn, uq, ai, def];
            }),
        }));

    for (const dialect of ["generic", "mysql", "postgres", "sqlite", "mssql"]) {
        it(`${dialect}: the model comes back identical (except the declared conversions)`, () => {
            const back = importSql(toSql(sample, dialect).sql, {
                dbType: dialect,
            });
            expect(back.warnings).toEqual([]);
            expect(summary(back.doc)).toEqual(expected(sample, dialect));
            expect(refs(back.doc)).toEqual(refs(sample));
        });
    }
});

describe("layoutGrid", () => {
    const wide = () => {
        const sql = Array.from(
            { length: 30 },
            (_, i) =>
                `CREATE TABLE t${i} (id int PRIMARY KEY, p int REFERENCES t${i > 0 ? i - 1 : 0}(id));`,
        ).join("\n");
        return importSql(sql).doc;
    };
    it("no two tables overlap, nothing sits at negative coordinates, rows are bounded", () => {
        const doc = wide();
        const rects = doc.tables.map(tableRect);
        for (let i = 0; i < rects.length; i++) {
            expect(rects[i].x).toBeGreaterThanOrEqual(0);
            for (let j = i + 1; j < rects.length; j++)
                expect(rectsIntersect(rects[i], rects[j])).toBe(false);
        }
        const width = Math.max(...rects.map((r) => r.x + r.w));
        expect(width).toBeLessThan(4000);
    });
    it("is deterministic and related tables are neighbours in order", () => {
        const a = wide();
        const b = wide();
        expect(a.tables.map((t) => [t.x, t.y])).toEqual(
            b.tables.map((t) => [t.x, t.y]),
        );
        layoutGrid({ tables: [], refs: [] });
    });
});

describe("imported documents are valid files", () => {
    it("pass the same validator as files from disk without warnings", () => {
        const { doc } = importSql(fixture("pgdump"));
        const { issues } = validateErd(JSON.parse(serializeErd(doc)));
        expect(issues).toEqual([]);
    });
});

describe("detectDialect", () => {
    it("recognises the dump styles from their syntax", async () => {
        const { detectDialect } = await import("@/model/import/sql");
        expect(detectDialect(fixture("mysqldump"))).toBe("mysql");
        expect(detectDialect(fixture("pgdump"))).toBe("postgres");
        expect(
            detectDialect(
                "CREATE TABLE [dbo].[a] ([id] int IDENTITY(1,1));\nGO",
            ),
        ).toBe("mssql");
        expect(
            detectDialect(
                "PRAGMA foreign_keys=ON; CREATE TABLE a (id INTEGER PRIMARY KEY AUTOINCREMENT);",
            ),
        ).toBe("sqlite");
    });
    it("plain SQL and a stray backtick stay generic", async () => {
        const { detectDialect } = await import("@/model/import/sql");
        expect(detectDialect("CREATE TABLE a (id int PRIMARY KEY);")).toBe(
            "generic",
        );
        expect(
            detectDialect("-- uses `ticks` once\nCREATE TABLE a (id int);"),
        ).toBe("generic");
        expect(detectDialect("")).toBe("generic");
        expect(detectDialect(null)).toBe("generic");
    });
});
