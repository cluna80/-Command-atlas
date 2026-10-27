//! Reference cases with hand-calculated results, plus determinism and pause checks.

use atlas_core::{Engine, Scenario};

fn scenario(json: &str) -> Scenario {
    Scenario::from_json(json).expect("valid test scenario")
}

const CHAIN: &str = r#"{
  "schemaVersion": 1, "name": "chain",
  "nodes": [
    {"id": "supply", "kind": "supply", "name": "Supply",
     "assignment": {"start": "08:00", "durationMin": 30}},
    {"id": "alpha", "kind": "team", "name": "Team Alpha",
     "assignment": {"start": "08:00", "durationMin": 60}}
  ],
  "dependencies": [{"id": "d1", "fromId": "supply", "toId": "alpha"}]
}"#;

#[test]
fn dependent_task_waits_for_prerequisite() {
    // Supply: 08:00 to 08:30. Alpha is due at 08:00 but must wait for supply, so 08:30 to 09:30.
    let s = scenario(CHAIN);
    let mut e = Engine::new(&s, 12 * 3600).unwrap();
    e.run_to_end();
    let got: Vec<(u64, &str, &str)> = e
        .log()
        .entries
        .iter()
        .map(|x| (x.t_s, x.event, x.task_id.as_str()))
        .collect();
    assert_eq!(
        got,
        vec![
            (8 * 3600, "started", "supply"),
            (8 * 3600 + 30 * 60, "completed", "supply"),
            (8 * 3600 + 30 * 60, "started", "alpha"),
            (9 * 3600 + 30 * 60, "completed", "alpha"),
        ]
    );
}

#[test]
fn same_scenario_gives_same_log_and_fingerprint() {
    let s = scenario(CHAIN);
    let mut a = Engine::new(&s, 12 * 3600).unwrap();
    let mut b = Engine::new(&s, 12 * 3600).unwrap();
    a.run_to_end();
    b.run_to_end();
    assert_eq!(a.log(), b.log());
    assert_eq!(a.log().fingerprint(), b.log().fingerprint());
}

#[test]
fn changing_a_duration_changes_the_fingerprint() {
    let base = scenario(CHAIN);
    let changed = scenario(&CHAIN.replace("\"durationMin\": 60", "\"durationMin\": 61"));
    let mut a = Engine::new(&base, 12 * 3600).unwrap();
    let mut b = Engine::new(&changed, 12 * 3600).unwrap();
    a.run_to_end();
    b.run_to_end();
    assert_ne!(a.log().fingerprint(), b.log().fingerprint());
}

#[test]
fn clock_only_moves_when_stepped() {
    // Pausing is simply not calling step(), so the clock must not move between calls.
    let s = scenario(CHAIN);
    let mut e = Engine::new(&s, 12 * 3600).unwrap();
    // The clock starts at the earliest scheduled start (08:00 here).
    assert_eq!(e.now(), 8 * 3600);
    assert_eq!(e.origin(), 8 * 3600);
    assert!(e.log().entries.is_empty());
    assert!(e.step());
    assert_eq!(e.now(), 8 * 3600);
    let paused_at = e.now();
    for _ in 0..1000 {
        // Paused: no calls to step(). Reading the clock must not advance it.
        assert_eq!(e.now(), paused_at);
    }
}

#[test]
fn tasks_beyond_the_horizon_do_not_run() {
    let s = scenario(CHAIN);
    // Horizon 08:20: supply starts but cannot finish before the horizon.
    let mut e = Engine::new(&s, 8 * 3600 + 20 * 60).unwrap();
    e.run_to_end();
    let events: Vec<&str> = e.log().entries.iter().map(|x| x.event).collect();
    assert_eq!(events, vec!["started"]);
}

#[test]
fn unknown_dependency_is_rejected() {
    let bad = CHAIN.replace("\"toId\": \"alpha\"", "\"toId\": \"ghost\"");
    let err = Engine::new(&scenario(&bad), 3600).unwrap_err();
    assert!(err.contains("ghost"), "error was: {err}");
}

#[test]
fn bad_start_time_is_rejected() {
    let bad = CHAIN.replace(
        "\"start\": \"08:00\", \"durationMin\": 60",
        "\"start\": \"25:00\", \"durationMin\": 60",
    );
    let err = Engine::new(&scenario(&bad), 3600).unwrap_err();
    assert!(err.contains("alpha"), "error was: {err}");
}

#[test]
fn advance_to_processes_only_events_due_by_then() {
    let s = scenario(CHAIN);
    let mut e = Engine::new(&s, 12 * 3600).unwrap();
    // 08:10: supply has started, nothing has finished.
    e.advance_to(8 * 3600 + 10 * 60);
    assert_eq!(e.now(), 8 * 3600 + 10 * 60);
    let snap = e.snapshot();
    assert_eq!(snap.tasks[0].state, "active");
    assert_eq!(snap.tasks[1].state, "pending");
    assert_eq!(snap.log.len(), 1);
    // 08:45: supply done, alpha running.
    e.advance_to(8 * 3600 + 45 * 60);
    let snap = e.snapshot();
    assert_eq!(snap.tasks[0].state, "complete");
    assert_eq!(snap.tasks[1].state, "active");
    assert_eq!(snap.tasks[1].started_s, Some(8 * 3600 + 30 * 60));
}

#[test]
fn advance_to_never_passes_the_horizon() {
    let s = scenario(CHAIN);
    let mut e = Engine::new(&s, 8 * 3600 + 20 * 60).unwrap();
    e.advance_to(99 * 3600);
    assert_eq!(e.now(), 8 * 3600 + 20 * 60);
    assert!(e.snapshot().finished);
}

const MOVE: &str = r#"{
  "schemaVersion": 1, "name": "move",
  "nodes": [
    {"id": "team", "kind": "team", "name": "Team", "x": 0, "y": 0,
     "assignment": {"start": "08:00", "durationMin": 10, "destinationId": "site"}},
    {"id": "site", "kind": "supply", "name": "Site", "x": 1000, "y": 0,
     "assignment": {"start": "00:00", "durationMin": 0}}
  ],
  "dependencies": []
}"#;

#[test]
fn off_road_travel_is_slower_than_on_foot_speed() {
    // No roads: 1000 m off-road at 4 km/h x 0.5 = 2 km/h = 0.556 m/s, so 1800 s.
    // Departs 08:00, arrives 08:30, works 10 minutes, completes 08:40.
    let mut e = Engine::new(&scenario(MOVE), 12 * 3600).unwrap();
    e.run_to_end();
    let team: Vec<(u64, &str)> = e
        .log()
        .entries
        .iter()
        .filter(|x| x.task_id == "team")
        .map(|x| (x.t_s, x.event))
        .collect();
    assert_eq!(
        team,
        vec![
            (8 * 3600, "departed"),
            (8 * 3600 + 1800, "arrived"),
            (8 * 3600 + 1800, "started"),
            (8 * 3600 + 1800 + 600, "completed"),
        ]
    );
}

const ROAD_MOVE: &str = r#"{
  "schemaVersion": 1, "name": "road",
  "roads": [{"id": "r1", "class": "road", "points": [[0, 0], [1000, 0]]}],
  "nodes": [
    {"id": "team", "kind": "team", "name": "Team", "x": 0, "y": 0,
     "assignment": {"start": "08:00", "durationMin": 10, "destinationId": "site"}},
    {"id": "site", "kind": "supply", "name": "Site", "x": 1000, "y": 0,
     "assignment": {"start": "00:00", "durationMin": 0}}
  ],
  "dependencies": []
}"#;

#[test]
fn units_travel_along_roads_at_road_speed() {
    // On a road: 0.9 factor x 4 km/h = 3.6 km/h = 1 m/s, so 1000 m takes 1000 s.
    let mut e = Engine::new(&scenario(ROAD_MOVE), 12 * 3600).unwrap();
    e.run_to_end();
    let arrived = e.log().entries.iter().find(|x| x.event == "arrived" && x.task_id == "team").unwrap();
    assert_eq!(arrived.t_s, 8 * 3600 + 1000);
}

#[test]
fn route_follows_the_road_network_around_a_corner() {
    // L-shaped road: east 1000 m, then north 1000 m. Routing from (0,0) to (1000,1000)
    // must follow both legs (2000 m), not cut across.
    let json = r#"{
      "schemaVersion": 1, "name": "corner",
      "roads": [
        {"id": "a", "class": "road", "points": [[0, 0], [1000, 0]]},
        {"id": "b", "class": "road", "points": [[1000, 0], [1000, 1000]]}
      ],
      "nodes": [
        {"id": "team", "kind": "team", "name": "Team", "x": 0, "y": 0,
         "assignment": {"start": "08:00", "durationMin": 1, "destinationId": "site"}},
        {"id": "site", "kind": "supply", "name": "Site", "x": 1000, "y": 1000,
         "assignment": {"start": "00:00", "durationMin": 0}}
      ],
      "dependencies": []
    }"#;
    let mut e = Engine::new(&scenario(json), 12 * 3600).unwrap();
    e.advance_to(8 * 3600);
    let snap = e.snapshot();
    let route = snap.tasks.iter().find(|t| t.id == "team").unwrap().route.clone().unwrap();
    assert!(route.iter().any(|p| p.x == 1000.0 && p.y == 0.0), "route must pass the corner");
    let end = route.last().unwrap();
    assert_eq!((end.x, end.y), (1000.0, 1000.0));
    // 2000 m at 3.6 km/h = 2000 s
    assert!((end.t - 2000.0).abs() < 1e-6, "travel time was {}", end.t);
}

#[test]
fn crossing_roads_form_a_junction() {
    // East-west and north-south roads cross at (500, 0). A unit going from (500,-500)
    // to (1000,0) must turn at the crossing, so the route passes through (500, 0).
    let json = r#"{
      "schemaVersion": 1, "name": "cross",
      "roads": [
        {"id": "ew", "class": "road", "points": [[0, 0], [1000, 0]]},
        {"id": "ns", "class": "road", "points": [[500, -500], [500, 500]]}
      ],
      "nodes": [
        {"id": "team", "kind": "team", "name": "Team", "x": 500, "y": -500,
         "assignment": {"start": "08:00", "durationMin": 1, "destinationId": "site"}},
        {"id": "site", "kind": "supply", "name": "Site", "x": 1000, "y": 0,
         "assignment": {"start": "00:00", "durationMin": 0}}
      ],
      "dependencies": []
    }"#;
    let mut e = Engine::new(&scenario(json), 12 * 3600).unwrap();
    e.advance_to(8 * 3600);
    let route = e.snapshot().tasks.iter().find(|t| t.id == "team").unwrap().route.clone().unwrap();
    assert!(route.iter().any(|p| (p.x - 500.0).abs() < 1e-6 && p.y.abs() < 1e-6), "route must turn at the crossing");
}

#[test]
fn a_unit_with_zero_speed_cannot_be_sent_to_move() {
    let bad = MOVE.replace("\"x\": 0, \"y\": 0,", "\"x\": 0, \"y\": 0, \"speedKmh\": 0,");
    let err = Engine::new(&scenario(&bad), 12 * 3600).unwrap_err();
    assert!(err.contains("no speed"), "error was: {err}");
}

#[test]
fn a_task_that_moves_reports_its_route_in_the_snapshot() {
    let mut e = Engine::new(&scenario(MOVE), 12 * 3600).unwrap();
    e.advance_to(8 * 3600 + 60);
    let snap = e.snapshot();
    let team = snap.tasks.iter().find(|t| t.id == "team").unwrap();
    assert_eq!(team.state, "moving");
    assert_eq!(team.arrive_s, Some(8 * 3600 + 1800));
    let route = team.route.clone().unwrap();
    assert_eq!((route[0].x, route[0].y), (0.0, 0.0));
    let end = route.last().unwrap();
    assert_eq!((end.x, end.y), (1000.0, 0.0));
}
