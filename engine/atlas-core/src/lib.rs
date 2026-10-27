//! Command Atlas simulation core.
//!
//! Deterministic discrete-event engine for fictional training exercises.
//! Same scenario in, same event log out. Simulation time only advances when
//! the caller steps the engine, so pausing is simply not calling `step`.

pub mod engine;
pub mod log;
pub mod scenario;

pub use engine::{Engine, Snapshot, State, Task, TaskView};
pub use log::{Entry, EventLog};
pub use scenario::{parse_hhmm, Scenario};
