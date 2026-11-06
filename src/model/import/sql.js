import {
    createColumn,
    createDocument,
    createIndex,
    createRef,
    createRefEnd,
    createTable,
} from "../document";
import { layoutGrid } from "./layout";

/**
 * SQL DDL → document. Reads what a schema dump contains: CREATE TABLE (columns, types, NOT NULL,
 * DEFAULT, AUTO_INCREMENT / IDENTITY / SERIAL, PRIMARY KEY, UNIQUE, inline REFERENCES, table-level
 * FOREIGN KEY, MySQL COMMENT), CREATE [UNIQUE] INDEX, ALTER TABLE … ADD [CONSTRAINT] FOREIGN KEY /
 * PRIMARY KEY / UNIQUE, COMMENT ON, CREATE SCHEMA / CREATE TYPE … AS ENUM. Everything else (INSERT, CREATE VIEW,
 * triggers, GRANT, …) is skipped and counted. It never throws: problems are returned as warnings.
 *
 * Returns { doc, warnings, stats }. Tables are laid out on a grid, related tables near each other.
 */

/* ------------------------------- tokenizer -------------------------------- */

/** Splits SQL text into tokens: words, quoted identifiers, strings, numbers, punctuation. Drops comments. */
export function tokenize(sql) {
    const tokens = [];
    const n = sql.length;
    let i = 0;
    const push = (type, value, raw = value) =>
        tokens.push({ type, value, raw });
    while (i < n) {
        const ch = sql[i];
        if (/\s/.test(ch)) {
            i++;
        } else if (ch === "-" && sql[i + 1] === "-") {
            while (i < n && sql[i] !== "\n") i++;
        } else if (ch === "#") {
            while (i < n && sql[i] !== "\n") i++;
        } else if (ch === "/" && sql[i + 1] === "*") {
            const end = sql.indexOf("*/", i + 2);
            i = end < 0 ? n : end + 2;
        } else if (
            /[NnEeXxBb]/.test(ch) &&
            sql[i + 1] === "'" &&
            !/[A-Za-z0-9_]/.test(sql[i - 1] ?? " ")
        ) {
            i++; // N'x', E'x', X'ff', B'01': the prefix is not part of the value
        } else if (ch === "'") {
            let j = i + 1;
            let s = "";
            while (j < n) {
                if (sql[j] === "'" && sql[j + 1] === "'") {
                    s += "'";
                    j += 2;
                } else if (sql[j] === "\\" && j + 1 < n) {
                    s += sql[j + 1];
                    j += 2;
                } else if (sql[j] === "'") break;
                else s += sql[j++];
            }
            push("string", s, sql.slice(i, j + 1));
            i = j + 1;
        } else if (ch === "[" && /[\]0-9]/.test(sql[i + 1] ?? "")) {
            push("punct", ch);
            i++;
        } else if (ch === '"' || ch === "`" || ch === "[") {
            const close = ch === "[" ? "]" : ch;
            let j = i + 1;
            let s = "";
            while (j < n) {
                if (sql[j] === close && sql[j + 1] === close && ch !== "[") {
                    s += close;
                    j += 2;
                } else if (sql[j] === close) break;
                else s += sql[j++];
            }
            push("ident", s, sql.slice(i, j + 1));
            i = j + 1;
        } else if (ch === "$" && /^\$[A-Za-z_]*\$/.test(sql.slice(i, i + 20))) {
            const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 20))[0];
            const end = sql.indexOf(tag, i + tag.length);
            push("string", sql.slice(i + tag.length, end < 0 ? n : end));
            i = end < 0 ? n : end + tag.length;
        } else if (
            /[0-9]/.test(ch) ||
            (ch === "." && /[0-9]/.test(sql[i + 1] ?? ""))
        ) {
            let j = i;
            while (j < n && /[0-9.]/.test(sql[j])) j++;
            push("number", sql.slice(i, j));
            i = j;
        } else if (/[A-Za-z_@]/.test(ch) || ch.charCodeAt(0) > 127) {
            let j = i;
            while (
                (j < n && /[A-Za-z0-9_$@]/.test(sql[j])) ||
                (j < n && sql[j].charCodeAt(0) > 127)
            )
                j++;
            push("word", sql.slice(i, j));
            i = j;
        } else {
            push("punct", ch);
            i++;
        }
    }
    return tokens;
}

/** Splits tokens into statements at top-level `;` (and at a lone GO line is not handled: use ;). */
function statements(tokens) {
    const out = [];
    let cur = [];
    let depth = 0;
    for (const t of tokens) {
        if (t.type === "punct" && t.value === "(") depth++;
        if (t.type === "punct" && t.value === ")")
            depth = Math.max(0, depth - 1);
        if (t.type === "punct" && t.value === ";" && depth === 0) {
            if (cur.length) out.push(cur);
            cur = [];
        } else cur.push(t);
    }
    if (cur.length) out.push(cur);
    return out;
}

/* --------------------------------- parser --------------------------------- */

const up = (t) => t && (t.type === "word" ? t.value.toUpperCase() : null);
const isWord = (t, w) => up(t) === w;
const isPunct = (t, p) => t?.type === "punct" && t.value === p;
const isName = (t) => t && (t.type === "word" || t.type === "ident");

class Cursor {
    constructor(tokens) {
        this.t = tokens;
        this.i = 0;
    }
    get cur() {
        return this.t[this.i];
    }
    peek(k = 1) {
        return this.t[this.i + k];
    }
    done() {
        return this.i >= this.t.length;
    }
    next() {
        return this.t[this.i++];
    }
    accept(w) {
        if (isWord(this.cur, w)) {
            this.i++;
            return true;
        }
        return false;
    }
    acceptPunct(p) {
        if (isPunct(this.cur, p)) {
            this.i++;
            return true;
        }
        return false;
    }
    /** consume words in order (all or nothing) */
    acceptSeq(...ws) {
        for (let k = 0; k < ws.length; k++)
            if (!isWord(this.t[this.i + k], ws[k])) return false;
        this.i += ws.length;
        return true;
    }
}

/** `a.b.c` → ["a","b","c"]. */
function qualifiedName(c) {
    const parts = [];
    while (isName(c.cur)) {
        parts.push(c.next().value);
        if (isPunct(c.cur, ".")) c.next();
        else break;
    }
    return parts;
}

/** `( a, b DESC, c(10) )` → ["a","b","c"]. Cursor must be at "(". */
function nameList(c) {
    const names = [];
    if (!c.acceptPunct("(")) return names;
    let depth = 1;
    let expectName = true;
    while (!c.done() && depth > 0) {
        const t = c.next();
        if (isPunct(t, "(")) depth++;
        else if (isPunct(t, ")")) depth--;
        else if (depth === 1 && isPunct(t, ",")) expectName = true;
        else if (depth === 1 && expectName && isName(t)) {
            names.push(t.value);
            expectName = false;
        }
    }
    return names;
}

/** Raw text of a balanced `( … )` group as tokens (cursor at "("); cursor ends after ")". */
function group(c) {
    const out = [];
    if (!c.acceptPunct("(")) return out;
    let depth = 1;
    while (!c.done()) {
        const t = c.next();
        if (isPunct(t, "(")) depth++;
        if (isPunct(t, ")")) {
            depth--;
            if (!depth) break;
        }
        out.push(t);
    }
    return out;
}

/** Splits the body tokens of CREATE TABLE at top-level commas. */
function splitItems(tokens) {
    const items = [];
    let cur = [];
    let depth = 0;
    for (const t of tokens) {
        if (isPunct(t, "(")) depth++;
        if (isPunct(t, ")")) depth--;
        if (isPunct(t, ",") && depth === 0) {
            items.push(cur);
            cur = [];
        } else cur.push(t);
    }
    if (cur.length) items.push(cur);
    return items;
}

const TYPE_ALIASES = {
    int4: "int",
    int8: "bigint",
    int2: "smallint",
    integer: "int",
    bool: "boolean",
    "double precision": "double",
    float8: "double",
    float4: "float",
    "character varying": "varchar",
    character: "char",
    bpchar: "char",
    "timestamp without time zone": "timestamp",
    "timestamp with time zone": "timestamptz",
    "time without time zone": "time",
    "bit varying": "bit",
    "unsigned integer": "int",
    datetime2: "datetime",
    smalldatetime: "datetime",
    ntext: "text",
    nchar: "char",
    varbinary: "blob",
    binary: "blob",
    longblob: "blob",
    mediumblob: "blob",
    tinyblob: "blob",
    tinytext: "text",
    uniqueidentifier: "uuid",
};
const SERIAL = {
    serial: "int",
    bigserial: "bigint",
    smallserial: "smallint",
    serial4: "int",
    serial8: "bigint",
};
const MODS = new Set([
    "NOT",
    "NULL",
    "DEFAULT",
    "PRIMARY",
    "UNIQUE",
    "REFERENCES",
    "CHECK",
    "COMMENT",
    "AUTO_INCREMENT",
    "AUTOINCREMENT",
    "IDENTITY",
    "GENERATED",
    "COLLATE",
    "CHARACTER",
    "CONSTRAINT",
    "ON",
    "KEY",
    "UNSIGNED",
    "ZEROFILL",
    "ENCODE",
    "WITH",
    "WITHOUT",
    "AS",
    "STORED",
    "VIRTUAL",
    "INVISIBLE",
    "VISIBLE",
    "FIRST",
    "AFTER",
]);

/** Reads a column type at the cursor: `varchar(255)`, `double precision`, `int unsigned`, `text[]`, `enum('a','b')`. */
function readType(c, warn, ctx) {
    // words of the type: `double precision`, `character varying`, `timestamp with time zone` …
    // A schema-qualified name (`public.my_enum`) keeps only its last part.
    let words = [];
    const stop = () => {
        const t = c.cur;
        if (!isName(t)) return true;
        return t.type === "word" && words.length > 0 && MODS.has(up(t));
    };
    while (!stop()) {
        words.push(c.next());
        if (isPunct(c.cur, ".")) {
            c.next();
            words = [];
            continue;
        }
        if (isPunct(c.cur, "(") || words.length >= 4) break;
        const phrase = words.map((w) => w.value.toLowerCase()).join(" ");
        const nextWord =
            isName(c.cur) && c.cur.type === "word"
                ? c.cur.value.toLowerCase()
                : "";
        if (phrase === "character" && nextWord === "set") break; // a modifier, not part of the type
        const longer = `${phrase} ${nextWord}`;
        const multi = Object.keys(TYPE_ALIASES).some((k) =>
            k.startsWith(longer),
        );
        if (!multi && !/^(double|character|timestamp|time|bit)$/.test(phrase))
            break;
    }
    if (!words.length) return null;
    let base = words.map((w) => w.value.toLowerCase()).join(" ");
    // timestamp(3) with time zone etc.
    let params = [];
    if (isPunct(c.cur, "(")) {
        const inner = group(c);
        params = splitItems(inner).map((it) => it.map((t) => t.value).join(""));
        if (base === "enum" || base === "set") {
            params = splitItems(inner).map((it) => it[0]?.value ?? "");
        }
    }
    // trailing "with time zone" after params
    while (isWord(c.cur, "WITH") || isWord(c.cur, "WITHOUT")) {
        if (isWord(c.peek(), "TIME") && isWord(c.peek(2), "ZONE")) {
            const tz = isWord(c.cur, "WITH");
            c.i += 3;
            base = `${base} ${tz ? "with" : "without"} time zone`;
        } else break;
    }
    let array = false;
    while (isPunct(c.cur, "[")) {
        c.next();
        while (!c.done() && !isPunct(c.cur, "]")) c.next();
        c.next();
        array = true;
    }
    if (base.endsWith("[]")) {
        array = true;
        base = base.slice(0, -2);
    }
    let unsigned = false;
    if (isWord(c.cur, "UNSIGNED")) {
        c.next();
        unsigned = true;
    }
    if (isWord(c.cur, "ZEROFILL")) c.next();

    let serial = false;
    if (SERIAL[base]) {
        serial = true;
        base = SERIAL[base];
    }
    base = TYPE_ALIASES[base] ?? base;
    // bigint(20), int(11): display widths mean nothing
    if (
        /^(tinyint|smallint|mediumint|int|bigint)$/.test(base) &&
        params.length
    ) {
        if (base === "tinyint" && params[0] === "1") base = "boolean";
        params = [];
    }
    if (base === "varbinary" || base === "blob") params = [];
    let text = base;
    if (base === "enum" || base === "set") {
        const vals = params.map((v) => `'${String(v).replace(/'/g, "\\'")}'`);
        if (base === "set") {
            ctx.warn("type-kept-as-text", { type: "set" });
            text = `set(${vals.join(",")})`;
        } else text = `enum(${vals.join(",")})`;
    } else if (params.length) {
        const clean = params.filter((p) => /^\d+$/.test(p) || /^max$/i.test(p));
        if (clean.length)
            text += `(${clean.map((p) => (/^max$/i.test(p) ? "max" : p)).join(",")})`;
    }
    if (array) text += "[]";
    if (unsigned) text += " unsigned";
    return { text, serial, base };
}

/** Skips an expression until a top-level column modifier keyword or `,`. Returns raw text. */
function readDefault(c) {
    const t = c.cur;
    if (!t) return "";
    // parenthesised expression: ('x'), (now()), ((0))
    if (isPunct(t, "(")) {
        const inner = group(c);
        const raw = inner
            .map((x) => x.raw)
            .join(" ")
            .replace(/\s+\(/g, "(")
            .replace(/\(\s+/g, "(")
            .replace(/\s+\)/g, ")");
        // unwrap a simple literal: ('x') / ((0))
        const lit = /^\(*('(?:[^']|'')*'|-?\d+(?:\.\d+)?)\)*$/.exec(raw);
        return lit ? lit[1] : raw;
    }
    // string with optional ::cast
    if (t.type === "string") {
        c.next();
        const s = `'${t.value.replace(/'/g, "''")}'`;
        if (isPunct(c.cur, ":") && isPunct(c.peek(), ":")) {
            c.i += 2;
            readType(c, () => {}, { warn() {} });
        }
        return s;
    }
    if (
        t.type === "number" ||
        (isPunct(t, "-") && c.peek()?.type === "number")
    ) {
        const neg = isPunct(t, "-");
        if (neg) c.next();
        const v = c.next().value;
        return neg ? `-${v}` : v;
    }
    if (isName(t)) {
        const name = c.next().value;
        if (isPunct(c.cur, "(")) {
            const inner = group(c);
            return `${name}(${inner
                .map((x) => x.raw)
                .join("")
                .replace(/,/g, ", ")})`.replace(/\(\s+/, "(");
        }
        if (isPunct(c.cur, ":") && isPunct(c.peek(), ":")) {
            c.i += 2;
            readType(c, () => {}, { warn() {} });
        }
        return name;
    }
    c.next();
    return "";
}

function cleanDefault(v) {
    if (/^nextval\(/i.test(v)) return null; // serial sequence
    return v;
}

/** Parses the column modifiers after the type. */
function readColumnRest(c, col, ctx, tableState) {
    while (!c.done()) {
        if (c.accept("NOT") && c.accept("NULL")) col.notNull = true;
        else if (c.accept("NULL")) col.notNull = false;
        else if (c.accept("DEFAULT")) {
            const v = readDefault(c);
            const d = cleanDefault(v);
            if (d === null) col.increment = true;
            else if (d && !/^null$/i.test(d)) col.default = d;
        } else if (c.acceptSeq("PRIMARY", "KEY")) {
            col.pk = true;
            col.notNull = true;
            if (c.accept("AUTOINCREMENT")) col.increment = true;
            while (
                isWord(c.cur, "ASC") ||
                isWord(c.cur, "DESC") ||
                isWord(c.cur, "CLUSTERED") ||
                isWord(c.cur, "NONCLUSTERED")
            )
                c.next();
        } else if (c.accept("UNIQUE")) {
            c.accept("KEY");
            col.unique = true;
        } else if (c.accept("AUTO_INCREMENT") || c.accept("AUTOINCREMENT"))
            col.increment = true;
        else if (c.accept("IDENTITY")) {
            col.increment = true;
            if (isPunct(c.cur, "(")) group(c);
        } else if (c.accept("GENERATED")) {
            // GENERATED { ALWAYS | BY DEFAULT } AS IDENTITY [(…)]   or   AS ( expr ) STORED
            c.accept("ALWAYS");
            c.acceptSeq("BY", "DEFAULT");
            if (c.accept("AS")) {
                if (c.accept("IDENTITY")) {
                    col.increment = true;
                    if (isPunct(c.cur, "(")) group(c);
                } else if (isPunct(c.cur, "(")) {
                    group(c);
                    c.accept("STORED") || c.accept("VIRTUAL");
                    ctx.warn("generated-column-skipped", {
                        table: tableState.name,
                        column: col.name,
                    });
                }
            }
        } else if (c.accept("REFERENCES")) {
            const target = qualifiedName(c);
            const cols = isPunct(c.cur, "(") ? nameList(c) : [];
            const ref = {
                fromTable: tableState.name,
                fromCols: [col.name],
                toTable: target.at(-1),
                toSchema: target.length > 1 ? target.at(-2) : "",
                toCols: cols,
            };
            readRefActions(c, ref);
            ctx.refs.push(ref);
        } else if (c.accept("COMMENT")) {
            const s = c.next();
            if (s?.type === "string") col.note = s.value;
        } else if (c.accept("CHECK")) {
            if (isPunct(c.cur, "(")) group(c);
        } else if (c.accept("COLLATE")) c.next();
        else if (c.acceptSeq("CHARACTER", "SET")) c.next();
        else if (c.accept("CONSTRAINT")) {
            if (isName(c.cur) && !MODS.has(up(c.cur))) c.next();
        } else if (c.accept("ON")) {
            // ON UPDATE CURRENT_TIMESTAMP (MySQL)
            if (c.accept("UPDATE")) readDefault(c);
            else c.next();
        } else if (c.accept("VISIBLE") || c.accept("INVISIBLE")) {
            /* nothing */
        } else c.next();
    }
}

function readRefActions(c, ref) {
    while (
        isWord(c.cur, "ON") ||
        isWord(c.cur, "MATCH") ||
        isWord(c.cur, "DEFERRABLE") ||
        isWord(c.cur, "NOT") ||
        isWord(c.cur, "INITIALLY") ||
        isWord(c.cur, "NOT")
    ) {
        if (c.accept("ON")) {
            const which = c.accept("DELETE")
                ? "onDelete"
                : c.accept("UPDATE")
                  ? "onUpdate"
                  : null;
            const action = [];
            while (
                isName(c.cur) &&
                [
                    "CASCADE",
                    "RESTRICT",
                    "SET",
                    "NULL",
                    "DEFAULT",
                    "NO",
                    "ACTION",
                ].includes(up(c.cur))
            )
                action.push(c.next().value.toLowerCase());
            const a = action.join(" ");
            if (
                which &&
                [
                    "cascade",
                    "restrict",
                    "set null",
                    "set default",
                    "no action",
                ].includes(a)
            )
                ref[which] = a;
        } else c.next();
    }
}

/** One item of the CREATE TABLE body → column or table constraint. */
function readItem(tokens, ctx, ts) {
    const c = new Cursor(tokens);
    let constraintName = "";
    if (c.accept("CONSTRAINT"))
        constraintName = isName(c.cur) ? c.next().value : "";
    // table-level constraints
    if (isWord(c.cur, "PRIMARY") && isWord(c.peek(), "KEY")) {
        c.i += 2;
        c.accept("CLUSTERED") || c.accept("NONCLUSTERED");
        ts.pk.push(...nameList(c));
        return;
    }
    if (isWord(c.cur, "FOREIGN") && isWord(c.peek(), "KEY")) {
        c.i += 2;
        const fromCols = nameList(c);
        if (!c.accept("REFERENCES")) return;
        const target = qualifiedName(c);
        const toCols = isPunct(c.cur, "(") ? nameList(c) : [];
        const ref = {
            fromTable: ts.name,
            fromCols,
            toTable: target.at(-1),
            toSchema: target.length > 1 ? target.at(-2) : "",
            toCols,
        };
        readRefActions(c, ref);
        ctx.refs.push(ref);
        return;
    }
    if (
        isWord(c.cur, "UNIQUE") &&
        (isWord(c.peek(), "KEY") ||
            isWord(c.peek(), "INDEX") ||
            isPunct(c.peek(), "(") ||
            isName(c.peek()))
    ) {
        c.next();
        c.accept("CLUSTERED") || c.accept("NONCLUSTERED");
        c.accept("KEY") || c.accept("INDEX");
        let name = constraintName;
        if (isName(c.cur) && !isPunct(c.cur, "(")) name = c.next().value;
        const cols = nameList(c);
        if (cols.length) ts.indexes.push({ name, columns: cols, unique: true });
        return;
    }
    if (
        (isWord(c.cur, "KEY") || isWord(c.cur, "INDEX")) &&
        (isName(c.peek()) || isPunct(c.peek(), "("))
    ) {
        c.next();
        let name = "";
        if (isName(c.cur) && !isPunct(c.cur, "(")) name = c.next().value;
        const cols = nameList(c);
        if (cols.length)
            ts.indexes.push({ name, columns: cols, unique: false });
        return;
    }
    if (
        isWord(c.cur, "CHECK") ||
        isWord(c.cur, "EXCLUDE") ||
        isWord(c.cur, "FULLTEXT") ||
        isWord(c.cur, "SPATIAL") ||
        isWord(c.cur, "LIKE")
    ) {
        if (!isWord(c.cur, "CHECK"))
            ctx.warn("constraint-skipped", { table: ts.name, kind: up(c.cur) });
        return;
    }
    // a column
    if (!isName(c.cur)) return;
    const name = c.next().value;
    const type = readType(c, ctx.warn, ctx);
    const col = createColumn({ name, type: type?.text ?? "" });
    if (type?.serial) {
        col.increment = true;
        col.notNull = true;
    }
    if (!type)
        ctx.warn("column-without-type", { table: ts.name, column: name });
    readColumnRest(c, col, ctx, ts);
    ts.columns.push(col);
}

/** Skips table options after the closing paren (MySQL: ENGINE=…, COMMENT='…'). */
function readTableOptions(c, ts) {
    while (!c.done()) {
        if (c.accept("COMMENT")) {
            c.acceptPunct("=");
            const s = c.next();
            if (s?.type === "string") ts.note = s.value;
        } else c.next();
    }
}

function createTableStatement(c, ctx) {
    // CREATE [TEMP|TEMPORARY|UNLOGGED] TABLE [IF NOT EXISTS] name ( … ) options
    const nameParts = qualifiedName(c);
    if (!nameParts.length) return;
    const ts = {
        name: nameParts.at(-1),
        schema: nameParts.length > 1 ? nameParts.at(-2) : "",
        columns: [],
        pk: [],
        indexes: [],
        note: "",
    };
    if (c.accept("LIKE") || c.accept("AS")) {
        ctx.warn("table-skipped", { table: ts.name });
        return;
    }
    const body = group(c);
    for (const item of splitItems(body)) readItem(item, ctx, ts);
    readTableOptions(c, ts);
    for (const col of ts.columns)
        if (ts.pk.some((p) => p.toLowerCase() === col.name.toLowerCase())) {
            col.pk = true;
            col.notNull = true;
        }
    ctx.tables.push(ts);
}

function createIndexStatement(c, ctx, unique) {
    // CREATE [UNIQUE] INDEX [CONCURRENTLY] [IF NOT EXISTS] name ON [ONLY] table [USING method] ( cols )
    c.accept("CONCURRENTLY");
    c.acceptSeq("IF", "NOT", "EXISTS");
    let name = "";
    if (!isWord(c.cur, "ON") && isName(c.cur)) {
        name = qualifiedName(c).at(-1);
    }
    if (!c.accept("ON")) return;
    c.accept("ONLY");
    const table = qualifiedName(c);
    let type = null;
    if (c.accept("USING")) {
        const m = c.next()?.value.toLowerCase();
        if (m === "hash") type = m;
    }
    const cols = nameList(c);
    if (!cols.length) {
        ctx.warn("index-skipped", { index: name });
        return;
    }
    ctx.indexes.push({
        table: table.at(-1),
        name,
        columns: cols,
        unique,
        type,
    });
}

function alterTableStatement(c, ctx) {
    c.accept("ONLY");
    c.acceptSeq("IF", "EXISTS");
    const table = qualifiedName(c);
    while (!c.done()) {
        if (c.accept("ALTER")) {
            c.accept("COLUMN");
            const col = isName(c.cur) ? c.next().value : "";
            if (col && c.acceptSeq("SET", "DEFAULT")) {
                const v = readDefault(c);
                ctx.columnDefaults.push({
                    table: table.at(-1),
                    column: col,
                    value: cleanDefault(v),
                });
            }
            continue;
        }
        if (!c.accept("ADD")) {
            c.next();
            continue;
        }
        let name = "";
        if (c.accept("CONSTRAINT")) name = isName(c.cur) ? c.next().value : "";
        if (c.acceptSeq("FOREIGN", "KEY")) {
            if (isName(c.cur)) c.next(); // MySQL index name
            const fromCols = nameList(c);
            if (!c.accept("REFERENCES")) continue;
            const target = qualifiedName(c);
            const toCols = isPunct(c.cur, "(") ? nameList(c) : [];
            const ref = {
                fromTable: table.at(-1),
                fromCols,
                toTable: target.at(-1),
                toSchema: target.length > 1 ? target.at(-2) : "",
                toCols,
            };
            readRefActions(c, ref);
            ctx.refs.push(ref);
        } else if (c.acceptSeq("PRIMARY", "KEY")) {
            ctx.alterPk.push({ table: table.at(-1), columns: nameList(c) });
        } else if (c.accept("UNIQUE")) {
            c.accept("KEY") || c.accept("INDEX");
            if (isName(c.cur)) name = c.next().value;
            ctx.indexes.push({
                table: table.at(-1),
                name,
                columns: nameList(c),
                unique: true,
                type: null,
            });
        }
    }
}

function commentOnStatement(c, ctx) {
    // COMMENT ON TABLE t IS '…'  /  COMMENT ON COLUMN t.c IS '…'
    const kind = c.cur?.value?.toUpperCase();
    if (kind !== "TABLE" && kind !== "COLUMN") return;
    c.next();
    const name = qualifiedName(c);
    if (!c.accept("IS")) return;
    const s = c.next();
    if (s?.type !== "string") return;
    if (kind === "TABLE")
        ctx.comments.push({ table: name.at(-1), text: s.value });
    else
        ctx.comments.push({
            table: name.at(-2),
            column: name.at(-1),
            text: s.value,
        });
}

function createTypeStatement(c, ctx) {
    // CREATE TYPE name AS ENUM ('a','b')
    const name = qualifiedName(c);
    if (c.accept("AS") && c.accept("ENUM")) {
        const inner = group(c);
        const values = splitItems(inner).map((it) => it[0]?.value ?? "");
        ctx.enums.push({ name: name.at(-1), values });
    }
}

/**
 * Best guess of the SQL dialect of a dump, from syntax only one dialect uses. Returns one of
 * "mysql" | "postgres" | "sqlite" | "mssql" | "generic". Decides by points, so a single stray
 * backtick in a comment does not flip the answer.
 */
export function detectDialect(sql) {
    const text = String(sql ?? "").slice(0, 200000);
    const score = { mysql: 0, postgres: 0, sqlite: 0, mssql: 0 };
    const hit = (re, d, n = 1) => {
        const m = text.match(re);
        if (m) score[d] += Math.min(m.length, 3) * n;
    };
    hit(/`[^`\n]+`/g, "mysql");
    hit(/\bAUTO_INCREMENT\b/gi, "mysql", 3);
    hit(/\bENGINE\s*=/gi, "mysql", 3);
    hit(/\/\*!\d+/g, "mysql", 3);
    hit(/\bUNSIGNED\b/gi, "mysql");
    hit(/::[a-z_]+/gi, "postgres", 2);
    hit(/\b(SERIAL|BIGSERIAL|JSONB|BYTEA|TIMESTAMPTZ)\b/gi, "postgres", 2);
    hit(/\bGENERATED\s+(ALWAYS|BY DEFAULT)\s+AS\s+IDENTITY\b/gi, "postgres", 2);
    hit(/\bCOMMENT ON\b/gi, "postgres", 2);
    hit(/\bnextval\(/gi, "postgres", 3);
    hit(/\bAUTOINCREMENT\b/gi, "sqlite", 3);
    hit(/\bPRAGMA\b/gi, "sqlite", 3);
    hit(/\bWITHOUT ROWID\b/gi, "sqlite", 3);
    hit(/\[[A-Za-z_][^\]\n]*\]/g, "mssql");
    hit(/\bIDENTITY\s*\(\s*\d+/gi, "mssql", 3);
    hit(
        /\b(NVARCHAR|UNIQUEIDENTIFIER|DATETIME2|NONCLUSTERED|CLUSTERED)\b/gi,
        "mssql",
        2,
    );
    hit(/^\s*GO\s*$/gim, "mssql", 2);
    const [best, points] = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    return points >= 2 ? best : "generic";
}

/* ---------------------------------- main ---------------------------------- */

export function importSql(sql, { dbType = "generic", name = "" } = {}) {
    const warnings = [];
    const ctx = {
        tables: [],
        refs: [],
        indexes: [],
        alterPk: [],
        columnDefaults: [],
        comments: [],
        enums: [],
        warn: (code, extra = {}) => warnings.push({ code, ...extra }),
    };
    let skipped = 0;
    let statementCount = 0;
    const text = String(sql ?? "")
        // pg_dump data blocks (`COPY … FROM stdin;` rows … `\\.`) are not SQL statements
        .replace(/^COPY\s[^;\n]*FROM\s+stdin;\r?\n[\s\S]*?^\\\.\s*$/gim, "")
        .replace(/^\uFEFF/, "")
        .replace(/^\s*(GO|DELIMITER\s+\S+)\s*$/gim, ";");
    for (const stmt of statements(tokenize(text))) {
        statementCount++;
        const c = new Cursor(stmt);
        try {
            if (c.accept("CREATE")) {
                c.accept("OR") && c.accept("REPLACE");
                let unique = false;
                c.accept("GLOBAL") || c.accept("LOCAL");
                c.accept("TEMPORARY") ||
                    c.accept("TEMP") ||
                    c.accept("UNLOGGED");
                if (c.accept("UNIQUE")) unique = true;
                c.accept("CLUSTERED") ||
                    c.accept("NONCLUSTERED") ||
                    c.accept("FULLTEXT");
                if (c.accept("TABLE")) {
                    c.acceptSeq("IF", "NOT", "EXISTS");
                    createTableStatement(c, ctx);
                } else if (c.accept("INDEX"))
                    createIndexStatement(c, ctx, unique);
                else if (c.accept("TYPE")) createTypeStatement(c, ctx);
                else if (c.accept("SCHEMA")) {
                    /* schemas appear on tables */
                } else skipped++;
            } else if (c.accept("ALTER") && c.accept("TABLE"))
                alterTableStatement(c, ctx);
            else if (c.accept("COMMENT") && c.accept("ON"))
                commentOnStatement(c, ctx);
            else if (
                isWord(c.cur, "SET") ||
                isWord(c.cur, "USE") ||
                isWord(c.cur, "BEGIN") ||
                isWord(c.cur, "COMMIT") ||
                isWord(c.cur, "START") ||
                isWord(c.cur, "LOCK") ||
                isWord(c.cur, "UNLOCK") ||
                isWord(c.cur, "DROP") ||
                isWord(c.cur, "PRAGMA") ||
                isWord(c.cur, "SELECT")
            ) {
                /* harmless dump boilerplate */
            } else skipped++;
        } catch (e) {
            warnings.push({
                code: "statement-failed",
                message: String(e?.message ?? e),
            });
        }
    }

    const doc = createDocument(name);
    doc.meta.dbType = dbType;
    const byName = new Map();
    for (const ts of ctx.tables) {
        const key = (ts.schema ? `${ts.schema}.` : "") + ts.name;
        if (byName.has(key.toLowerCase())) {
            warnings.push({ code: "duplicate-table", table: ts.name });
            continue;
        }
        const table = createTable({
            name: ts.name,
            schema: ts.schema,
            note: ts.note,
            columns: ts.columns,
        });
        byName.set(key.toLowerCase(), table);
        if (!byName.has(ts.name.toLowerCase()))
            byName.set(ts.name.toLowerCase(), table);
        doc.tables.push(table);
        table._indexes = ts.indexes;
    }
    const tableOf = (n) => byName.get(String(n).toLowerCase());
    const colOf = (t, n) =>
        t?.columns.find(
            (c) => c.name.toLowerCase() === String(n).toLowerCase(),
        );

    for (const a of ctx.alterPk) {
        const t = tableOf(a.table);
        for (const n of a.columns) {
            const col = colOf(t, n);
            if (col) {
                col.pk = true;
                col.notNull = true;
            }
        }
    }
    for (const d of ctx.columnDefaults) {
        const col = colOf(tableOf(d.table), d.column);
        if (!col) continue;
        if (d.value === null) {
            col.increment = true;
            col.notNull = true;
        } else if (d.value && !/^null$/i.test(d.value)) col.default = d.value;
    }
    for (const t of doc.tables) {
        for (const ix of t._indexes) {
            const cols = ix.columns.map((n) => colOf(t, n)?.id).filter(Boolean);
            if (cols.length !== ix.columns.length) {
                warnings.push({ code: "index-column-missing", table: t.name });
                continue;
            }
            // a single-column unique index is the column's UNIQUE flag (as the editor shows it)
            t.indexes.push(
                createIndex({
                    name: ix.name,
                    columns: cols,
                    unique: ix.unique,
                    type: ix.type ?? null,
                }),
            );
        }
        delete t._indexes;
    }
    for (const ix of ctx.indexes) {
        const t = tableOf(ix.table);
        if (!t) {
            warnings.push({
                code: "index-table-missing",
                index: ix.name,
                table: ix.table,
            });
            continue;
        }
        const cols = ix.columns.map((n) => colOf(t, n)?.id).filter(Boolean);
        if (cols.length !== ix.columns.length) {
            warnings.push({ code: "index-column-missing", table: t.name });
            continue;
        }
        t.indexes.push(
            createIndex({
                name: ix.name,
                columns: cols,
                unique: ix.unique,
                type: ix.type ?? null,
            }),
        );
    }
    for (const cm of ctx.comments) {
        const t = tableOf(cm.table);
        if (!t) continue;
        if (cm.column) {
            const col = colOf(t, cm.column);
            if (col) col.note = cm.text;
        } else t.note = cm.text;
    }

    let refCount = 0;
    for (const r of ctx.refs) {
        const from = tableOf(r.fromTable);
        const to =
            tableOf(r.toSchema ? `${r.toSchema}.${r.toTable}` : r.toTable) ??
            tableOf(r.toTable);
        if (!from || !to) {
            warnings.push({
                code: "ref-table-missing",
                from: r.fromTable,
                to: r.toTable,
            });
            continue;
        }
        const fromCols = r.fromCols.map((n) => colOf(from, n));
        let toCols = r.toCols.map((n) => colOf(to, n));
        if (!toCols.length)
            toCols = to.columns.filter((c) => c.pk).slice(0, fromCols.length); // REFERENCES t  → its PK
        if (
            !fromCols.length ||
            fromCols.some((x) => !x) ||
            toCols.some((x) => !x) ||
            fromCols.length !== toCols.length
        ) {
            warnings.push({
                code: "ref-column-missing",
                from: r.fromTable,
                to: r.toTable,
            });
            continue;
        }
        // 1:1 when the FK column(s) are unique / the whole primary key
        const fk = fromCols.map((c) => c.id);
        const pkIds = from.columns.filter((c) => c.pk).map((c) => c.id);
        const unique =
            (fromCols.length === 1 && fromCols[0].unique) ||
            (pkIds.length === fk.length &&
                fk.every((id) => pkIds.includes(id))) ||
            from.indexes.some(
                (ix) =>
                    ix.unique &&
                    ix.columns.length === fk.length &&
                    fk.every((id) => ix.columns.includes(id)),
            );
        doc.refs.push(
            createRef({
                from: createRefEnd({
                    table: from.id,
                    columns: fk,
                    cardinality: unique ? "0..1" : "0..*",
                }),
                to: createRefEnd({
                    table: to.id,
                    columns: toCols.map((c) => c.id),
                    cardinality: fromCols.every((c) => c.notNull || c.pk)
                        ? "1"
                        : "0..1",
                }),
                onDelete: r.onDelete ?? null,
                onUpdate: r.onUpdate ?? null,
            }),
        );
        refCount++;
    }

    // PostgreSQL enum types: columns using them become inline enum(...) types
    if (ctx.enums.length) {
        const enumText = new Map(
            ctx.enums.map((e) => [
                e.name.toLowerCase(),
                `enum(${e.values.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(",")})`,
            ]),
        );
        for (const t of doc.tables)
            for (const col of t.columns) {
                const hit = enumText.get(col.type.toLowerCase());
                if (hit) col.type = hit;
            }
    }

    layoutGrid(doc);
    return {
        doc,
        warnings,
        stats: {
            tables: doc.tables.length,
            refs: refCount,
            skipped,
            statements: statementCount,
        },
    };
}
