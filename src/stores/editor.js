import { ref, shallowRef } from "vue";

import { defineStore } from "pinia";

export const TOOLS = ["select", "pan"];

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
    };
});
