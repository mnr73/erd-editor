import { movedWith } from "../geometry";

/**
 * The part of a document that a selection stands for, as a document of its own (pure, no copies of
 * the tables: exporters only read). Used by "export selection".
 *
 *  - a selected table is included;
 *  - a selected section brings everything completely inside it (tables, nested sections, free
 *    notes), the same rule that moves them together on the canvas;
 *  - a selected free note is included;
 *  - a relationship is included only when BOTH of its tables are; the others are counted in `cut`
 *    so the UI can say how many lines were left out.
 *
 * Returns { doc, counts: { tables, refs, groups, notes }, cut }.
 */
export function subsetDocument(doc, ids) {
    const { tables, groups, notes } = movedWith(
        { ...doc, notes: doc.notes ?? [] },
        [...ids],
    );
    const keepTables = doc.tables.filter((t) => tables.has(t.id));
    const have = new Set(keepTables.map((t) => t.id));
    const refs = doc.refs.filter(
        (r) => have.has(r.from.table) && have.has(r.to.table),
    );
    const cut = doc.refs.filter(
        (r) => have.has(r.from.table) !== have.has(r.to.table),
    ).length;
    const sub = {
        ...doc,
        tables: keepTables,
        groups: doc.groups.filter((g) => groups.has(g.id)),
        notes: (doc.notes ?? []).filter((n) => notes.has(n.id)),
        refs,
    };
    return {
        doc: sub,
        counts: {
            tables: sub.tables.length,
            refs: sub.refs.length,
            groups: sub.groups.length,
            notes: sub.notes.length,
        },
        cut,
    };
}
