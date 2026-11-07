/**
 * App icon registry (Iconify / hugeicons)
 * -----------------------------------------------------------------------------
 * Every icon is imported ONLY from this file so one concept always maps to one
 * icon:
 *
 *   import { IconClose } from "@/icons";
 *
 * Need a new icon? Check whether the concept exists here first. If not, add it
 * with a *concept* name (not the icon's name). Browse: https://icon-sets.iconify.design/hugeicons/
 *
 * Each icon is a tiny module and unused ones are tree-shaken (see vite.config.js).
 * (?) = temporary icon, needs review.
 */

/* ------------------------------ status / messages --------------------------- */

/** Info / hint */
export { default as IconInfo } from "~icons/hugeicons/information-circle";
/** Warning (triangle) */
export { default as IconWarning } from "~icons/hugeicons/alert-02";
/** Error (circle) */
export { default as IconError } from "~icons/hugeicons/alert-circle";
/** Success */
export { default as IconSuccess } from "~icons/hugeicons/checkmark-circle-02";
/** Close / cancel */
export { default as IconClose } from "~icons/hugeicons/cancel-01";
/** Help / legend */
export { default as IconHelp } from "~icons/hugeicons/help-circle";

/* ---------------------------------- actions -------------------------------- */

/** Add (new table / column / color) */
export { default as IconAdd } from "~icons/hugeicons/add-01";
/** Delete */
export { default as IconDelete } from "~icons/hugeicons/delete-02";
/** Duplicate / copy */
export { default as IconCopy } from "~icons/hugeicons/copy-01";
/** Edit / rename */
export { default as IconEdit } from "~icons/hugeicons/edit-02";
/** "More" button on rows, headers and cards */
export { default as IconMore } from "~icons/hugeicons/more-horizontal";
/** Search (Ctrl+K) */
export { default as IconSearch } from "~icons/hugeicons/search-01";
export { default as IconUndo } from "~icons/hugeicons/undo-02";
export { default as IconRedo } from "~icons/hugeicons/redo-02";
/** Open file */
export { default as IconOpenFile } from "~icons/hugeicons/folder-open";
/** Save */
export { default as IconSave } from "~icons/hugeicons/floppy-disk";
/** Export menu */
export { default as IconExport } from "~icons/hugeicons/share-08";
/** Keyboard shortcut hint */
export { default as IconShortcuts } from "~icons/hugeicons/keyboard";

/* ----------------------------------- chrome -------------------------------- */

/** Chevron pointing down (collapse/expand, select) */
export { default as IconChevronDown } from "~icons/hugeicons/arrow-down-01";
/** Chevron pointing right; flips in RTL via `rtl:-scale-x-100` */
export { default as IconChevronRight } from "~icons/hugeicons/arrow-right-01";
export { default as IconThemeLight } from "~icons/hugeicons/sun-03";
export { default as IconThemeDark } from "~icons/hugeicons/moon-02";
export { default as IconLanguage } from "~icons/hugeicons/language-square";
export { default as IconZoomIn } from "~icons/hugeicons/zoom-in-area";
export { default as IconZoomOut } from "~icons/hugeicons/zoom-out-area";
/** Fit to screen */
export { default as IconFit } from "~icons/hugeicons/maximize-screen";
export { default as IconHide } from "~icons/hugeicons/view-off";
export { default as IconShow } from "~icons/hugeicons/view";

/* ----------------------------------- tools --------------------------------- */

/** Select tool (V) */
export { default as IconToolSelect } from "~icons/hugeicons/cursor-pointer-01";
/** New table tool (T) */
export { default as IconToolTable } from "~icons/hugeicons/table";
/** Section / group tool (S) */
export { default as IconToolSection } from "~icons/hugeicons/group-items";
/** Relationship tool (R) */
export { default as IconToolRelation } from "~icons/hugeicons/link-04";
/** Note tool (N) */
export { default as IconToolNote } from "~icons/hugeicons/sticky-note-01";
/** Drag handle (reorder columns) */
export { default as IconDragHandle } from "~icons/hugeicons/drag-drop-vertical";

/* ----------------------------- column attributes --------------------------- */
/* Shown on a column row only when the attribute has a value. */

/** Primary key */
export { default as IconColPrimaryKey } from "~icons/hugeicons/key-01";
/** Unique */
export { default as IconColUnique } from "~icons/hugeicons/fingerprint-scan";
/** Auto-increment */
export { default as IconColIncrement } from "~icons/hugeicons/sorting-1-9";
/** Default value (?) */
export { default as IconColDefault } from "~icons/hugeicons/flash";
/** Index (?) */
export { default as IconColIndex } from "~icons/hugeicons/list-view";
/** Comment / note on a column */
export { default as IconColComment } from "~icons/hugeicons/comment-01";
/** Note on a table or group */
export { default as IconNote } from "~icons/hugeicons/note-01";
/** Pin note on canvas (?) */
export { default as IconPin } from "~icons/hugeicons/pin";

/** Pan tool (H) */
export { default as IconToolPan } from "~icons/hugeicons/hand-grab";

/* ----------------------------- column row actions -------------------------- */

/** Add a column above/below a row (the + on the row border) */
export { default as IconInsertColumn } from "~icons/hugeicons/add-circle";
/** Nullable marker in the column editor */
export { default as IconNullable } from "~icons/hugeicons/help-circle";
/** Relation connector dot on a row (drawn in stage 6) */
export { default as IconRelationHandle } from "~icons/hugeicons/link-04";

/* ------------------------------------ files -------------------------------- */

/** New board / new tab */
export { default as IconNewFile } from "~icons/hugeicons/file-add";
export { default as IconSampleBoard } from "~icons/hugeicons/database-01";
/** A diagram file (tab, start page) */
export { default as IconFile } from "~icons/hugeicons/file-01";

/* --------------------------------- relations ------------------------------- */

/** Swap the two ends of a relationship (which table holds the foreign key) */
export { default as IconRelationSwap } from "~icons/hugeicons/arrow-left-right";

/** Notation legend toggle (the "?" in the tool rail) */

/** Toggle the Inspector side panel; flips in RTL via `rtl:-scale-x-100` */
export { default as IconInspector } from "~icons/hugeicons/sidebar-right";
export { default as IconImport } from "~icons/hugeicons/file-import";
export { default as IconDownload } from "~icons/hugeicons/download-01";
export { default as IconUpload } from "~icons/hugeicons/upload-01";
