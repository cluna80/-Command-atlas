// Command Atlas desktop shell. The simulation runs here in Rust; the React UI
// drives it through the commands below and never computes task state itself.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use atlas_core::{Engine, Scenario, Snapshot};
use tauri::State;

#[derive(Default)]
struct Sim(Mutex<Option<Engine>>);

fn lock<'a>(sim: &'a State<Sim>) -> Result<std::sync::MutexGuard<'a, Option<Engine>>, String> {
    sim.0.lock().map_err(|_| "simulation state is unavailable".to_string())
}

/// Loads a scenario (JSON text from the UI) and starts a fresh run.
#[tauri::command]
fn sim_load(sim: State<Sim>, scenario_json: String, horizon_min: u64) -> Result<Snapshot, String> {
    let scenario = Scenario::from_json(&scenario_json)?;
    let engine = Engine::new(&scenario, horizon_min * 60)?;
    let snapshot = engine.snapshot();
    *lock(&sim)? = Some(engine);
    Ok(snapshot)
}

/// Advances the clock by `seconds` of exercise time, processing every event due.
#[tauri::command]
fn sim_advance(sim: State<Sim>, seconds: u64) -> Result<Snapshot, String> {
    let mut guard = lock(&sim)?;
    let engine = guard.as_mut().ok_or("no scenario is loaded")?;
    let target = engine.now() + seconds;
    engine.advance_to(target);
    Ok(engine.snapshot())
}

/// Processes exactly one event.
#[tauri::command]
fn sim_step(sim: State<Sim>) -> Result<Snapshot, String> {
    let mut guard = lock(&sim)?;
    let engine = guard.as_mut().ok_or("no scenario is loaded")?;
    engine.step();
    Ok(engine.snapshot())
}

fn main() {
    tauri::Builder::default()
        .manage(Sim::default())
        .invoke_handler(tauri::generate_handler![sim_load, sim_advance, sim_step])
        .run(tauri::generate_context!())
        .expect("error while running Command Atlas");
}
