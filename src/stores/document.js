import { computed, ref, shallowRef } from "vue";

import { defineStore } from "pinia";

import {
    createColumn,
    createDocument,
    createGroup,
    createRef,
    createTable,
} from "@/model/document";
import { History } from "@/model/history";
import { serializeErd, snapshotErd } from "@/model/serialize";
import { parseErd } from "@/model/validate";

/**
 * The open document. Plain object state; every mutation goes through `commit()`, which
 * snapshots for undo/redo and marks the file dirty. Visual-only changes (view pan/zoom)
 * use `setView()` and are not undoable and not dirty.
 */
export const useDocumentStore = defineStore("document", () => {
    const doc = ref(createDocument());
    const path = shallowRef(null);
    const issues = shallowRef([]);
    const savedSnapshot = shallowRef(snapshotErd(doc.value));
    const history = shallowRef(new History(savedSnapshot.value));
    // bumped on undo/redo so `canUndo` / `canRedo` stay reactive (History is not reactive)
    const tick = ref(0);

    const dirty = computed(
        () => (tick.value, snapshotErd(doc.value) !== savedSnapshot.value),
    );
    const canUndo = computed(() => (tick.value, history.value.canUndo));
    const canRedo = computed(() => (tick.value, history.value.canRedo));
    const tableById = computed(
        () => new Map(doc.value.tables.map((t) => [t.id, t])),
    );

    /** Load parsed file text. Returns issues; `doc` stays untouched on a fatal issue. */
    function load(text, filePath = null) {
        const result = parseErd(text);
        issues.value = result.issues;
        if (!result.doc) return result.issues;
        doc.value = result.doc;
        path.value = filePath;
        savedSnapshot.value = snapshotErd(doc.value);
        history.value = new History(savedSnapshot.value);
        tick.value++;
        return result.issues;
    }

    function newDocument(name = "") {
        doc.value = createDocument(name);
        path.value = null;
        issues.value = [];
        savedSnapshot.value = snapshotErd(doc.value);
        history.value = new History(savedSnapshot.value);
        tick.value++;
    }

    /** Text to write to disk. Call `markSaved()` after the write succeeds. */
    function serialize() {
        return serializeErd(doc.value);
    }

    function markSaved(filePath = path.value) {
        path.value = filePath;
        savedSnapshot.value = snapshotErd(doc.value);
        tick.value++;
    }

    /** Apply `fn(doc)` as one undo step. `key` coalesces rapid edits (drag, typing). */
    function commit(fn, key = null) {
        fn(doc.value);
        history.value.record(snapshotErd(doc.value), { key });
        tick.value++;
    }

    function restore(snapshot) {
        if (snapshot === null) return;
        const { doc: restored } = parseErd(snapshot);
        // keep the current view, undo must not move the camera
        restored.view = doc.value.view;
        doc.value = restored;
        tick.value++;
    }
    const undo = () => restore(history.value.undo());
    const redo = () => restore(history.value.redo());

    function setView(view) {
        Object.assign(doc.value.view, view);
    }

    /* ------------------------------ mutations ------------------------------ */

    function addTable(partial = {}) {
        const table = createTable(partial);
        commit((d) => d.tables.push(table));
        return table.id;
    }

    function updateTable(id, patch, key = null) {
        commit(
            (d) => {
                const t = d.tables.find((x) => x.id === id);
                if (t) Object.assign(t, patch);
            },
            key && `${key}:${id}`,
        );
    }

    function removeTable(id) {
        commit((d) => {
            d.tables = d.tables.filter((t) => t.id !== id);
            d.refs = d.refs.filter(
                (r) => r.from.table !== id && r.to.table !== id,
            );
        });
    }

    function addColumn(tableId, partial = {}) {
        const column = createColumn(partial);
        commit((d) =>
            d.tables.find((t) => t.id === tableId)?.columns.push(column),
        );
        return column.id;
    }

    function updateColumn(tableId, columnId, patch, key = null) {
        commit(
            (d) => {
                const c = d.tables
                    .find((t) => t.id === tableId)
                    ?.columns.find((x) => x.id === columnId);
                if (c) Object.assign(c, patch);
            },
            key && `${key}:${columnId}`,
        );
    }

    /** Removes the column and everything that points at it (refs, index entries). */
    function removeColumn(tableId, columnId) {
        commit((d) => {
            const t = d.tables.find((x) => x.id === tableId);
            if (!t) return;
            t.columns = t.columns.filter((c) => c.id !== columnId);
            for (const ix of t.indexes)
                ix.columns = ix.columns.filter((c) => c !== columnId);
            t.indexes = t.indexes.filter((ix) => ix.columns.length);
            d.refs = d.refs.filter(
                (r) =>
                    !(
                        r.from.table === tableId &&
                        r.from.columns.includes(columnId)
                    ) &&
                    !(
                        r.to.table === tableId &&
                        r.to.columns.includes(columnId)
                    ),
            );
        });
    }

    function moveColumn(tableId, from, to) {
        commit((d) => {
            const cols = d.tables.find((t) => t.id === tableId)?.columns;
            if (!cols || from === to || !cols[from]) return;
            cols.splice(to, 0, cols.splice(from, 1)[0]);
        });
    }

    function addRef(partial = {}) {
        const r = createRef(partial);
        commit((d) => d.refs.push(r));
        return r.id;
    }

    function updateRef(id, patch) {
        commit((d) => {
            const r = d.refs.find((x) => x.id === id);
            if (r) Object.assign(r, patch);
        });
    }

    function removeRef(id) {
        commit((d) => (d.refs = d.refs.filter((r) => r.id !== id)));
    }

    function addGroup(partial = {}) {
        const g = createGroup(partial);
        commit((d) => d.groups.push(g));
        return g.id;
    }

    /** Move the frame and every member table by the same delta. */
    function moveGroup(id, dx, dy) {
        commit((d) => {
            const g = d.groups.find((x) => x.id === id);
            if (!g) return;
            g.x += dx;
            g.y += dy;
            for (const t of d.tables) {
                if (t.groupId === id) {
                    t.x += dx;
                    t.y += dy;
                }
            }
        }, `move-group:${id}`);
    }

    function removeGroup(id) {
        commit((d) => {
            d.groups = d.groups.filter((g) => g.id !== id);
            for (const t of d.tables) if (t.groupId === id) t.groupId = null;
        });
    }

    function addPaletteColor(hex) {
        commit((d) => {
            const c = hex.toLowerCase();
            if (!d.palette.includes(c)) d.palette.push(c);
        });
    }

    function removePaletteColor(hex) {
        commit(
            (d) =>
                (d.palette = d.palette.filter((c) => c !== hex.toLowerCase())),
        );
    }

    return {
        doc,
        path,
        issues,
        dirty,
        canUndo,
        canRedo,
        tableById,
        load,
        newDocument,
        serialize,
        markSaved,
        commit,
        undo,
        redo,
        setView,
        addTable,
        updateTable,
        removeTable,
        addColumn,
        updateColumn,
        removeColumn,
        moveColumn,
        addRef,
        updateRef,
        removeRef,
        addGroup,
        moveGroup,
        removeGroup,
        addPaletteColor,
        removePaletteColor,
    };
});
