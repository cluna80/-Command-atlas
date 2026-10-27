# Command Atlas

Desktop app: React interface (`src/`) over a Rust simulation engine (`engine/`), shipped with Tauri (`src-tauri/`).

## Run the desktop app

Requires Node.js 18+, Rust (stable), and on Windows the WebView2 runtime (already installed on Windows 10/11).

```
npm install
npm run tauri dev
```

The window runs the real engine: Run advances the exercise clock in real time, Pause stops it, Step processes one event, and the speed selector scales simulated time.

The app icon in `src-tauri/icons/icon.png` is a placeholder. Replace it and run `npx tauri icon path/to/logo.png` before packaging.

Plain `npm run dev` opens the interface in a browser, but the simulation only runs in the desktop app.

Browser-based, top-down 2D exercise simulation for contractor training teams. Fictional scenarios only; training and exercise management. See the product roadmap baseline v0.1.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the product roadmap baseline (v0.1) and phase exit criteria.

## Status: Phase 1 (scenario builder), in progress

Implemented:
- Fictional map with pan (drag background) and zoom (scroll)
- Drag, select, and edit nodes; add by type; duplicate; delete (Delete / Ctrl+D)
- Assignment inspector with per-field validation
- Dependencies (waits-for / must-finish-before), with cycle detection
- Save and load of versioned JSON scenarios (`schemaVersion: 1`); invalid files are rejected with clear messages

Not yet implemented (Phase 1 remainder): group/ungroup, multi-select, templates, undo/redo, and the asset palette drag-and-drop (currently buttons).

Phase 2 (simulation clock, event queue, reproducible event log) is not started. The sample timeline in the concept image is not wired to anything.

## Run

```
npm install
npm run dev     # local dev server
npm test        # validation and save/load round-trip tests
npm run build   # type-check and production build
```

## Layout

- `src/model/types.ts`: schema types (Scenario, ExerciseNode, Assignment, Dependency)
- `src/model/scenario.ts`: creation, validation, parse, serialize
- `src/components/MapCanvas.tsx`: 2D canvas map, pan/zoom, drag
- `src/components/Inspector.tsx`: node and assignment editor
- `src/App.tsx`: layout, actions, save/load
