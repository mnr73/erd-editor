# AGENTS.md

Guide for AI coding agents (Claude Code, Codex, Cursor, Copilot, Hermes, ...). Humans: see `docs/DEVELOPMENT.md`.
Read this before changing code. It lists what the code does not tell you.

## What this is

ERD Editor: a desktop app (Tauri 2 + Vue 3, plain JavaScript) that edits one `*.erd.json` file as a table diagram.
**The JSON file is the only source of truth.** SQL, DBML, Markdown, SVG and PNG are exports. SQL can be imported into a new unsaved board.

- File format: `docs/FORMAT.md` and `schema/erd.schema.json`. If you touch the format, update both, `src/model/validate.js`, `src/model/migrate.js` and bump `VERSION` in `src/model/constants.js`.
- Roadmap: `docs/PLAN.md`. Releases: `docs/RELEASING.md`.

## Commands

```sh
npm install
npm run dev            # UI only, http://localhost:1421, works in any browser
npm run tauri dev      # real window (needs Rust + Linux WebKit libs, see docs/DEVELOPMENT.md)
npm run lint           # eslint + prettier check
npm run format         # prettier --write .
npm test               # vitest
npm run build          # vite build
cd src-tauri && cargo test
```

Before you say a task is done: `npm run lint`, `npm test`, `npm run build` all pass.

## Layout

```
src/model/       Pure JS, no Vue, no DOM. Format, validation, geometry, history, export/import. Put logic here.
src/model/export SQL / DBML / agent Markdown / SVG exporters (never mutate the document, never throw)
src/model/import SQL import
src/stores/      Pinia. document.js = all mutations + tabs + undo/redo. editor.js = transient UI state (tool, selection, dialogs)
src/canvas/      Infinite canvas (custom, not Vue Flow): EditorCanvas, CanvasTable, CanvasGroup, CanvasRelations, minimap
src/components/  App shell: title bar, tabs, Inspector, dialogs, start page. src/components/ui = generic building blocks
src/services/    Glue to files/exports/imports (touches Tauri). Keep thin.
src/help/        Data for the help dialog (shortcuts, features)
src/locales/     en.json (default) and fa.json (RTL). Every user-visible string goes through vue-i18n.
src-tauri/       Rust shell: single instance, open-file argv, atomic read/write commands
schema/ docs/ tests/ mime/ scripts/
```

## Rules that are easy to break

**Code style** (enforced by lint/prettier; run `npm run format`): double quotes, 4-space indent in JS and 2 in `.vue`, sorted imports, no auto-import.

**Logic goes in `src/model/` with a vitest test**, not in components. Components stay thin. A new behaviour without a test in `tests/` is not finished.

**Icons**: only from `src/icons.js` (Hugeicons via unplugin-icons). Add a named export there, with a conceptual name (`IconUndo`), never import `~icons/...` in a component. Check the icon exists in `node_modules/@iconify-json/hugeicons/icons.json` and `grep` `src/icons.js` first: a duplicate export breaks the build.

**Colors**: only Tailwind `@theme` tokens from `src/style.css` (`text-fg-soft`, `ring-line-strong`, ...). No raw hex in components. Exported images take colors from `src/model/export/theme.js`.

**Keyboard shortcuts**: always use `shortcutKey(e)` from `src/utils/keys.js`, never `e.key.toLowerCase()`. On a Persian keyboard `e.key` for the Z key is `ظ`, so Ctrl+Z would silently fail. Test shortcuts with a non-Latin `key` and the real `code`. When you add a shortcut, add it to `src/help/shortcuts.js`: a test checks each listed shortcut exists in the source.

**i18n and RTL**: add every string to both `en.json` and `fa.json`. Layout must work in RTL. Popover controls are deliberately LTR. The Undo/Redo pair is forced `dir="ltr"`.

**Numbers/fonts**: data (tables, Inspector, notes, dialog results) shows Latin digits: such containers need the `data-workspace` attribute. The Persian-digit font is only for app chrome when the UI language is fa.

**Dialogs**: copy the pattern of `AppExportDialog.vue`: root ref with `tabindex="-1"`, `role="dialog"`, focus it in `nextTick`, close on Esc and outside click. Without focus, Esc and Tab do nothing.

**File format invariants** (`docs/FORMAT.md`): ids are stable and never reused; unknown keys survive a load/save; the serializer omits default values and writes keys in fixed order (clean diffs); a file with a newer `version` than the app supports is refused; opening a file never rewrites it. Section membership is **derived from geometry** (`groupAt` in `src/model/geometry.js`), never stored.

**Rust commands only touch whitelisted extensions** (`.erd.json` for documents; fixed lists for export/import). Writes are atomic. Do not widen this without a reason.

**Undo/redo**: every document mutation goes through `src/stores/document.js` so it is recorded. History is snapshot based (500 steps, capped by size).

**Exporters**: never mutate the input, never throw. Something a target cannot express is converted and reported as a warning, not dropped silently.

## Testing

- `tests/*.test.js`, vitest, no DOM framework. Pure `src/model/` logic is tested directly.
- Source uses extension-less imports, so plain `node file.mjs` cannot import it. To inspect output write a temporary vitest file.
- UI changes: run `npm run dev` and use the app in a browser at `http://localhost:1421` (`?start` shows the start page). Native file dialogs and the Tauri window are only available under `npm run tauri dev`; say so when you did not run them.
- Generated layouts (the sample board): unit tests prove no overlaps but not that relation lines route sensibly. Look at the picture.

## Releasing

SemVer. `npm run bump -- patch|minor|major` updates all version files, then commit, `git tag vX.Y.Z`, `git push origin main vX.Y.Z` (push the tag by name). A tag push builds Linux, Windows and macOS bundles in GitHub Actions. Details: `docs/RELEASING.md`.

## Working with the maintainer

Maintainer writes Persian; UI is bilingual (en default, fa). Commits are made by the maintainer or on request. Do only what was asked; list deferred items at the end rather than doing them. Do not spend time cleaning test data.
