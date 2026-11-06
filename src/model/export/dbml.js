import { groupMembership } from "../geometry";
import { columnNames, defaultKind, resolveRefs } from "./common";

/**
 * Document → DBML text (https://dbml.dbdiagram.io). Core data (tables, columns, indexes, refs, enums,
 * notes) maps one to one; the visual extras that DBML can express are kept too: header color,
 * sections as TableGroup, free notes as sticky `Note`s. Positions and sizes are not written.
 */

const DB_NAMES = {
    mysql: "MySQL",
    postgres: "PostgreSQL",
    sqlite: "SQLite",
    mssql: "SQL Server",
};

const SIMPLE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const name = (s) =>
    SIMPLE.test(s) ? s : `"${String(s).replace(/"/g, '\\"')}"`;

/** A DBML string: single quotes, or triple quotes for several lines. */
export function dbmlString(s) {
    const t = String(s);
    if (t.includes("\n"))
        return `'''\n${t.replace(/\\/g, "\\\\").replace(/'''/g, "\\'''")}\n'''`;
    return `'${t.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

const typeText = (t) =>
    /^[A-Za-z0-9_]+(\([^)]*\))?(\[\])?$/.test(t) && t
        ? t
        : `"${t.replace(/"/g, '\\"')}"`;

function defaultText(value) {
    switch (defaultKind(value)) {
        case "number":
        case "keyword":
            return String(value).trim().toLowerCase() === "null"
                ? "null"
                : String(value).trim();
        case "string":
            return dbmlString(
                String(value).trim().slice(1, -1).replace(/''/g, "'"),
            );
        case "expr":
            return `\`${String(value).trim()}\``;
        default:
            return dbmlString(String(value).trim());
    }
}

const tableRef = (t) =>
    t.schema ? `${name(t.schema)}.${name(t.name)}` : name(t.name);

function columnLine(c) {
    const s = [];
    if (c.pk) s.push("pk");
    if (c.increment) s.push("increment");
    if (c.notNull && !c.pk) s.push("not null");
    if (c.unique && !c.pk) s.push("unique");
    if (c.default) s.push(`default: ${defaultText(c.default)}`);
    if (c.note) s.push(`note: ${dbmlString(c.note)}`);
    return `  ${name(c.name)} ${typeText(c.type || "text")}${s.length ? ` [${s.join(", ")}]` : ""}`;
}

export function toDbml(doc) {
    const out = [];
    const { refs, warnings } = resolveRefs(doc);

    const project = [];
    if (DB_NAMES[doc.meta.dbType])
        project.push(`  database_type: '${DB_NAMES[doc.meta.dbType]}'`);
    if (doc.meta.note) project.push(`  Note: ${dbmlString(doc.meta.note)}`);
    if (project.length)
        out.push(
            `Project ${name(doc.meta.name || "diagram")} {\n${project.join("\n")}\n}`,
        );

    for (const e of doc.enums ?? []) {
        const lines = e.values.map(
            (v) =>
                `  ${name(v.name)}${v.note ? ` [note: ${dbmlString(v.note)}]` : ""}`,
        );
        out.push(`Enum ${name(e.name)} {\n${lines.join("\n")}\n}`);
    }

    for (const t of doc.tables) {
        const settings = [];
        if (t.color) settings.push(`headercolor: ${t.color}`);
        const lines = t.columns.map(columnLine);
        if (t.indexes.length) {
            lines.push("", "  indexes {");
            for (const ix of t.indexes) {
                const cols = columnNames(t, ix.columns);
                if (!cols.length) continue;
                const s = [];
                if (ix.unique) s.push("unique");
                if (ix.type) s.push(`type: ${ix.type}`);
                if (ix.name) s.push(`name: '${ix.name}'`);
                const key =
                    cols.length > 1
                        ? `(${cols.map(name).join(", ")})`
                        : name(cols[0]);
                lines.push(`    ${key}${s.length ? ` [${s.join(", ")}]` : ""}`);
            }
            lines.push("  }");
        }
        if (t.note) lines.push("", `  Note: ${dbmlString(t.note)}`);
        out.push(
            `Table ${tableRef(t)}${settings.length ? ` [${settings.join(", ")}]` : ""} {\n${lines.join("\n")}\n}`,
        );
    }

    for (const { ref, from, to, fromCols, toCols } of refs) {
        const many = (e) => e.cardinality.endsWith("*");
        const op = many(ref.from) ? ">" : many(ref.to) ? "<" : "-";
        const end = (t, cols) =>
            cols.length > 1
                ? `${tableRef(t)}.(${cols.map(name).join(", ")})`
                : `${tableRef(t)}.${name(cols[0])}`;
        const s = [];
        if (ref.onDelete) s.push(`delete: ${ref.onDelete}`);
        if (ref.onUpdate) s.push(`update: ${ref.onUpdate}`);
        out.push(
            `Ref${ref.label ? ` ${name(ref.label)}` : ""}: ${end(from, fromCols)} ${op} ${end(to, toCols)}${s.length ? ` [${s.join(", ")}]` : ""}`,
        );
    }

    const membership = groupMembership(doc);
    for (const g of doc.groups) {
        const members = doc.tables.filter((t) => membership.get(t.id) === g.id);
        if (!members.length) continue;
        const settings = [];
        if (g.color) settings.push(`color: ${g.color}`);
        const lines = members.map((t) => `  ${tableRef(t)}`);
        if (g.note) lines.push("", `  Note: ${dbmlString(g.note)}`);
        out.push(
            `TableGroup ${name(g.name || "group")}${settings.length ? ` [${settings.join(", ")}]` : ""} {\n${lines.join("\n")}\n}`,
        );
    }

    (doc.notes ?? []).forEach((n, i) => {
        if (!n.text) return;
        out.push(`Note note_${i + 1} {\n  ${dbmlString(n.text)}\n}`);
    });

    return { text: out.join("\n\n") + "\n", warnings };
}
