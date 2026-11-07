import { computed, ref, shallowRef } from "vue";

import { defineStore } from "pinia";

import { rangeIds } from "@/model/columns";

const INSPECTOR_KEY = "erd-editor.inspector";
const readInspectorOpen = () => {
    try {
        return localStorage.getItem(INSPECTOR_KEY) !== "0";
    } catch {
        return true;
    }
};

export const TOOLS = ["select", "pan", "table", "relation", "section", "note"];

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
    // Inspector (right panel). When it is open, editing a column / line / note happens there instead
    // of in a popover. `inspectorColumn` = the column expanded in its Columns tab.
    const inspectorOpen = ref(readInspectorOpen());
    const inspectorTab = ref("table"); // table | columns | rels | note
    const inspectorColumn = ref(null); // { tableId, columnId }
    const inspectorBack = ref(null); // table to return to from a relationship opened out of its list
    function setInspectorOpen(v) {
        inspectorOpen.value = v;
        try {
            localStorage.setItem(INSPECTOR_KEY, v ? "1" : "0");
        } catch {
            /* storage unavailable: the panel just won't be remembered */
        }
    }
    const toggleInspector = () => setInspectorOpen(!inspectorOpen.value);
    // Note editor popover: the id of the table / section whose note is open
    const noteEditor = ref(null);
    function openNoteEditor(id) {
        if (inspectorOpen.value) {
            selectedRefId.value = null;
            selected.value = new Set([id]);
            inspectorTab.value = "note";
            return;
        }
        noteEditor.value = id;
    }
    const closeNoteEditor = () => (noteEditor.value = null);
    const relationEditor = ref(null);
    function openRelationEditor(refId, anchor) {
        if (inspectorOpen.value) return selectRef(refId);
        relationEditor.value = { refId, anchor };
    }
    const closeRelationEditor = () => (relationEditor.value = null);

    function setTool(next) {
        if (TOOLS.includes(next)) tool.value = next;
    }

    /** `back` = the table to return to from the Inspector; any other way of selecting clears it. */
    function selectRef(id, { back = null } = {}) {
        selectedRefId.value = id;
        inspectorBack.value = id ? back : null;
        if (id) {
            selected.value = new Set();
            columnSelection.value = null;
        }
    }

    function setSelection(ids) {
        selected.value = new Set(ids);
        if (selected.value.size) selectedRefId.value = null;
        const ic = inspectorColumn.value;
        if (
            ic &&
            !(selected.value.size === 1 && selected.value.has(ic.tableId))
        )
            inspectorColumn.value = null;
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
            if (inspectorOpen.value && ids.size === 1) {
                inspectorColumn.value = { tableId: table.id, columnId: id };
                inspectorTab.value = "columns";
            }
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

    // Help dialog (modal): tab = "icons" | "about" | "shortcuts"
    const helpOpen = ref(false);
    const helpTab = ref("icons");
    const openHelp = (tab = null) => {
        if (tab) helpTab.value = tab;
        helpOpen.value = true;
    };
    const closeHelp = () => (helpOpen.value = false);
    const toggleHelp = () => (helpOpen.value ? closeHelp() : openHelp());

    // "New board" chooser (modal, not saved)
    const newOpen = ref(false);
    const openNew = () => (newOpen.value = true);
    const closeNew = () => (newOpen.value = false);

    // Export / import dialogs (modal, not saved)
    const exportOpen = ref(false);
    const importOpen = ref(false);
    // "selection" = only what is selected (opened from a menu); "all" = the whole board
    const exportScope = ref("all");
    const openExport = (scope = "all") => {
        exportScope.value = scope;
        exportOpen.value = true;
    };
    const closeExport = () => (exportOpen.value = false);
    const openImport = () => (importOpen.value = true);
    const closeImport = () => (importOpen.value = false);

    // free sticky note whose text is being typed on the canvas (not saved, not undoable)
    const editingNote = ref(null);
    const startNoteEdit = (id) => (editingNote.value = id);
    /** Same timing issue as `startRenameSoon`: the press that created the note would blur it. */
    const startNoteEditSoon = (id) => setTimeout(() => startNoteEdit(id), 0);
    const stopNoteEdit = () => (editingNote.value = null);
    const isRenamingGroup = (groupId) =>
        renaming.value?.kind === "group" && renaming.value.groupId === groupId;
    const isRenaming = (kind, tableId, columnId = null) =>
        renaming.value?.kind === kind &&
        renaming.value.tableId === tableId &&
        (renaming.value.columnId ?? null) === columnId;

    function openColumnPopover(tableId, columnId) {
        if (inspectorOpen.value) {
            selectedRefId.value = null;
            selected.value = new Set([tableId]);
            inspectorColumn.value = { tableId, columnId };
            inspectorTab.value = "columns";
            return;
        }
        columnPopover.value = { tableId, columnId };
    }
    /** The column whose editor is open (popover or Inspector): its row stays highlighted on the canvas. */
    const activeColumn = computed(() => {
        if (columnPopover.value) return columnPopover.value;
        const ic = inspectorColumn.value;
        return inspectorOpen.value &&
            inspectorTab.value === "columns" &&
            ic &&
            selected.value.size === 1 &&
            selected.value.has(ic.tableId)
            ? ic
            : null;
    });
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
        inspectorOpen,
        inspectorTab,
        inspectorColumn,
        inspectorBack,
        setInspectorOpen,
        toggleInspector,
        activeColumn,
        noteEditor,
        openNoteEditor,
        closeNoteEditor,
        relationEditor,
        openRelationEditor,
        closeRelationEditor,
        selectRef,
        selectColumn,
        clearColumnSelection,
        startRename,
        startRenameSoon,
        stopRename,
        helpOpen,
        helpTab,
        openHelp,
        closeHelp,
        toggleHelp,
        exportOpen,
        exportScope,
        importOpen,
        newOpen,
        openNew,
        closeNew,
        openExport,
        closeExport,
        openImport,
        closeImport,
        editingNote,
        startNoteEdit,
        startNoteEditSoon,
        stopNoteEdit,
        isRenaming,
        isRenamingGroup,
        openColumnPopover,
        closeColumnPopover,
    };
});
