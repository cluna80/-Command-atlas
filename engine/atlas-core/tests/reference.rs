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
    assert_eq!(e.now(), 0);
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
