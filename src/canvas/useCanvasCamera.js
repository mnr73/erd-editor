import { computed } from "vue";

import {
    contentBounds,
    groupRect,
    tableRect,
    unionRects,
} from "@/model/geometry";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";

import {
    centerOn,
    clampZoom,
    fitRect,
    panBy,
    stepZoom,
    zoomAt,
} from "./viewport";

/** Space kept free at the minimap corner when fitting (minimap is 180x110 + 16px margin). */
const FIT_OPTIONS = { padding: 56, inset: { bottom: 70 } };

/** Camera actions over the document's `view` (pan/zoom live in the file, but are not undoable). */
export function useCanvasCamera() {
    const doc = useDocumentStore();
    const editor = useEditorStore();

    const view = computed(() => doc.doc.view);
    const size = computed(() => editor.viewportSize);
    const middle = () => ({ x: size.value.w / 2, y: size.value.h / 2 });

    function set(v) {
        doc.setView({ x: v.x, y: v.y, zoom: v.zoom });
    }

    const pan = (dx, dy) => set(panBy(view.value, dx, dy));
    const zoomTo = (zoom, anchor = middle()) =>
        set(zoomAt(view.value, zoom, anchor));
    const zoomStep = (dir, anchor = middle()) =>
        zoomTo(stepZoom(view.value.zoom, dir), anchor);
    /** Wheel / pinch: multiplicative zoom around the pointer. */
    const zoomBy = (factor, anchor) =>
        zoomTo(clampZoom(view.value.zoom * factor), anchor);

    function fitAll() {
        const b = contentBounds(doc.doc);
        set(b ? fitRect(b, size.value, FIT_OPTIONS) : { x: 0, y: 0, zoom: 1 });
    }

    /** Fit the selected items; falls back to everything when nothing is selected. */
    function fitSelection(selectedIds) {
        const rects = [
            ...doc.doc.tables
                .filter((t) => selectedIds.has(t.id))
                .map(tableRect),
            ...doc.doc.groups
                .filter((g) => selectedIds.has(g.id))
                .map(groupRect),
        ];
        const b = unionRects(rects);
        if (!b) return fitAll();
        set(fitRect(b, size.value, FIT_OPTIONS));
    }

    function focusRect(rect) {
        set(
            centerOn(
                view.value,
                { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
                size.value,
            ),
        );
    }

    return {
        view,
        size,
        set,
        pan,
        zoomTo,
        zoomStep,
        zoomBy,
        fitAll,
        fitSelection,
        focusRect,
    };
}
