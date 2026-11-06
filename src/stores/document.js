import { computed, markRaw, ref } from "vue";

import { defineStore } from "pinia";

import { moveSelection } from "@/model/columns";
import {
    DEFAULT_FROM_CARDINALITY,
    DEFAULT_TO_CARDINALITY,
} from "@/model/constants";
import {
    cloneTable,
    createColumn,
    createDefaultTable,
    createDocument,
    createGroup,
    createIndex,
    createRef,
    createRefEnd,
    createTable,
} from "@/model/document";
import { movedWith } from "@/model/geometry";
import { History } from "@/model/history";
import { findSameIndex, inTableOrder } from "@/model/indexes";
import { nextName, uniqueName } from "@/model/names";
import { serializeErd, snapshotErd } from "@/model/serialize";
import { parseErd } from "@/model/validate";

let tabSeq = 0;

/** One open document: its content, file path, saved baseline and own undo history. */
function createTab(
    document = createDocument(),
    path = null,
    issues = [],
    fresh = false,
) {
    const baseline = snapshotErd(document);
    return {
        id: `tab_${++tabSeq}`,
        doc: document,
        path,
        issues,
        // untouched start-up tab: the UI shows the start page (new board / open file) instead of a canvas
        fresh,
        savedSnapshot: baseline,
        // not reactive on purpose: changes are announced through `tick`
        history: markRaw(new History(baseline)),
    };
}

/**
 * The open documents (tabs). Everything outside this file sees ONE document, the active tab, through
 * `doc`, `path`, `dirty`, `undo()`, ...; tabs only add `tabs`, `activeId`, `newTab()`, `closeTab()`.
 * Every mutation goes through `commit()`, which snapshots for undo/redo and marks the file dirty.
 * Visual-only changes (view pan/zoom) use `setView()` and are not undoable and not dirty.
 */
export const useDocumentStore = defineStore("document", () => {
    const tabs = ref([createTab(createDocument(), null, [], true)]);
    const activeId = ref(tabs.value[0].id);
    // bumped on every change so `canUndo` / `canRedo` / `dirty` stay reactive (History is not reactive)
    const tick = ref(0);
    // bumped when a different document is shown (load, new, tab switch), NOT on undo/redo:
    // the canvas re-fits its camera and clears the selection
    const loadId = ref(0);

    const active = computed(() =>
        tabs.value.find((t) => t.id === activeId.value),
    );
    const doc = computed({
        get: () => active.value.doc,
        set: (v) => (active.value.doc = v),
    });
    const path = computed({
        get: () => active.value.path,
        set: (v) => (active.value.path = v),
    });
    const issues = computed(() => active.value.issues);
    const isFresh = computed(() => active.value.fresh);

    const isDirty = (tab) => snapshotErd(tab.doc) !== tab.savedSnapshot;
    const dirty = computed(() => (tick.value, isDirty(active.value)));
    const canUndo = computed(() => (tick.value, active.value.history.canUndo));
    const canRedo = computed(() => (tick.value, active.value.history.canRedo));
    const tableById = computed(
        () => (tick.value, new Map(doc.value.tables.map((t) => [t.id, t]))),
    );
    /** Lightweight list for the tab bar. */
    const tabList = computed(() => {
        void tick.value;
        return tabs.value.map((t) => ({
            id: t.id,
            path: t.path,
            name: t.doc.meta.name,
            dirty: isDirty(t),
            fresh: t.fresh,
            active: t.id === activeId.value,
        }));
    });

    function shown() {
        tick.value++;
        loadId.value++;
    }

    /** Replace the ACTIVE tab with parsed file text. Returns issues; nothing changes on a fatal one. */
    function load(text, filePath = null) {
        const result = parseErd(text);
        if (!result.doc) {
            active.value.issues = result.issues;
            return result.issues;
        }
        Object.assign(
            active.value,
            createTab(result.doc, filePath, result.issues),
            {
                id: active.value.id,
            },
        );
        shown();
        return result.issues;
    }

    function newDocument(name = "") {
        Object.assign(active.value, createTab(createDocument(name)), {
            id: active.value.id,
        });
        shown();
    }

    /** An untitled, untouched tab can be reused instead of opening yet another one. */
    const isPristine = (tab) =>
        !tab.path &&
        !isDirty(tab) &&
        !tab.doc.tables.length &&
        !tab.doc.groups.length;

    /**
     * Open file text in a tab: an already open path is just activated; a pristine untitled tab is
     * reused; otherwise a new tab is added. Returns { id, issues } (id null on a fatal issue).
     */
    function openText(text, filePath = null) {
        const same = filePath && tabs.value.find((t) => t.path === filePath);
        if (same) {
            activateTab(same.id);
            return { id: same.id, issues: same.issues };
        }
        const result = parseErd(text);
        if (!result.doc) return { id: null, issues: result.issues };
        const tab = createTab(result.doc, filePath, result.issues);
        const reuse = isPristine(active.value);
        if (reuse) tabs.value.splice(tabs.value.indexOf(active.value), 1, tab);
        else tabs.value.push(tab);
        activeId.value = tab.id;
        shown();
        return { id: tab.id, issues: result.issues };
    }

    /** Leave the start page and work on the (empty) board of the current tab. */
    function startBoard() {
        if (!active.value.fresh) return;
        active.value.fresh = false;
        tick.value++;
        loadId.value++;
    }

    function newTab(name = "") {
        // the start page is itself an empty tab: "new board" just turns it into one
        if (active.value.fresh) {
            startBoard();
            return active.value.id;
        }
        const tab = createTab(createDocument(name));
        tabs.value.push(tab);
        activeId.value = tab.id;
        shown();
        return tab.id;
    }

    function activateTab(id) {
        if (id === activeId.value || !tabs.value.some((t) => t.id === id))
            return;
        activeId.value = id;
        shown();
    }

    /** Close a tab (the caller confirms unsaved changes). The last tab is replaced by an empty one. */
    function closeTab(id) {
        const i = tabs.value.findIndex((t) => t.id === id);
        if (i < 0) return;
        tabs.value.splice(i, 1);
        if (!tabs.value.length)
            tabs.value.push(createTab(createDocument(), null, [], true));
        if (id === activeId.value) {
            activeId.value = tabs.value[Math.min(i, tabs.value.length - 1)].id;
            shown();
        } else tick.value++;
    }

    /** Text to write to disk. Call `markSaved()` after the write succeeds. */
    function serialize() {
        return serializeErd(doc.value);
    }

    function markSaved(filePath = path.value) {
        active.value.path = filePath;
        active.value.savedSnapshot = snapshotErd(doc.value);
        tick.value++;
    }

    /** Apply `fn(doc)` as one undo step. `key` coalesces rapid edits (drag, typing). */
    function commit(fn, key = null, { amend = false } = {}) {
        fn(doc.value);
        active.value.history.record(snapshotErd(doc.value), { key, amend });
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
    const undo = () => restore(active.value.history.undo());
    const redo = () => restore(active.value.history.redo());

    function setView(view) {
        Object.assign(doc.value.view, view);
    }

    /* ------------------------------ mutations ------------------------------ */

    function addTable(partial = {}) {
        const table = createTable(partial);
        commit((d) => d.tables.push(table));
        return table.id;
    }

    /** New table with a default `id` PK column at world position (x, y). Returns its id. */
    function addDefaultTable(pos = {}) {
        const table = createDefaultTable(doc.value, pos);
        commit((d) => d.tables.push(table));
        return table.id;
    }

    /** Copy tables (new ids, names `<name>_copy`), offset so they do not sit on the originals. */
    function duplicateTables(ids, offset = { x: 32, y: 32 }) {
        const created = [];
        commit((d) => {
            for (const id of ids) {
                const src = d.tables.find((t) => t.id === id);
                if (!src) continue;
                const taken = d.tables.map((t) => t.name);
                const copy = cloneTable(
                    src,
                    uniqueName(taken, `${src.name}_copy`),
                );
                copy.x += offset.x;
                copy.y += offset.y;
                d.tables.push(copy);
                created.push(copy.id);
            }
        });
        return created;
    }

    function removeTables(ids) {
        const set = new Set(ids);
        commit((d) => {
            d.tables = d.tables.filter((t) => !set.has(t.id));
            d.refs = d.refs.filter(
                (r) => !set.has(r.from.table) && !set.has(r.to.table),
            );
        });
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

    /**
     * Insert a column at `index` (default: end). With no name it gets `column_N`.
     * Returns its id.
     */
    function addColumn(tableId, partial = {}, index = null) {
        const column = createColumn(partial);
        commit((d) => {
            const t = d.tables.find((x) => x.id === tableId);
            if (!t) return;
            if (!column.name) {
                column.name = nextName(
                    t.columns.map((c) => c.name),
                    "column",
                );
            }
            if (index === null || index >= t.columns.length)
                t.columns.push(column);
            else t.columns.splice(Math.max(0, index), 0, column);
        });
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
        removeColumns(tableId, [columnId]);
    }

    function moveColumn(tableId, from, to) {
        commit((d) => {
            const cols = d.tables.find((t) => t.id === tableId)?.columns;
            if (!cols || from === to || !cols[from]) return;
            cols.splice(to, 0, cols.splice(from, 1)[0]);
        });
    }

    /* -------------------------------- indexes --------------------------------- */

    /**
     * Add an index. Columns that are not in the table are dropped; an index with no columns is
     * refused (returns null). An identical existing index (same columns, same order) is reused
     * instead of creating a duplicate, its id is returned.
     */
    function addIndex(tableId, partial = {}) {
        const tb = doc.value.tables.find((x) => x.id === tableId);
        if (!tb) return null;
        const have = new Set(tb.columns.map((c) => c.id));
        const columns = [...new Set(partial.columns ?? [])].filter((c) =>
            have.has(c),
        );
        if (!columns.length) return null;
        const same = findSameIndex(tb, columns);
        if (same) return same.id;
        const ix = createIndex({ ...partial, columns });
        commit((d) => d.tables.find((x) => x.id === tableId).indexes.push(ix));
        return ix.id;
    }

    /** Index over the given columns in table order (a column selection is unordered). */
    function createIndexFromColumns(tableId, columnIds, partial = {}) {
        const tb = doc.value.tables.find((x) => x.id === tableId);
        if (!tb) return null;
        return addIndex(tableId, {
            ...partial,
            columns: inTableOrder(tb, columnIds),
        });
    }

    function updateIndex(tableId, indexId, patch, key = null) {
        commit(
            (d) => {
                const ix = d.tables
                    .find((t) => t.id === tableId)
                    ?.indexes.find((x) => x.id === indexId);
                if (ix) Object.assign(ix, patch);
            },
            key && `${key}:${indexId}`,
        );
    }

    function removeIndex(tableId, indexId) {
        commit((d) => {
            const t = d.tables.find((x) => x.id === tableId);
            if (t) t.indexes = t.indexes.filter((x) => x.id !== indexId);
        });
    }

    function addRef(partial = {}) {
        const r = createRef(partial);
        commit((d) => d.refs.push(r));
        return r.id;
    }

    /**
     * Connect two columns with a many-to-one relation (the default for a dragged line).
     * The FK holder is the `from` side: normally the column the drag started on, but dragging FROM a
     * primary key TO a plain column means "the other table points at me", so the ends are swapped.
     * Returns the new ref id, the id of an identical existing ref, or null when it makes no sense
     * (unknown table/column, or a column connected to itself).
     */
    function connectColumns(fromTableId, fromColumnId, toTableId, toColumnId) {
        const tables = doc.value.tables;
        const ta = tables.find((t) => t.id === fromTableId);
        const tb = tables.find((t) => t.id === toTableId);
        const ca = ta?.columns.find((c) => c.id === fromColumnId);
        const cb = tb?.columns.find((c) => c.id === toColumnId);
        if (!ca || !cb) return null;
        if (fromTableId === toTableId && fromColumnId === toColumnId)
            return null;
        const swap = ca.pk && !cb.pk;
        const [child, childCol, parent, parentCol] = swap
            ? [toTableId, toColumnId, fromTableId, fromColumnId]
            : [fromTableId, fromColumnId, toTableId, toColumnId];
        const same = doc.value.refs.find(
            (r) =>
                r.from.table === child &&
                r.to.table === parent &&
                r.from.columns.length === 1 &&
                r.to.columns.length === 1 &&
                r.from.columns[0] === childCol &&
                r.to.columns[0] === parentCol,
        );
        if (same) return same.id;
        const ref = createRef({
            from: createRefEnd({
                table: child,
                columns: [childCol],
                cardinality: DEFAULT_FROM_CARDINALITY,
            }),
            to: createRefEnd({
                table: parent,
                columns: [parentCol],
                cardinality: DEFAULT_TO_CARDINALITY,
            }),
        });
        commit((d) => d.refs.push(ref));
        return ref.id;
    }

    function updateRef(id, patch, key = null) {
        commit(
            (d) => {
                const r = d.refs.find((x) => x.id === id);
                if (r) Object.assign(r, patch);
            },
            key && `${key}:${id}`,
        );
    }

    /** Change one end of a ref (`side` is "from" or "to"): cardinality, columns, ... */
    function updateRefEnd(id, side, patch) {
        commit((d) => {
            const r = d.refs.find((x) => x.id === id);
            if (r && (side === "from" || side === "to"))
                Object.assign(r[side], patch);
        });
    }

    /** Swap which table holds the foreign key (the ends exchange places, cardinalities travel with them). */
    function swapRef(id) {
        commit((d) => {
            const r = d.refs.find((x) => x.id === id);
            if (r) [r.from, r.to] = [r.to, r.from];
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

    /**
     * Move a mixed selection by (dx, dy) as ONE undo step (coalesced while dragging).
     * A moved group carries everything lying completely inside it (tables and nested groups);
     * an item that is both selected and inside a moved group moves only once.
     */
    function moveItems(ids, dx, dy) {
        if (!dx && !dy) return;
        commit(
            (d) => {
                const { tables, groups } = movedWith(d, ids);
                for (const g of d.groups) {
                    if (groups.has(g.id)) {
                        g.x += dx;
                        g.y += dy;
                    }
                }
                for (const t of d.tables) {
                    if (tables.has(t.id)) {
                        t.x += dx;
                        t.y += dy;
                    }
                }
            },
            `move:${[...ids].sort().join(",")}`,
        );
    }

    /** Resize / reposition a group frame (one coalesced undo step per drag). */
    function setGroupRect(id, rect) {
        commit((d) => {
            const g = d.groups.find((x) => x.id === id);
            if (g) Object.assign(g, rect);
        });
    }

    function updateGroup(id, patch, key = null) {
        commit(
            (d) => {
                const g = d.groups.find((x) => x.id === id);
                if (g) Object.assign(g, patch);
            },
            key && `${key}:${id}`,
        );
    }

    /** Remove the frame only; the tables inside stay where they are. */
    function removeGroup(id) {
        commit((d) => {
            d.groups = d.groups.filter((g) => g.id !== id);
        });
    }

    /* ---------------------------- column selections ---------------------------- */

    /** Delete several columns of one table in one undo step (refs and index entries go with them). */
    function removeColumns(tableId, columnIds) {
        const set = new Set(columnIds);
        commit((d) => {
            const t = d.tables.find((x) => x.id === tableId);
            if (!t) return;
            t.columns = t.columns.filter((c) => !set.has(c.id));
            for (const ix of t.indexes)
                ix.columns = ix.columns.filter((c) => !set.has(c));
            t.indexes = t.indexes.filter((ix) => ix.columns.length);
            const hit = (end) =>
                end.table === tableId && end.columns.some((c) => set.has(c));
            d.refs = d.refs.filter((r) => !hit(r.from) && !hit(r.to));
        });
    }

    /** Move the selected columns one step up (dir -1) / down (+1). Returns false at the edge. */
    function moveColumns(tableId, columnIds, dir) {
        let moved = false;
        commit((d) => {
            const t = d.tables.find((x) => x.id === tableId);
            if (!t) return;
            const next = moveSelection(t.columns, new Set(columnIds), dir);
            if (next) {
                t.columns = next;
                moved = true;
            }
        });
        return moved;
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
        tabs,
        tabList,
        activeId,
        doc,
        path,
        issues,
        isFresh,
        loadId,
        dirty,
        canUndo,
        canRedo,
        tableById,
        load,
        newDocument,
        openText,
        newTab,
        startBoard,
        activateTab,
        closeTab,
        serialize,
        markSaved,
        commit,
        undo,
        redo,
        setView,
        addTable,
        addDefaultTable,
        duplicateTables,
        removeTables,
        updateTable,
        removeTable,
        addColumn,
        updateColumn,
        removeColumn,
        moveColumn,
        addIndex,
        createIndexFromColumns,
        updateIndex,
        removeIndex,
        addRef,
        connectColumns,
        updateRef,
        updateRefEnd,
        swapRef,
        removeRef,
        addGroup,
        moveItems,
        setGroupRect,
        updateGroup,
        removeColumns,
        moveColumns,
        removeGroup,
        addPaletteColor,
        removePaletteColor,
    };
});
