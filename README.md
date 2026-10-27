# Command Atlas

Browser-based, top-down 2D exercise simulation for contractor training teams. Fictional scenarios only; training and exercise management. See the product roadmap baseline v0.1.

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
