import { relationKind } from "../document";
import { groupMembership } from "../geometry";
import { indexName } from "../indexes";
import { columnNames, resolveRefs } from "./common";

/**
 * Document → Markdown for an AI agent (or a human reviewer): a short guide first, then the whole
 * model with every note. Everything is text; positions and colors are left out on purpose, but the
 * section a table sits in is kept because it carries the author's grouping of the domain.
 */

const GUIDE = `## How to read this

This file describes a database design drawn in ERD Editor. It is documentation of the *intended*
schema, not a dump of a live database.

- **Columns** are listed as \`name  type  flags\`. Flags: \`PK\` primary key, \`FK\` foreign key,
  \`NOT NULL\`, \`UNIQUE\`, \`AUTO\` auto-increment, \`DEFAULT x\`. A column without \`NOT NULL\` is nullable.
- **Relationships** read "from → to". The *from* side holds the foreign key. Cardinality is written
  per end: \`1\` exactly one, \`0..1\` zero or one, \`1..*\` one or many, \`0..*\` zero or many.
  \`N:1\` means many rows of *from* point to one row of *to*.
- **Notes** are the author's own comments (on tables, columns, sections and the free sticky notes).
  Treat them as requirements or context; they are quoted as written.
- **Sections** group related tables by business area. They carry meaning but no technical effect.
- Names are exact identifiers. Do not rename or translate them.
`;

const q = (s) =>
    String(s)
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");

const cell = (s) =>
    String(s ?? "")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ");

export function toAgentMarkdown(doc, { guide = true } = {}) {
    const out = [];
    const { refs, warnings } = resolveRefs(doc);
    const title = doc.meta.name || "Untitled diagram";
    const fk = new Set();
    for (const r of doc.refs)
        for (const c of r.from.columns) fk.add(`${r.from.table}.${c}`);

    out.push(`# ${title}`, "");
    const facts = [
        `${doc.tables.length} table${doc.tables.length === 1 ? "" : "s"}`,
        `${doc.refs.length} relationship${doc.refs.length === 1 ? "" : "s"}`,
    ];
    if (doc.groups.length)
        facts.push(
            `${doc.groups.length} section${doc.groups.length === 1 ? "" : "s"}`,
        );
    if (doc.meta.dbType && doc.meta.dbType !== "generic")
        facts.push(`target database: ${doc.meta.dbType}`);
    out.push(facts.join(" · "), "");
    if (doc.meta.note) out.push(q(doc.meta.note), "");
    if (guide) out.push(GUIDE);

    const membership = groupMembership(doc);
    const sectionOf = (t) =>
        doc.groups.find((g) => g.id === membership.get(t.id));

    if (doc.groups.length) {
        out.push("## Sections", "");
        for (const g of doc.groups) {
            const members = doc.tables.filter(
                (t) => membership.get(t.id) === g.id,
            );
            out.push(
                `### ${g.name || "(unnamed)"}`,
                "",
                members.length
                    ? `Tables: ${members.map((t) => `\`${t.name}\``).join(", ")}`
                    : "No tables.",
                "",
            );
            if (g.note) out.push(q(g.note), "");
        }
    }

    out.push("## Tables", "");
    for (const t of doc.tables) {
        const sec = sectionOf(t);
        out.push(`### ${t.schema ? `${t.schema}.` : ""}${t.name}`, "");
        if (sec) out.push(`Section: ${sec.name}`, "");
        if (t.note) out.push(q(t.note), "");
        if (!t.columns.length) {
            out.push("_No columns._", "");
            continue;
        }
        out.push(
            "| Column | Type | Flags | Default | Note |",
            "|---|---|---|---|---|",
        );
        for (const c of t.columns) {
            const flags = [];
            if (c.pk) flags.push("PK");
            if (fk.has(`${t.id}.${c.id}`)) flags.push("FK");
            if (c.notNull || c.pk) flags.push("NOT NULL");
            if (c.unique && !c.pk) flags.push("UNIQUE");
            if (c.increment) flags.push("AUTO");
            out.push(
                `| \`${cell(c.name)}\` | \`${cell(c.type || "?")}\` | ${flags.join(", ")} | ${c.default ? `\`${cell(c.default)}\`` : ""} | ${cell(c.note)} |`,
            );
        }
        out.push("");
        const ixs = t.indexes.filter((ix) => columnNames(t, ix.columns).length);
        if (ixs.length) {
            out.push("Indexes:");
            for (const ix of ixs)
                out.push(
                    `- \`${indexName(t, ix)}\` (${columnNames(t, ix.columns).join(", ")})${ix.unique ? " UNIQUE" : ""}${ix.type ? ` ${ix.type}` : ""}`,
                );
            out.push("");
        }
    }

    if (doc.refs.length) {
        out.push("## Relationships", "");
        for (const { ref, from, to, fromCols, toCols } of refs) {
            const rule = [
                ref.onDelete ? `ON DELETE ${ref.onDelete}` : "",
                ref.onUpdate ? `ON UPDATE ${ref.onUpdate}` : "",
            ].filter(Boolean);
            out.push(
                `- \`${from.name}.${fromCols.join(",")}\` → \`${to.name}.${toCols.join(",")}\` — ${relationKind(ref)} (${ref.from.cardinality} → ${ref.to.cardinality})${rule.length ? `, ${rule.join(", ")}` : ""}${ref.label ? ` — ${ref.label}` : ""}`,
            );
        }
        out.push("");
    }

    const notes = (doc.notes ?? []).filter((n) => n.text.trim());
    if (notes.length) {
        out.push(
            "## Free notes",
            "",
            "Sticky notes the author placed on the canvas, not tied to one table.",
            "",
        );
        for (const n of notes) out.push(q(n.text), "");
    }

    const observations = [];
    for (const t of doc.tables) {
        if (!t.columns.length)
            observations.push(`\`${t.name}\` has no columns.`);
        else if (!t.columns.some((c) => c.pk))
            observations.push(`\`${t.name}\` has no primary key.`);
        for (const c of t.columns)
            if (!c.type)
                observations.push(`\`${t.name}.${c.name}\` has no type.`);
    }
    for (const w of warnings) {
        if (w.code === "ref-many-to-many")
            observations.push(
                `Many-to-many between \`${w.from}\` and \`${w.to}\` has no junction table yet.`,
            );
        else if (w.code === "ref-skipped")
            observations.push(
                "A relationship points at a missing table or column and was left out.",
            );
    }
    if (observations.length)
        out.push(
            "## Open points",
            "",
            ...observations.map((o) => `- ${o}`),
            "",
        );

    return {
        text:
            out
                .join("\n")
                .replace(/\n{3,}/g, "\n\n")
                .trimEnd() + "\n",
        warnings,
    };
}
