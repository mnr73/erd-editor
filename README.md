# ERD Editor

Local, cross-platform ERD editor (Tauri 2 + Vue 3). Opens one `*.erd.json` file (Open with) and shows it as a table diagram. DBML/SQL/PNG/SVG are export formats only. Roadmap: [docs/PLAN.md](docs/PLAN.md).

## Layout
```
src/            Vue app (JS, no auto-import; icons only via src/icons.js)
src/locales/    en.json (default), fa.json
src/model/      file format core: validate, migrate, serialize, history (pure JS, no Vue)
src/stores/     Pinia document store (all mutations, undo/redo)
schema/         erd.schema.json (JSON Schema of the file), spec in docs/FORMAT.md
tests/          vitest
src-tauri/      Rust shell (single-instance, initial_file, dialog)
mime/           shared-mime-info type for *.erd.json
design/         Claude Design mockups (mockups/ is git-ignored, extracted/ is the readable copy)
```

## Dev
```bash
npm install
npm run tauri dev        # window + HMR (vite on :1421)
npm run dev              # UI only in a browser
npm test                 # vitest
npm run lint && npm run format
npm run tauri build -- --bundles deb,appimage
```
Linux needs `libwebkit2gtk-4.1-dev build-essential libssl-dev librsvg2-dev libxdo-dev pkg-config`.

Open with: `erd-editor path/to/file.erd.json` (a second launch forwards its file to the running window).
