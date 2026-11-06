import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "@/stores/editor";

const memory = new Map();
globalThis.localStorage = {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
};

let e;
beforeEach(() => {
    setActivePinia(createPinia());
    e = useEditorStore();
    e.setInspectorOpen(true);
});

const table = { id: "t1", columns: [{ id: "a" }, { id: "b" }, { id: "c" }] };

describe("Inspector routing in the editor store", () => {
    it("with the panel open, a column editor opens in the panel, not as a popover", () => {
        e.openColumnPopover("t1", "b");
        expect(e.columnPopover).toBeNull();
        expect(e.inspectorColumn).toEqual({ tableId: "t1", columnId: "b" });
        expect(e.inspectorTab).toBe("columns");
        expect([...e.selected]).toEqual(["t1"]);
        expect(e.activeColumn).toEqual({ tableId: "t1", columnId: "b" });
    });

    it("with the panel closed, the popover is used as before", () => {
        e.setInspectorOpen(false);
        e.openColumnPopover("t1", "b");
        expect(e.columnPopover).toEqual({ tableId: "t1", columnId: "b" });
        expect(e.inspectorColumn).toBeNull();
        expect(e.activeColumn).toEqual({ tableId: "t1", columnId: "b" });
    });

    it("notes and relation lines go to the panel when it is open", () => {
        e.openNoteEditor("t1");
        expect(e.noteEditor).toBeNull();
        expect(e.inspectorTab).toBe("note");
        e.openRelationEditor("r1", { x: 1, y: 1 });
        expect(e.relationEditor).toBeNull();
        expect(e.selectedRefId).toBe("r1");
        e.setInspectorOpen(false);
        e.openNoteEditor("t1");
        expect(e.noteEditor).toBe("t1");
    });

    it("selecting a column of a table selects only that table and opens it in the Columns tab", () => {
        e.selectColumn(table, "b");
        expect(e.inspectorColumn).toEqual({ tableId: "t1", columnId: "b" });
        e.selectColumn(table, "c", { shift: true });
        expect(e.columnSelection.ids.size).toBe(2); // range b..c, panel keeps the first single pick
    });

    it("selecting something else closes the expanded column", () => {
        e.openColumnPopover("t1", "b");
        e.setSelection(["t2"]);
        expect(e.inspectorColumn).toBeNull();
        expect(e.activeColumn).toBeNull();
    });

    it("a line opened from a table remembers where to go back to, any other selection forgets it", () => {
        e.selectRef("r1", { back: "t1" });
        expect(e.inspectorBack).toBe("t1");
        e.selectRef("r2");
        expect(e.inspectorBack).toBeNull();
        e.selectRef("r1", { back: "t1" });
        e.selectRef(null);
        expect(e.inspectorBack).toBeNull();
    });

    it("the open / closed state is remembered", () => {
        e.setInspectorOpen(false);
        expect(localStorage.getItem("erd-editor.inspector")).toBe("0");
        e.toggleInspector();
        expect(e.inspectorOpen).toBe(true);
        expect(localStorage.getItem("erd-editor.inspector")).toBe("1");
    });
});
