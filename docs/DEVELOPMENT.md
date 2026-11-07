# Development guide

For people. AI agents read `AGENTS.md` (same rules, shorter). Format reference: [`FORMAT.md`](FORMAT.md). Release steps: [`RELEASING.md`](RELEASING.md).

## Setup

You need Node 22+ and npm. For the desktop window also Rust (stable) and, on Linux, the WebKit libraries.

```sh
npm install
npm run dev          # UI in a browser at http://localhost:1421 (add ?start for the start page)
npm run tauri dev    # the real window with hot reload
```

Linux packages for `tauri dev` / `tauri build`:

```sh
sudo apt-get install libwebkit2gtk-4.1-dev build-essential libssl-dev librsvg2-dev libxdo-dev pkg-config
```

The browser mode has no native file dialogs and no real file access. It is enough for most UI work.

## Everyday commands

| Command                           | What it does                            |
| --------------------------------- | --------------------------------------- |
| `npm run lint` / `npm run format` | ESLint with Prettier / write formatting |
| `npm test`                        | vitest (all tests, no browser)          |
| `npm run build`                   | production build of the UI into `dist`  |
| `cd src-tauri && cargo test`      | Rust tests                              |
| `npm run tauri build`             | installers for your OS                  |
| `npm run bump -- patch`           | new version in all files                |

Before opening a pull request: lint, test and build must pass.

## How the code is organised

The file is the model; the UI edits it; exporters read it.

```
.erd.json  <->  src/model (pure JS)  <->  src/stores (Pinia)  <->  src/canvas + src/components (Vue)
                      |                                                  |
                src/model/export, import                          src/services -> src-tauri (Rust)
```

- **`src/model/`** has no Vue and no DOM. Validation, migration, serialization, geometry, column and index rules, relations, search, undo history, the sample board, and all exporters/importers. If something can be tested without a browser, it lives here.
- **`src/stores/document.js`** owns the open boards (tabs). Every change goes through it, which is what makes undo/redo work. **`editor.js`** keeps short-lived UI state (tool, selection, which dialog is open).
- **`src/canvas/`** is a custom infinite canvas: HTML for tables, SVG for relation lines. Lines attach to column rows, which is why Vue Flow was not used.
- **`src/components/`** is the app shell. `ui/` holds generic pieces (popover, tooltip, toast, switch...).
- **`src/services/`** is the thin layer that talks to Tauri (open, save, export, import).
- **`src-tauri/`** is small: single instance, receive the file path of "Open with", read/write only `.erd.json`, atomic writes.

## Conventions

- JavaScript, double quotes, 4 spaces in `.js`, 2 in `.vue`/`.json`, sorted imports (Prettier does it), no auto-import.
- **Icons** come only from `src/icons.js`. Add a conceptually named export (`IconUndo`), check the icon exists in `@iconify-json/hugeicons`, and do not import `~icons/...` in components.
- **Colors** come only from the Tailwind `@theme` tokens in `src/style.css`. No raw hex in components.
- **Strings** go in both `src/locales/en.json` and `fa.json`. Check your change in RTL.
- **Shortcuts** use `shortcutKey(e)` from `src/utils/keys.js`. On a Persian keyboard `e.key` is not Latin, so `e.key === "z"` never matches. Add the shortcut to `src/help/shortcuts.js`; a test checks the list against the code.
- **Dialogs** copy `AppExportDialog.vue`: focusable root, `role="dialog"`, focus on open, Esc and outside click close.
- **Data digits**: containers that show data carry `data-workspace` so numbers stay Latin even when the UI is Persian.

## Changing the file format

1. Edit `docs/FORMAT.md` and `schema/erd.schema.json`.
2. Update `src/model/validate.js`; if old files need conversion, add a step to `src/model/migrate.js`.
3. Raise `VERSION` in `src/model/constants.js` only when old apps could misread the new file.
4. Add tests. Keep these guarantees: ids never change, unknown keys survive, defaults are omitted, a file is never rewritten just by opening it.

## Tests

Tests live in `tests/`. Most call `src/model` directly. For a UI change, run `npm run dev` and try it with the mouse and keyboard, in English and Persian. Native dialogs and window behaviour can only be tried under `npm run tauri dev`.

## Releases

SemVer. `npm run bump -- patch`, commit, `git tag vX.Y.Z`, `git push origin main vX.Y.Z`. GitHub Actions builds Linux, Windows and macOS and publishes the release. See [`RELEASING.md`](RELEASING.md).

## The website

`site/` is a plain static site (no build step): `index.html` (English) and `fa/index.html` (Persian, RTL) share `assets/style.css`. It is published to GitHub Pages by `.github/workflows/pages.yml` whenever `site/` changes on `main`. One-time setup: repo Settings → Pages → Source: **GitHub Actions**.

- Preview: `cd site && python3 -m http.server 8099`.
- Keep both languages in step when you change one.
- `site/example.erd.json` is the file shown on the page. `tests/site.test.js` checks it is valid, matches the JSON Schema and is in the app's own saved form, so the page cannot show a file the app would reject.
- Screenshots in `site/assets/app-*.png` come from the sample board; retake them when the UI changes.
- Fonts in `site/assets/fonts` are the same files the app bundles (Inter, JetBrains Mono, Vazirmatn; licences in the font packages).
