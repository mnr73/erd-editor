import { relationKind } from "./document";
import { groupAt, groupMembership, tableRect } from "./geometry";

/**
 * What the Inspector shows, as a pure function of the document and the selection.
 * Returns { mode, ... } with mode one of:
 *   "none"   nothing selected
 *   "table"  exactly one table
 *   "group"  exactly one section
 *   "note"   exactly one free note
 *   "ref"    one relationship line
 *   "multi"  several tables / sections
 */
export function inspectorTarget(
    doc,
    { tableIds = [], groupIds = [], noteIds = [], refId = null },
) {
    if (refId) {
        const ref = doc.refs.find((r) => r.id === refId);
        if (ref) return { mode: "ref", ref };
    }
    const tables = doc.tables.filter((t) => tableIds.includes(t.id));
    const groups = doc.groups.filter((g) => groupIds.includes(g.id));
    const notes = (doc.notes ?? []).filter((n) => noteIds.includes(n.id));
    const total = tables.length + groups.length + notes.length;
    if (total === 0) return { mode: "none" };
    if (total > 1) return { mode: "multi", tables, groups, notes };
    if (tables.length === 1) return { mode: "table", table: tables[0] };
    if (notes.length === 1) return { mode: "note", note: notes[0] };
    return { mode: "group", group: groups[0] };
}

/** Section a table currently sits in (derived from geometry), or null. */
export function sectionOfTable(doc, table) {
    const id = groupAt(doc, tableRect(table));
    return id ? doc.groups.find((g) => g.id === id) : null;
}

/** Tables completely inside a section. */
export function tablesInSection(doc, groupId) {
    const m = groupMembership(doc);
    return doc.tables.filter((t) => m.get(t.id) === groupId);
}

/**
 * Relationships of a table for the Relations tab: the other end first, then "this.col → that.col",
 * and the kind seen from this table's point of view.
 */
export function relationsOfTable(doc, tableId) {
    const name = (id) => doc.tables.find((t) => t.id === id);
    const colNames = (end) => {
        const tb = name(end.table);
        return end.columns
            .map((c) => tb?.columns.find((x) => x.id === c)?.name ?? "?")
            .join(", ");
    };
    return doc.refs
        .filter((r) => r.from.table === tableId || r.to.table === tableId)
        .map((r) => {
            const mineIsFrom = r.from.table === tableId;
            const mine = mineIsFrom ? r.from : r.to;
            const other = mineIsFrom ? r.to : r.from;
            return {
                id: r.id,
                otherTable: name(other.table)?.name ?? "?",
                other: `${name(other.table)?.name ?? "?"}.${colNames(other)}`,
                mine: `${name(mine.table)?.name ?? "?"}.${colNames(mine)}`,
                kind: relationKind(r),
                label: r.label,
            };
        });
}

/** Counts shown in the footer / stat tiles. */
export function docStats(doc) {
    return {
        tables: doc.tables.length,
        refs: doc.refs.length,
        groups: doc.groups.length,
        notes: (doc.notes ?? []).length,
    };
}

/** Next column to select after deleting `removedIndex`: the one that took its place, else the last. */
export function columnAfterRemoval(columns, removedIndex) {
    if (!columns.length) return null;
    return columns[Math.min(removedIndex, columns.length - 1)].id;
}
