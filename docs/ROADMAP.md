# Command Atlas: Product Roadmap

Version 2.0 (rewritten October 27, 2026). Supersedes baseline v0.1.
Fictional training and exercise management only.

## Product purpose

A desktop platform for contractor training teams serving commanders and planning staff. Users place personnel and resources on a fictional map, configure training assignments, run exercises in real time, introduce changes, and review outcomes.

## Scope boundary

This product supports training and exercise management. It does not support live operational deployment, combat planning or execution, weapons, targeting, or automated tactical recommendations. Abstract encounter outcomes are exercise inputs or instructor-adjudicated events, not predictions of combat effectiveness.

<!--
Removed at owner request, October 27, 2026. Not planned, and no requirements, design, or implementation work is tracked here:
- Weapons systems and drone strike capability
- Combat execution, targeting, and attack planning
- Live-operation alerts and command of real assets
-->

## Built so far

- Fictional map with generated or uploaded terrain, roads, and labelled features
- Drag-and-drop units with per-node assignment cards and validation
- Unit profiles and rosters
- Run, pause, step, speed, real-time simulation in a desktop app (Rust engine)
- Dependencies and travel along a road network, with arrival hold and confirmation
- Unit icons, multi-select, undo and redo
- 3D exercise view that follows a unit, with orbit controls

## Phases (ordered by dependency, not calendar dates)

### Phase 1: Scenario builder (in progress)
- Done: map, drag, assignment inspector, dependencies, save and load, unit profiles
- Remaining: grouping, templates, duplicate across selection

### Phase 2: Simulation core (in progress)
- Done: clock, event log, task states, travel, arrival confirmation
- Remaining: seeded reproducibility checks across versions, resource accounting

### Phase 3: Instructor controls
- Instructor-triggered exercise events: road closure, communications outage, vehicle failure, weather change
- Timestamped, shown on the timeline, logged in the audit trail
- Engine reroutes units around closed roads
- Alerts to trainees inside the exercise only, marked as exercise events

### Phase 4: Calculation and validation
- Resource consumption, queues, readiness, dependency delays
- Hand-checkable reference cases; impossible states flagged
- Repeated runs with varied inputs; uncertainty shown with results

### Phase 5: Review and comparison
- Timeline playback, task metrics, side-by-side run summaries
- Exportable after-action review that traces each outcome to events and decisions

### Phase 6: Simulated drones and sensors (training assets)
- Surveillance coverage areas, battery and range limits, and loss or reassignment by the instructor
- Exercise objects only; no link to real devices

### Phase 7: Command flow in exercises
- Orders from commander to units, acknowledgements, and status
- Decision log for after-action review

### Phase 8: Team pilot
- Trainer, participant, and observer roles; access control; session isolation; shared exercises
- Audit history

### Phase 9: Product hardening
- Performance benchmarks, accessibility, backup and restore, installer packaging, pilot feedback

## Immediate next milestone

Phase 3: the instructor event system, starting with road closures that the engine handles by rerouting units.
