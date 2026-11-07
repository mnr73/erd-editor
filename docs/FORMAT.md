# `.erd.json` file format (version 1)

One JSON file is the single source of truth. DBML / SQL / PNG / SVG are exports only.
Machine-readable schema: [`schema/erd.schema.json`](../schema/erd.schema.json). For AI agents there is a ready-made [skill](../skills/erd-editor/SKILL.md) and a checker (`node scripts/check-erd.mjs file.erd.json`).
Reference implementation: `src/model/`.

## Principles

1. **Stable ids.** Every table, column, ref, group, enum and index has an `id` that never changes. Names can be renamed freely without touching references.
2. **Core vs. visual.** Core (`tables[].columns`, `refs`, `enums`, `indexes`) maps to DBML. Visual data (`x`, `y`, `color`, `collapsed`, `groups`, `view`, `noteVisible`) is ignored by exporters.
3. **Clean diffs.** The serializer writes keys in a fixed order, 2-space indent, arrays in document order, and **omits default values** (`false`, `null`, `""`, `[]`).
4. **Unknown keys survive.** Anything the app does not know is kept and written back after the known keys (sorted), so an older app never destroys newer data.
5. **Versioned.** `version` is an integer; `migrate()` upgrades older files. A file with a _newer_ version than the app supports is refused (never silently downgraded).

## Top level

```jsonc
{
  "format": "erd-editor", // required, constant
  "version": 1, // required, integer
  "meta": { "name": "erp", "dbType": "mysql", "note": "" },
  "palette": ["#14B8A6"], // user-added colors only (defaults live in the app)
  "tables": [],
  "refs": [],
  "groups": [],
  "notes": [],
  "enums": [],
  "view": { "x": 0, "y": 0, "zoom": 1 },
}
```

`dbType`: `"generic" | "mysql" | "postgres" | "sqlite" | "mssql"` (used by SQL export only).

## Table

```jsonc
{
  "id": "t_k3j9x2ab",
  "name": "orders",
  "schema": "public", // optional
  "color": "#4C8DFF", // header color, or null
  "note": "text", // optional
  "noteVisible": true, // note pinned on canvas (default false)
  "x": 120,
  "y": 80, // canvas position (world units)
  "collapsed": false,
  "columns": [/* Column */],
  "indexes": [/* Index */],
}
```

## Column

| key         | type   | default | meaning                                                          |
| ----------- | ------ | ------- | ---------------------------------------------------------------- |
| `id`        | string | —       | stable id                                                        |
| `name`      | string | —       | column name                                                      |
| `type`      | string | `""`    | raw SQL type, e.g. `varchar(255)`, `bigint unsigned` (see below) |
| `pk`        | bool   | false   | primary key (several columns ⇒ composite PK)                     |
| `unique`    | bool   | false   |                                                                  |
| `notNull`   | bool   | false   | absent = nullable                                                |
| `increment` | bool   | false   | auto-increment                                                   |
| `default`   | string | ""      | raw default expression, e.g. `0`, `'draft'`, `now()`             |
| `note`      | string | ""      | comment                                                          |

FK is **not** a column flag: it is derived from `refs`.

## Index

`{ "id", "name"?, "columns": [columnId, ...], "unique"?: bool, "type"?: "btree"|"hash" }`

- `columns` has one or more column ids; **the order is the index order** (leftmost-prefix rule), so a composite index `(status, customer_id)` is not the same as `(customer_id, status)`.
- `name` is optional. Exporters generate `<table>_<col1>_<col2>_idx` (`_uq` when `unique`) when it is empty.
- Deleting a column removes it from every index; an index left with no columns is deleted.
- Validation warns on `index-empty`, `index-duplicate-column` and `index-column-missing`.

## Ref (relationship)

```jsonc
{
  "id": "r_8f2k1m0q",
  "label": "places", // optional, shown on the line
  "from": {
    "table": "t_orders",
    "columns": ["c_user_id"],
    "cardinality": "0..*",
  },
  "to": { "table": "t_users", "columns": ["c_id"], "cardinality": "1" },
  "onDelete": "cascade", // optional
  "onUpdate": "no action", // optional
  "note": "",
}
```

- **Convention:** `from` is the side holding the foreign key (child), `to` is the referenced side (parent).
- `columns` is an array to support composite keys; both sides must have the same length. The UI draws the line on the first column.
- `cardinality` is per endpoint (what that table can have _per row on the other side_), one of:

| value    | notation     | Crow's Foot end |
| -------- | ------------ | --------------- |
| `"1"`    | exactly one  | `‖`             |
| `"0..1"` | zero or one  | `○              | `   |
| `"1..*"` | one or many  | `               | <`  |
| `"0..*"` | zero or many | `○<`            |

- The relation kind (1:1, 1:N, N:1, N:M) is **derived** from the two max values (`1` vs `*`); it is not stored.
- `onDelete` / `onUpdate`: `"cascade" | "restrict" | "set null" | "set default" | "no action"`.

## Group (Section)

```jsonc
{
  "id": "g_...",
  "name": "Sales",
  "color": "#E8B54A",
  "note": "",
  "noteVisible": false, // note pinned on canvas
  "x": 0,
  "y": 0,
  "w": 800,
  "h": 500,
  "collapsed": false,
}
```

**Membership is not stored.** A table (or group) belongs to the innermost group that contains it _completely_ (`groupAt` in `src/model/geometry.js`). Dragging a table out of the frame, or resizing the frame, changes membership automatically. Moving a group moves everything completely inside it by the same delta. (`groupId` from early drafts is ignored on load.)

## Enum

`{ "id", "name", "values": [ { "name": "draft", "note"?: "" } ], "note"?: "" }`

## View

`{ "x", "y", "zoom" }` — last pan/zoom.

## Validation

`validate()` returns `{ doc, issues }`.

| level   | when                                                                                                   | result                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `fatal` | not an object, wrong `format`, bad/newer `version`, duplicate ids, wrong types of core containers      | `doc` is `null`, file is not opened                                                          |
| `warn`  | dangling ref/index reference, duplicate table or column names, bad color/cardinality, unknown `dbType` | `doc` is opened, bad values are repaired or kept, and listed in `issues` (shown as a banner) |

## Change log

- v1 — initial.

## Column types

`type` is always plain text: the file never stores a parsed form, so DBML / SQL export and hand
editing stay trivial. The editor's type picker reads this text with `parseType` (`src/model/types.js`)
and writes it back with `formatType`:

- Catalog types (`int`, `varchar(n)`, `decimal(p,s)`, `datetime(fsp)`, `enum('a','b')`, ...) are shown as a
  type select plus one field per parameter (length, precision, scale, fraction), clamped to the type's
  range; the scale never exceeds the precision.
- Modifiers: `unsigned` (suffix; offered for MySQL integer types) and `[]` (array, PostgreSQL).
- Types the database does not have are hidden from the select (`meta.dbType`), except the type the
  column already has.
- Anything else (`geometry(Point,4326)`, a custom domain, ...) is kept verbatim and edited as free text.
  A file is never rewritten just because it was opened.

## Free notes

Sticky notes placed anywhere on the canvas. They are independent of tables and sections (unlike the
`note` / `noteVisible` pair of a table or section, which belongs to that item). Visual and
documentation data: exporters ignore the position, the agent export includes the text.

```jsonc
{
  "id": "n_...",
  "text": "TODO: split orders", // may be multi-line
  "color": "#4CB86B", // or null / absent = the default amber
  "x": 120,
  "y": 80,
  "w": 220, // min 80
  "h": 140, // min 80
}
```

`notes` is optional and omitted when empty, so files written before this existed are unchanged. Like
tables, a note inside a section that is moved moves with it (it must lie completely inside).

## Exports and import

The `.erd.json` file is the only source of truth; everything below is generated from it.

| Output            | What is kept                                                                                                                                          | What is left out                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| SQL (per dialect) | tables, columns, types, PK, NOT NULL, UNIQUE, defaults, auto-increment, indexes (order, unique, type), foreign keys with ON DELETE / UPDATE, comments | positions, colors, sections, free notes; many-to-many refs (no single FK) |
| DBML              | all of the above plus `headercolor`, sections as `TableGroup`, free notes as `Note`                                                                   | positions, sizes                                                          |
| Agent Markdown    | everything with its notes, sections, a how-to-read guide, open points                                                                                 | positions, colors                                                         |
| SVG / PNG         | what the canvas shows                                                                                                                                 | nothing                                                                   |

Anything a database cannot express is converted and reported, never dropped silently (ENUM → `varchar` + `CHECK` outside MySQL, `unsigned` outside MySQL, arrays outside PostgreSQL).

SQL import reads `CREATE TABLE` (columns, types, `NOT NULL`, `DEFAULT`, auto-increment / identity / serial, `PRIMARY KEY`, `UNIQUE`, inline and table-level foreign keys, MySQL `COMMENT`), `CREATE [UNIQUE] INDEX`, `ALTER TABLE … ADD FOREIGN KEY / PRIMARY KEY / UNIQUE` and `ALTER COLUMN … SET DEFAULT`, `COMMENT ON`, `CREATE TYPE … AS ENUM`. Data, views, triggers and grants are skipped and counted. A foreign key becomes a relationship: `0..*` on the FK side (`0..1` when the FK is unique), `1` on the referenced side (`0..1` when the FK column is nullable).
