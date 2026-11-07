---
name: erd-editor
description: Read, create and edit ERD Editor database diagrams (*.erd.json). Use when a project has an .erd.json file, when asked to design or change a database schema or tables, or to turn a SQL schema into an ERD Editor file.
---

# ERD Editor files (`*.erd.json`)

ERD Editor is a desktop app for database diagrams. **The whole diagram is one JSON file.** You can read and edit it as plain text; the user then opens it in the app. SQL, DBML, images and Markdown are generated from the file and are never the source.

- App and docs: https://github.com/mnr73/erd-editor
- Full format: `docs/FORMAT.md`. JSON Schema: `schema/erd.schema.json` (raw URLs below).
- This skill works for any coding agent. It is plain Markdown: no tool names, no special syntax.

## When to use it

- The user mentions an `.erd.json` file, "the ERD", "the diagram" or "the database design", or the repo contains one.
- You are asked to add/rename/remove tables, columns, indexes or relationships.
- You are asked to design a schema from requirements, or convert a SQL schema to an ERD file.
- You need to understand the data model before writing code: **read the file first**, it is more reliable than guessing from migrations.

## The 60-second model

```
document
├─ format: "erd-editor"        (constant, required)
├─ version: 1                  (integer, required; do not change it)
├─ meta   { name, dbType, note }       dbType: generic | mysql | postgres | sqlite | mssql
├─ tables [ { id, name, schema?, note?, columns[], indexes[], x, y, color?, collapsed? } ]
│    └─ column { id, name, type, pk?, unique?, notNull?, increment?, default?, note? }
├─ refs   [ { id, label?, from{table,columns[],cardinality}, to{...}, onDelete?, onUpdate?, note? } ]
├─ groups [ { id, name, x, y, w, h, color?, note? } ]      "sections" (visual grouping)
├─ notes  [ { id, text, x, y, w, h, color? } ]             free sticky notes
├─ enums  [ { id, name, values[{name,note?}] } ]           DBML export only (see pitfalls)
└─ view   { x, y, zoom }
```

Anything with a default value may be omitted: `false`, `null`, `""`, `[]`.

## Rules you must follow

1. **Every table, column, index, ref, group, note and enum has an `id`. References use ids, never names.** A ref says `"table": "t_orders"` and `"columns": ["c_orders_user"]`; an index lists column ids. Renaming a table or column therefore changes only `name`.
2. **Ids are unique across the file and never change or get reused.** Create new ones like the app does: a one-letter prefix, `_`, then a short lowercase alphanumeric string: `t_` table, `c_` column, `i_` index, `r_` ref, `g_` group, `n_` note, `e_` enum. Example `t_k3j9x2ab`. Readable ids like `t_orders`, `c_orders_user` are also valid and make diffs easier to review; pick one style and keep it.
3. **`from` is the child (the side that holds the foreign key); `to` is the parent.** `orders.user_id → users.id` is `from: orders.user_id`, `to: users.id`.
4. **A foreign key is not a column flag.** It exists only as a ref. To add an FK: add the column, then add a ref. The column's own `type` must match the parent's key type (`bigint` → `bigint`).
5. **Cardinality is per end** and says how many rows of that table relate to one row of the other: `"1"`, `"0..1"`, `"1..*"`, `"0..*"`. A normal one-to-many is `from.cardinality: "0..*"`, `to.cardinality: "1"`. The `from` side stays `"0..*"` either way. If the FK column is nullable, use `"0..1"` on the `to` side. A unique FK makes it one-to-one: `from: "0..1"` or `"1"`.
6. **Column order is meaningful** (it is the display and CREATE TABLE order). **Index column order is meaningful** too: `(status, user_id)` is not `(user_id, status)`.
7. **`type` is plain SQL text** (`bigint`, `varchar(255)`, `decimal(12,2)`, `datetime`, `enum('a','b')`, `jsonb`). Use types valid for `meta.dbType`. Unsigned is part of the text: `bigint unsigned` (MySQL only).
8. **Primary keys:** `pk: true` on the column(s). Several `pk` columns make a composite key. Auto-increment ids are usually `pk: true, increment: true, notNull: true`.
9. **Keep `x`/`y` sensible for new tables.** Put a new table to the right of or below existing ones with ~80 px of free space. A table is between 200 and 800 px wide (about 200 to 330 for a normal one) and 30 + 22 per column + about 8 px tall, so leave at least 340 px between the `x` of two tables in a row. Do not move existing tables unless asked. Do not stack a narrower table under a wider one if a relation joins them: put related tables side by side.
10. **Keep unknown keys.** If you see a key you do not know, leave it exactly as is. The app preserves them, and so should you.
11. **Do not bump `version`.** If the file has a higher `version` than the format you know, stop and tell the user to update this skill or the app.
12. **Notes are the author's requirements.** Read `note` fields (on tables, columns, refs, groups) and the free `notes[]` before designing. Do not delete or rewrite them unless asked; add new ones where they help a future reader.

## Editing safely

1. Read the whole file first (and `docs/FORMAT.md` when unsure).
2. Make the smallest change that does the job. Do not reformat the file or reorder keys.
3. Write 2-space indented JSON, one `columns` array entry per object.
4. **Validate** (see below). Fix every error and every warning you caused.
5. Tell the user what changed in database terms (tables/columns/relations), not as a JSON diff.

### Validate

Fastest, with the checker script (needs Node 22+, no install). It is one standalone file; run it from anywhere with its full path:

```sh
node /path/to/erd-editor/scripts/check-erd.mjs path/to/file.erd.json
```

It checks the JSON, `format`/`version`, unique ids, and that every ref/index points at an existing table and column, that both ends of a ref have the same number of columns, cardinalities and actions are valid, and that no two tables or two columns of one table share a name. It exits non-zero on any problem and prints one line per problem.

If the file lives in another project and you do not have the script, save it from
`https://raw.githubusercontent.com/mnr73/erd-editor/main/scripts/check-erd.mjs`, or validate with the JSON Schema
`https://raw.githubusercontent.com/mnr73/erd-editor/main/schema/erd.schema.json`
(the schema checks shape only, not that ids point at something).

## Recipes

### Add a table with an auto-increment id

```json
{
  "id": "t_invoices",
  "name": "invoices",
  "x": 780,
  "y": 80,
  "columns": [
    {
      "id": "c_invoices_id",
      "name": "id",
      "type": "bigint",
      "pk": true,
      "increment": true,
      "notNull": true
    }
  ]
}
```

Append it to `tables`. Add nothing else until it has the columns it needs.

### Add a foreign key (orders.user_id → users.id)

1. Add the column to `orders.columns`:
   `{ "id": "c_orders_user", "name": "user_id", "type": "bigint", "notNull": true }`
2. Add to `refs`:

```json
{
  "id": "r_orders_user",
  "label": "places",
  "from": {
    "table": "t_orders",
    "columns": ["c_orders_user"],
    "cardinality": "0..*"
  },
  "to": { "table": "t_users", "columns": ["c_users_id"], "cardinality": "1" },
  "onDelete": "cascade"
}
```

`onDelete` / `onUpdate`: `cascade`, `restrict`, `set null`, `set default`, `no action`. `set null` needs a nullable column (no `notNull`).

Then add an index on the FK column: every FK column should have one (see "Add an index" below).

### Add an index

On the table, `indexes` takes **column ids**:

```json
{
  "id": "i_orders_status_user",
  "columns": ["c_orders_status", "c_orders_user"],
  "unique": false
}
```

`name` is optional (exporters generate `<table>_<cols>_idx`). A single-column `unique: true` index is usually better written as `unique: true` on the column.

### Many-to-many

There is no direct m:n. Create a junction table with two FK columns, two refs (each `0..*` → `1`) and a composite primary key (`pk: true` on both FK columns, or a surrogate `id`). Name it after the relationship (`order_items`, `post_tags`).

### Enum column

Use a column type `enum('draft','published')` (MySQL gets a real ENUM; other databases get `varchar` + `CHECK`, reported as a warning). The top-level `enums` array is exported to DBML only; it is not shown in the app's UI or used by the SQL export, so do not rely on it for the schema.

### Rename

Change only `name` (table or column). Do **not** touch ids or any ref/index.

### Delete a column or table

Remove the column, then **every ref and index that mentions its id**. For a table, remove its refs (as `from` or `to`) and then the table. Leaving a dangling id is the most common mistake and the validator will flag it.

### From SQL to an ERD file

Create each `CREATE TABLE` as a table (columns in order, `pk`, `notNull`, `unique`, `increment`, `default` mapped), each `FOREIGN KEY` as a ref (`from` = the table with the FK; cardinality `0..*` / `1`, or `0..1` on `to` when the FK column is nullable, or `0..1` on `from` when the FK is unique), each non-primary `INDEX` as an index. Set `meta.dbType`. Lay tables on a grid (about 300 px per column of tables). The app can also do this itself: Ctrl+Shift+I (Import SQL) opens a SQL file as a new board; prefer asking the user to do that for big dumps.

### Start a new file

```json
{
  "format": "erd-editor",
  "version": 1,
  "meta": { "name": "my-project", "dbType": "postgres" },
  "tables": [],
  "view": { "x": 0, "y": 0, "zoom": 1 }
}
```

Use the extension `.erd.json` (the app only opens that).

## Design guidance (when asked to design a schema)

- Ask or decide `meta.dbType` first; it drives type names.
- Singular or plural table names: follow what the project already does; otherwise plural snake_case (`order_items`).
- Every table gets a primary key. Every FK column gets an index (the database does not always create one).
- Mark `notNull` deliberately: required fields `notNull: true`, optional ones left nullable. Do not add `notNull` to a column used with `onDelete: "set null"`.
- Use `decimal(p,s)` for money, never float. Use `timestamp`/`datetime` consistently (`created_at`, `updated_at`).
- Put one-sentence `note`s on non-obvious columns (status values, units, why it is nullable). The notes travel into every export.
- Group tables into `groups` (sections) by business area when there are more than ~8 tables.
- Put a short `meta.note` describing the project's purpose.

## Pitfalls

- **Names instead of ids** in `refs` or `indexes`: invalid. The validator reports `ref-table-missing`, `ref-column-missing`, `index-column-missing`.
- **Duplicate ids** make the app refuse the whole file (`duplicate-id`).
- **`columns` of a ref is an array** even for one column, and both ends must have the same length.
- **Invalid cardinality** like `"1..n"` or `"many"`: only `1`, `0..1`, `1..*`, `0..*`.
- **Colors** are `#RRGGBB` (six hex digits, any case). `null` or omitted means default.
- **A new table does not join a section by itself.** It is in a section only if its whole rectangle lies inside the section's. If you place a table next to an existing section and the user did not ask for it to be in the section, put it outside, with a gap. Only enlarge a section (`w`/`h`) when asked.
- **Section membership is not stored.** A table belongs to a group only because its rectangle lies completely inside the group's. Moving a table out of the rectangle removes it from the group. To "add a table to a group", place it inside the group's `x/y/w/h`.
- **The file is rewritten by the app in canonical form** (fixed key order, defaults dropped) the next time the user saves. Your edits do not need to match that exactly, but avoid noisy changes.
- **Do not invent features.** If you need something the format has no field for, put it in a `note` and tell the user.

## Reading a diagram for context (no editing)

For a quick read, list tables with their columns and relations. The app's own **Export → Agent (Markdown)** produces a briefing with a how-to-read guide, every table, relation and note; if the user can open the app, asking for that is the most complete view. Without it: read `tables`, resolve each ref's ids to names, and treat notes as requirements.
