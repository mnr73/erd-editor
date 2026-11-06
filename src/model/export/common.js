/**
 * Helpers shared by every exporter (DBML, SQL, agent Markdown, SVG). Pure: no Vue, no DOM.
 * Exporters never mutate the document and never throw on a damaged one: what cannot be written is
 * skipped and reported as a warning `{ code, ...details }` (the UI turns codes into texts).
 */

/** What kind of value a column `default` holds, judged from the text the user typed. */
export function defaultKind(value) {
    const v = String(value ?? "").trim();
    if (!v) return "none";
    if (/^-?\d+(\.\d+)?$/.test(v)) return "number";
    if (/^'(?:[^']|'')*'$/.test(v)) return "string";
    if (/^(null|true|false)$/i.test(v)) return "keyword";
    if (/^(current_(timestamp|date|time)|localtimestamp|now\(\))$/i.test(v))
        return "expr";
    if (/^[a-z_][a-z0-9_]*\s*\(.*\)$/i.test(v)) return "expr";
    return "bare"; // a word like `draft`: treated as a string literal
}

export const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Column ids → names of a table (unknown ids are dropped). */
export function columnNames(table, ids) {
    return ids
        .map((id) => table.columns.find((c) => c.id === id)?.name)
        .filter(Boolean);
}

/**
 * Relationships that can be written as a foreign key: both tables exist and both ends have the same
 * number of existing columns. Returns { refs: [{ ref, from, to, fromCols, toCols }], warnings }.
 * A many-to-many ref cannot be a single foreign key and is skipped with a warning.
 */
export function resolveRefs(doc) {
    const byId = new Map(doc.tables.map((t) => [t.id, t]));
    const refs = [];
    const warnings = [];
    for (const ref of doc.refs) {
        const from = byId.get(ref.from.table);
        const to = byId.get(ref.to.table);
        const fromCols = from ? columnNames(from, ref.from.columns) : [];
        const toCols = to ? columnNames(to, ref.to.columns) : [];
        if (
            !from ||
            !to ||
            !fromCols.length ||
            fromCols.length !== ref.from.columns.length ||
            fromCols.length !== toCols.length ||
            toCols.length !== ref.to.columns.length
        ) {
            warnings.push({ code: "ref-skipped", ref: ref.id });
            continue;
        }
        if (
            ref.from.cardinality.endsWith("*") &&
            ref.to.cardinality.endsWith("*")
        ) {
            warnings.push({
                code: "ref-many-to-many",
                ref: ref.id,
                from: from.name,
                to: to.name,
            });
            continue;
        }
        refs.push({ ref, from, to, fromCols, toCols });
    }
    return { refs, warnings };
}

/** Constraint name of a foreign key: fk_<table>_<col>_<col>. */
export const fkName = (table, cols) =>
    ["fk", table.name, ...cols].join("_").replace(/[^A-Za-z0-9_]/g, "_");

/** `schema.table` or `table`. */
export const qualified = (table) =>
    table.schema ? `${table.schema}.${table.name}` : table.name;

/** First line of a multi-line text, trimmed (used for short labels). */
export const firstLine = (s) =>
    String(s ?? "")
        .split("\n")[0]
        .trim();
