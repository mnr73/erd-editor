import { ref, shallowRef } from "vue";

import { defineStore } from "pinia";

import { rangeIds } from "@/model/columns";

export const TOOLS = ["select", "pan", "table", "relation"];

/**
 * Transient editor state (not saved in the file): active tool, selection, viewport size.
 * Selection holds ids of tables and groups (ids are globally unique); stale ids are pruned
 * when the document changes.
 */
export const useEditorStore = defineStore("editor", () => {
    const tool = ref("select");
    // Replaced (never mutated) on every change so shallow reactivity is enough.
    const selected = shallowRef(new Set());
    const viewportSize = ref({ w: 0, h: 0 });
    // Inline editing: which table name / column name is being typed right now, and the open
    // column popover. Values are ids; null = nothing. Not saved, not undoable.
    const renaming = ref(null); // { kind: "table" | "column", tableId, columnId? }
    const columnPopover = ref(null); // { tableId, columnId }
    // Index editor popover: { tableId, columns: [columnId] (prefilled new index), focus: indexId|null }
    const indexEditor = ref(null);
    // Selected columns of ONE table: { tableId, ids: Set, anchor } (anchor = last plain-clicked id,
    // the start of Shift ranges). Replaced, never mutated.
    const columnSelection = shallowRef(null);
    // Selected relationship (one at a time) and the line under the pointer. Not saved, not undoable.
    const selectedRefId = ref(null);
    const hoverRefId = ref(null);
    // Relation editor popover: { refId, anchor: {x,y} }
    const legendOpen = ref(false);
    const relationEditor = ref(null);
    const openRelationEditor = (refId, anchor) =>
        (relationEditor.value = { refId, anchor });
    const closeRelationEditor = () => (relationEditor.value = null);

    function setTool(next) {
        if (TOOLS.includes(next)) tool.value = next;
    }

    function selectRef(id) {
        selectedRefId.value = id;
        if (id) {
            selected.value = new Set();
            columnSelection.value = null;
        }
    }

    function setSelection(ids) {
        selected.value = new Set(ids);
        if (selected.value.size) selectedRefId.value = null;
        if (
            columnSelection.value &&
            !selected.value.has(columnSelection.value.tableId)
        )
            columnSelection.value = null;
    }
    const clearSelection = () => setSelection([]);

    function toggle(id) {
        const next = new Set(selected.value);
        if (!next.delete(id)) next.add(id);
        selected.value = next;
    }

    const isSelected = (id) => selected.value.has(id);

    /** Drop ids that no longer exist in the document. */
    function prune(validIds) {
        const next = [...selected.value].filter((id) => validIds.has(id));
        if (next.length !== selected.value.size) setSelection(next);
    }

    function selectColumn(table, id, { ctrl = false, shift = false } = {}) {
        const cur = columnSelection.value;
        const same = cur?.tableId === table.id;
        let ids;
        let anchor = id;
        if (shift && same) {
            anchor = cur.anchor;
            ids = new Set(rangeIds(table.columns, cur.anchor, id));
        } else if (ctrl && same) {
            ids = new Set(cur.ids);
            if (!ids.delete(id)) ids.add(id);
            anchor = cur.anchor;
        } else {
            ids = new Set([id]);
        }
        columnSelection.value = ids.size
            ? { tableId: table.id, ids, anchor }
            : null;
        if (columnSelection.value) {
            selected.value = new Set([table.id]);
            selectedRefId.value = null;
        }
    }
    const clearColumnSelection = () => (columnSelection.value = null);

    const startRename = (target) => (renaming.value = target);
    /**
     * Start renaming after the current mouse press has finished. Starting inside a `pointerdown`
     * handler is too early: the browser's own focus change that follows (mousedown default action)
     * blurs the freshly mounted input, which commits and closes it again.
     */
    const startRenameSoon = (target) =>
        setTimeout(() => startRename(target), 0);
    const stopRename = () => (renaming.value = null);
    const isRenaming = (kind, tableId, columnId = null) =>
        renaming.value?.kind === kind &&
        renaming.value.tableId === tableId &&
        (renaming.value.columnId ?? null) === columnId;

    const openColumnPopover = (tableId, columnId) =>
        (columnPopover.value = { tableId, columnId });
    const closeColumnPopover = () => (columnPopover.value = null);
    const openIndexEditor = (tableId, { columns = [], focus = null } = {}) =>
        (indexEditor.value = { tableId, columns, focus });
    const closeIndexEditor = () => (indexEditor.value = null);

    function setViewportSize(w, h) {
        viewportSize.value = { w, h };
    }

    return {
        tool,
        selected,
        viewportSize,
        setTool,
        setSelection,
        clearSelection,
        toggle,
        isSelected,
        prune,
        setViewportSize,
        renaming,
        columnPopover,
        indexEditor,
        openIndexEditor,
        closeIndexEditor,
        columnSelection,
        selectedRefId,
        hoverRefId,
        legendOpen,
        relationEditor,
        openRelationEditor,
        closeRelationEditor,
        selectRef,
        selectColumn,
        clearColumnSelection,
        startRename,
        startRenameSoon,
        stopRename,
        isRenaming,
        openColumnPopover,
        closeColumnPopover,
    };
});
