#!/usr/bin/env node
// Checks an ERD Editor file (*.erd.json) without installing anything: node check-erd.mjs file.erd.json
// Prints one line per problem and exits 1 if there is any. Mirrors the rules of the app's validator
// (src/model/validate.js); the JSON Schema alone cannot check that ids point at something.
import { readFileSync } from "node:fs";
import process from "node:process";

const CARD = ["1", "0..1", "1..*", "0..*"];
const ACTIONS = ["cascade", "restrict", "set null", "set default", "no action"];
const DB = ["generic", "mysql", "postgres", "sqlite", "mssql"];
const HEX = /^#[0-9a-fA-F]{6}$/;
const VERSION = 1;

const file = process.argv[2];
if (!file) {
    console.error("usage: node check-erd.mjs path/to/file.erd.json");
    process.exit(2);
}

const problems = [];
const bad = (where, msg) => problems.push(`${where}: ${msg}`);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

let doc;
try {
    doc = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
    console.error(`${file}: not valid JSON (${e.message})`);
    process.exit(1);
}

if (!isObj(doc)) {
    console.error(`${file}: top level must be an object`);
    process.exit(1);
}
if (doc.format !== "erd-editor")
    bad("format", `must be "erd-editor", found ${JSON.stringify(doc.format)}`);
if (!Number.isInteger(doc.version) || doc.version < 1)
    bad("version", "must be an integer >= 1");
else if (doc.version > VERSION)
    bad(
        "version",
        `${doc.version} is newer than this checker supports (${VERSION})`,
    );

const list = (key) => {
    const v = doc[key];
    if (v === undefined) return [];
    if (!Array.isArray(v)) {
        bad(key, "must be a list");
        return [];
    }
    return v;
};
const tables = list("tables");
const refs = list("refs");
const groups = list("groups");
const notes = list("notes");
const enums = list("enums");

if (doc.meta?.dbType !== undefined && !DB.includes(doc.meta.dbType))
    bad("meta.dbType", `must be one of ${DB.join(", ")}`);

// ids: present and unique across every kind of item and every column/index
const seen = new Map();
const claim = (id, where) => {
    if (typeof id !== "string" || !id) return bad(where, "id is missing");
    if (seen.has(id)) bad(where, `duplicate id "${id}" (also ${seen.get(id)})`);
    else seen.set(id, where);
};
const tableById = new Map();
tables.forEach((t, i) => {
    const w = `tables[${i}]${t?.name ? ` (${t.name})` : ""}`;
    if (!isObj(t)) return bad(w, "must be an object");
    claim(t.id, w);
    tableById.set(t.id, t);
    if (!t.name) bad(w, "name is empty");
    if (t.color && !HEX.test(t.color))
        bad(w, `color "${t.color}" must be #RRGGBB`);
    (t.columns ?? []).forEach((c, j) =>
        claim(c?.id, `${w}.columns[${j}]${c?.name ? ` (${c.name})` : ""}`),
    );
    (t.indexes ?? []).forEach((x, j) => claim(x?.id, `${w}.indexes[${j}]`));
});
refs.forEach((r, i) => claim(r?.id, `refs[${i}]`));
groups.forEach((g, i) => claim(g?.id, `groups[${i}]`));
notes.forEach((n, i) => claim(n?.id, `notes[${i}]`));
enums.forEach((e, i) => claim(e?.id, `enums[${i}]`));

// duplicate names
const names = new Map();
for (const t of tables) {
    const key = `${t.schema ?? ""}.${String(t.name).toLowerCase()}`;
    if (names.has(key))
        bad(`tables (${t.name})`, "another table has the same name");
    names.set(key, true);
    const cols = new Set();
    for (const c of t.columns ?? []) {
        const k = String(c.name).toLowerCase();
        if (!c.name) bad(`table ${t.name}`, `column ${c.id} has no name`);
        else if (cols.has(k))
            bad(`table ${t.name}`, `two columns are named "${c.name}"`);
        cols.add(k);
    }
}

// indexes
for (const t of tables) {
    const colIds = new Set((t.columns ?? []).map((c) => c.id));
    for (const x of t.indexes ?? []) {
        const w = `table ${t.name}, index ${x.id}`;
        if (!Array.isArray(x.columns) || !x.columns.length)
            bad(w, "has no columns");
        else {
            const used = new Set();
            for (const id of x.columns) {
                if (!colIds.has(id))
                    bad(
                        w,
                        `column id "${id}" is not a column of this table (indexes use column ids, not names)`,
                    );
                if (used.has(id)) bad(w, `column "${id}" appears twice`);
                used.add(id);
            }
        }
        if (x.type != null && !["btree", "hash"].includes(x.type))
            bad(w, `type must be btree or hash`);
    }
}

// refs
refs.forEach((r, i) => {
    const w = `refs[${i}]${r?.label ? ` (${r.label})` : ""}`;
    if (!isObj(r)) return;
    for (const side of ["from", "to"]) {
        const e = r[side];
        if (!isObj(e)) {
            bad(w, `${side} is missing`);
            continue;
        }
        const t = tableById.get(e.table);
        if (!t) {
            bad(
                w,
                `${side}.table "${e.table}" is not a table id (refs use ids, not names)`,
            );
            continue;
        }
        if (!Array.isArray(e.columns) || !e.columns.length) {
            bad(
                w,
                `${side}.columns must be a list with at least one column id`,
            );
            continue;
        }
        const colIds = new Set((t.columns ?? []).map((c) => c.id));
        for (const id of e.columns)
            if (!colIds.has(id))
                bad(
                    w,
                    `${side}.columns: "${id}" is not a column of table ${t.name}`,
                );
        if (e.cardinality !== undefined && !CARD.includes(e.cardinality))
            bad(
                w,
                `${side}.cardinality "${e.cardinality}" must be one of ${CARD.join(", ")}`,
            );
    }
    if (
        isObj(r.from) &&
        isObj(r.to) &&
        Array.isArray(r.from.columns) &&
        Array.isArray(r.to.columns) &&
        r.from.columns.length !== r.to.columns.length
    )
        bad(w, "from.columns and to.columns must have the same length");
    for (const k of ["onDelete", "onUpdate"])
        if (r[k] != null && !ACTIONS.includes(r[k]))
            bad(w, `${k} "${r[k]}" must be one of ${ACTIONS.join(", ")}`);
});

// groups, notes
groups.forEach((g, i) => {
    const w = `groups[${i}] (${g?.name ?? ""})`;
    if (g.color && !HEX.test(g.color))
        bad(w, `color "${g.color}" must be #RRGGBB`);
    if ((g.w !== undefined && g.w < 120) || (g.h !== undefined && g.h < 120))
        bad(w, "w and h must be at least 120");
});
notes.forEach((n, i) => {
    if (n.color && !HEX.test(n.color))
        bad(`notes[${i}]`, `color "${n.color}" must be #RRGGBB`);
});

if (problems.length) {
    for (const p of problems) console.error(p);
    console.error(`${file}: ${problems.length} problem(s)`);
    process.exit(1);
}
console.log(
    `${file}: ok (${tables.length} tables, ${refs.length} relations, ${groups.length} sections)`,
);
