COMMAND ATLAS
Product roadmap — baseline v0.1
Recorded: October 26, 2026. Working name; trademark and domain availability have not been checked. Status: planning baseline, no implementation or model validation claimed.
Product purpose
A browser-based, top-down 2D exercise simulation platform for contractor training teams serving commanders and planning staff. Users place personnel and resources, configure structured training assignments, run exercises, introduce changes, and review outcomes.
Locked product direction
- Top-down 2D map with drag-and-drop personnel, teams, vehicles, facilities, and exercise events.
- Individual and team placement, grouping, reusable templates, and node inspection.
- Per-node assignment cards: exercise objective, role, schedule, prerequisites, resource requirements, completion criteria, and fallback behavior.
- Run, pause, single-step, adjustable simulation speed, restart, and replay.
- Instructor interventions during a run with a timestamped audit trail.
- Fictional combat context and abstract opposing-force encounters, resolved by documented exercise rules or instructor adjudication.
- Calculations for readiness, movement assumptions, scheduling, logistics, communications availability, medical capacity, and task dependencies.
- Visible assumptions, model limitations, uncertainty, and after-action review.
Scope boundary
This baseline supports training and exercise management. It excludes live operational deployment, generating or optimizing combat execution plans, targeting, weapons employment, attack maneuvers, and automated tactical recommendations. Abstract encounter outcomes are exercise inputs or adjudicated events, not validated predictions of combat effectiveness. Universal battlefield coverage is a long-term aspiration, not a product claim.
Interface baseline
Top bar: scenario name, exercise status, save, and session controls.
Left palette: teams, personnel, transport, supply, medical, communications, and events.
Center: fictional map with terrain, facilities, selectable nodes, and neutral task connections.
Right inspector: selected node, assignment, dependencies, readiness, and resource fields.
Bottom: Run/Pause/Step controls, speed, event timeline, and replay position.
Review view: task completion, delays, shortages, instructor decisions, and comparison of runs.
Phased delivery
Phase	Deliverables	Exit criteria
0 — Definition	User workflows, fictional scenario, node schema, model assumptions, clickable design	Trainer can review a complete create–configure–run–review workflow; scope and measures documented
1 — Scenario builder	Pan/zoom map; drag, select, edit, group, duplicate, delete; assignment inspector; save/load	A saved scenario reloads with positions, groups, assignments, and dependencies intact; invalid fields produce clear errors
2 — Simulation core	Simulation clock; event queue; task states; dependencies; Run/Pause/Step/speed; basic resource accounting	Same version, scenario, event sequence, and random seed reproduce the same event log; pause prevents simulation-time advancement
3 — Instructor controls	Timestamped disruptions; communications outages; equipment unavailability; weather changes; abstract encounter adjudication	Events change the intended exercise state and appear in replay; trainer can distinguish manual decisions from model outputs
4 — Calculation and validation	Resource consumption, queues, readiness assumptions, dependency delays, repeated runs with varied inputs	Hand-checkable reference cases pass; impossible states are flagged; uncertainty and model versions accompany results
5 — Review and comparison	Timeline playback, task metrics, side-by-side run summaries, exportable review	Reviewer can trace each reported outcome to events, configuration, and instructor decisions
6 — Team pilot	Trainer/participant/observer roles; access controls; session isolation; shared exercises; audit history	Two isolated sessions retain separate state; role permissions are verified; trainers complete a supervised fictional exercise
7 — Product hardening	Performance benchmarks, accessibility, backup/restore, deployment documentation, customer pilot feedback	Agreed pilot workload passes documented checks; restore demonstrated; remaining limitations recorded


First playable exercise
Fictional multi-site evacuation and sustainment exercise with personnel teams, transport, a supply facility, a medical facility, and instructor-adjudicated encounters. The instructor introduces a road closure, communications outage, or vehicle failure. Review emphasizes coordination, resource availability, dependency delays, and training objectives.
Calculation principles
Use a discrete-event core initially. Store scenario version, model version, input assumptions, random seed, and intervention history with every run. Distinguish entered values, calculated outputs, and instructor judgments. Introduce repeated stochastic runs only after deterministic reference cases pass. Display ranges and sensitivity where inputs are uncertain; do not invent confidence percentages or imply operational predictive validity.
Proposed implementation direction
React and TypeScript interface with a 2D canvas map; simulation core separate from rendering; versioned JSON scenarios; local save/load for the first prototype. Select backend, persistent database, collaboration transport, and hosting after the prototype workflow is accepted. No blockchain dependency is required for the first version.
Data model baseline
Scenario, Map, Node, Team, Assignment, Dependency, ResourceInventory, ExerciseEvent, Adjudication, SimulationRun, ModelVersion, and ReviewMetric. Assignments record training tasks rather than executable combat instructions.
Delivery discipline
Phases are ordered by dependency, not promised calendar dates. Set schedule and scale targets after team size, budget, hosting constraints, and pilot workload are known. Changes to this baseline should be recorded with rationale and version. The concept image is illustrative, not a screenshot of working software.
Immediate next milestone
Build Phase 1: a fictional map, draggable personnel/team nodes, editable assignment cards, and scenario save/load. Then implement the reproducible simulation clock in Phase 2.