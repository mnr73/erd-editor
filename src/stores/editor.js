import { ref, shallowRef } from "vue";

import { defineStore } from "pinia";

export const TOOLS = ["select", "pan", "table"];

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

    function setTool(next) {
        if (TOOLS.includes(next)) tool.value = next;
    }

    function setSelection(ids) {
        selected.value = new Set(ids);
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
        startRename,
        startRenameSoon,
        stopRename,
        isRenaming,
        openColumnPopover,
        closeColumnPopover,
    };
});
