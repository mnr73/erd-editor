# ERD Editor

A local desktop editor for database diagrams (ERD). One `*.erd.json` file is the whole project: open it, edit tables and relationships on an infinite canvas, export SQL / DBML / PNG / SVG / Markdown. Built with Tauri 2 and Vue 3. English and Persian (RTL) UI.

Download for Linux, Windows and macOS: [Releases](https://github.com/mnr73/erd-editor/releases).

## Docs

- [Development guide](docs/DEVELOPMENT.md): setup, layout, conventions
- [AGENTS.md](AGENTS.md): the same for AI coding agents
- [File format](docs/FORMAT.md) and [JSON Schema](schema/erd.schema.json)
- [Agent skill](skills/erd-editor/SKILL.md): teaches any AI coding agent to read and edit `.erd.json` files. Give your agent the raw link: `https://raw.githubusercontent.com/mnr73/erd-editor/main/skills/erd-editor/SKILL.md`
- [Releasing](docs/RELEASING.md), [roadmap](docs/PLAN.md)

## Quick start

```sh
npm install
npm run dev          # UI in a browser, http://localhost:1421
npm run tauri dev    # desktop window
npm test && npm run lint
```

Linux needs `libwebkit2gtk-4.1-dev build-essential libssl-dev librsvg2-dev libxdo-dev pkg-config`.

Open a file from the command line with `erd-editor path/to/file.erd.json`; a second launch hands its file to the running window.

## License

[MIT](LICENSE) © mnrTech
