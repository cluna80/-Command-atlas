//! Discrete-event engine.
//!
//! A task starts when its scheduled start time has arrived and every prerequisite has
//! completed. If the task has a destination, its unit first travels there (distance
//! times a detour factor, at the unit's speed), then the work runs for its duration.
//! Events are ordered by (time, sequence number), so ties always resolve the same way.

use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

use serde::Serialize;

use crate::log::{Entry, EventLog};
use crate::scenario::{parse_hhmm, Scenario, DEFAULT_DURATION_MIN};

/// Straight-line distance is multiplied by this to approximate the route length.
pub const DETOUR_FACTOR: f64 = 1.3;

/// Default travel speed in km/h by unit type. Zero means the unit cannot move.
pub fn default_speed_kmh(kind: &str) -> f64 {
    match kind {
        "team" | "personnel" => 4.0,
        "transport" => 40.0,
        _ => 0.0,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Kind {
    /// Scheduled start time reached: try to start the task.
    Gate,
    /// Travel finished: the unit has arrived and the work begins.
    Arrive,
    /// Work finished: complete the task.
    Finish,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct Event {
    time: u64,
    seq: u64,
    kind: Kind,
    task: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum State {
    Pending,
    Moving,
    Active,
    Complete,
}

#[derive(Debug, Clone)]
pub struct Task {
    pub id: String,
    pub start_s: u64,
    pub duration_s: u64,
    pub state: State,
    pub started_s: Option<u64>,
    pub finished_s: Option<u64>,
    pub departed_s: Option<u64>,
    pub moves: bool,
    pub travel_s: u64,
    pub from: (f64, f64),
    pub to: (f64, f64),
    prereqs: Vec<usize>,
    successors: Vec<usize>,
}

#[derive(Debug)]
pub struct Engine {
    tasks: Vec<Task>,
    queue: BinaryHeap<Reverse<Event>>,
    seq: u64,
    now: u64,
    origin: u64,
    horizon: u64,
    log: EventLog,
}

impl Engine {
    /// Builds the engine. `horizon_s` is the exercise end time; nothing after it runs.
    pub fn new(scenario: &Scenario, horizon_s: u64) -> Result<Self, String> {
        let mut index = HashMap::new();
        let mut tasks = Vec::with_capacity(scenario.nodes.len());
        for (i, node) in scenario.nodes.iter().enumerate() {
            if index.insert(node.id.as_str(), i).is_some() {
                return Err(format!("duplicate node id '{}'", node.id));
            }
            let start_s = parse_hhmm(&node.assignment.start)
                .map_err(|e| format!("node '{}': {e}", node.id))?;
            let duration_min = node.assignment.duration_min.unwrap_or(DEFAULT_DURATION_MIN);
            tasks.push(Task {
                id: node.id.clone(),
                start_s,
                duration_s: duration_min * 60,
                state: State::Pending,
                started_s: None,
                finished_s: None,
                departed_s: None,
                moves: node.assignment.destination_id.is_some(),
                travel_s: 0,
                from: (node.x, node.y),
                to: (node.x, node.y),
                prereqs: Vec::new(),
                successors: Vec::new(),
            });
        }

        // Travel times, from positions and unit speeds.
        for (i, node) in scenario.nodes.iter().enumerate() {
            let Some(dest_id) = &node.assignment.destination_id else { continue };
            let d = *index
                .get(dest_id.as_str())
                .ok_or_else(|| format!("node '{}' moves to missing node '{}'", node.id, dest_id))?;
            let dest = &scenario.nodes[d];
            let dist_m = (dest.x - node.x).hypot(dest.y - node.y) * DETOUR_FACTOR;
            let speed = node.speed_kmh.unwrap_or_else(|| default_speed_kmh(&node.kind));
            let travel_s = if dist_m == 0.0 {
                0
            } else if speed <= 0.0 {
                return Err(format!("node '{}' has no speed but must travel to '{}'", node.id, dest_id));
            } else {
                (dist_m / (speed * 1000.0 / 3600.0)).round() as u64
            };
            tasks[i].to = (dest.x, dest.y);
            tasks[i].travel_s = travel_s;
        }

        for dep in &scenario.dependencies {
            let from = *index
                .get(dep.from_id.as_str())
                .ok_or_else(|| format!("dependency '{}' refers to missing node '{}'", dep.id, dep.from_id))?;
            let to = *index
                .get(dep.to_id.as_str())
                .ok_or_else(|| format!("dependency '{}' refers to missing node '{}'", dep.id, dep.to_id))?;
            if from == to {
                return Err(format!("dependency '{}' links a node to itself", dep.id));
            }
            tasks[to].prereqs.push(from);
            tasks[from].successors.push(to);
        }

        // The exercise clock starts at the earliest scheduled start, so the run is not idle.
        let origin = tasks.iter().map(|t| t.start_s).min().unwrap_or(0);
        let mut engine = Engine {
            tasks,
            queue: BinaryHeap::new(),
            seq: 0,
            now: origin,
            origin,
            horizon: horizon_s,
            log: EventLog::default(),
        };
        for i in 0..engine.tasks.len() {
            let t = engine.tasks[i].start_s;
            engine.schedule(t, Kind::Gate, i);
        }
        Ok(engine)
    }

    /// Current exercise time in seconds.
    pub fn now(&self) -> u64 {
        self.now
    }

    /// Exercise time at which the run starts (earliest scheduled start).
    pub fn origin(&self) -> u64 {
        self.origin
    }

    pub fn tasks(&self) -> &[Task] {
        &self.tasks
    }

    pub fn log(&self) -> &EventLog {
        &self.log
    }

    /// True when no further event will run within the horizon.
    pub fn finished(&self) -> bool {
        self.queue.peek().map_or(true, |Reverse(e)| e.time > self.horizon)
    }

    /// Processes the next event. Returns false when the exercise has finished.
    pub fn step(&mut self) -> bool {
        let Some(Reverse(ev)) = self.queue.pop() else { return false };
        if ev.time > self.horizon {
            self.queue.push(Reverse(ev));
            return false;
        }
        self.now = ev.time;
        match ev.kind {
            Kind::Gate => self.try_start(ev.task),
            Kind::Arrive => {
                let id = self.tasks[ev.task].id.clone();
                self.log.push(self.now, "arrived", &id);
                self.begin_work(ev.task);
            }
            Kind::Finish => {
                let task = &mut self.tasks[ev.task];
                task.state = State::Complete;
                task.finished_s = Some(self.now);
                let id = task.id.clone();
                let successors = task.successors.clone();
                self.log.push(self.now, "completed", &id);
                for s in successors {
                    self.try_start(s);
                }
            }
        }
        true
    }

    /// Time of the next queued event, if any.
    pub fn next_event_time(&self) -> Option<u64> {
        self.queue.peek().map(|Reverse(e)| e.time)
    }

    /// Processes every event due by `t_s` (capped at the horizon), then moves the clock there.
    /// Calling this is how real time drives the simulation: the caller decides how much
    /// simulated time to allow, so pausing is simply not calling it.
    pub fn advance_to(&mut self, t_s: u64) {
        let target = t_s.min(self.horizon);
        while let Some(next) = self.next_event_time() {
            if next > target || !self.step() {
                break;
            }
        }
        if target > self.now {
            self.now = target;
        }
    }

    /// A serialisable view of the whole run, for the user interface.
    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            now_s: self.now,
            origin_s: self.origin,
            finished: self.finished(),
            tasks: self
                .tasks
                .iter()
                .map(|t| TaskView {
                    id: t.id.clone(),
                    state: match t.state {
                        State::Pending => "pending",
                        State::Moving => "moving",
                        State::Active => "active",
                        State::Complete => "complete",
                    },
                    start_s: t.start_s,
                    started_s: t.started_s,
                    finished_s: t.finished_s,
                    departed_s: t.departed_s,
                    arrive_s: t.departed_s.filter(|_| t.moves).map(|d| d + t.travel_s),
                    from: t.moves.then_some([t.from.0, t.from.1]),
                    to: t.moves.then_some([t.to.0, t.to.1]),
                })
                .collect(),
            log: self.log.entries.clone(),
        }
    }

    /// Runs until the exercise finishes.
    pub fn run_to_end(&mut self) {
        while self.step() {}
    }

    fn try_start(&mut self, idx: usize) {
        let now = self.now;
        let ready = {
            let t = &self.tasks[idx];
            t.state == State::Pending
                && now >= t.start_s
                && t.prereqs.iter().all(|&p| self.tasks[p].state == State::Complete)
        };
        if !ready {
            return;
        }
        if self.tasks[idx].moves && self.tasks[idx].travel_s > 0 {
            let travel = self.tasks[idx].travel_s;
            let id = self.tasks[idx].id.clone();
            let t = &mut self.tasks[idx];
            t.state = State::Moving;
            t.departed_s = Some(now);
            self.log.push(now, "departed", &id);
            self.schedule(now + travel, Kind::Arrive, idx);
        } else {
            self.begin_work(idx);
        }
    }

    fn begin_work(&mut self, idx: usize) {
        let now = self.now;
        let (id, duration) = {
            let t = &mut self.tasks[idx];
            t.state = State::Active;
            t.started_s = Some(now);
            (t.id.clone(), t.duration_s)
        };
        self.log.push(now, "started", &id);
        self.schedule(now + duration, Kind::Finish, idx);
    }

    fn schedule(&mut self, time: u64, kind: Kind, task: usize) {
        self.seq += 1;
        self.queue.push(Reverse(Event { time, seq: self.seq, kind, task }));
    }
}

/// Serialisable snapshot of a run.
#[derive(Debug, Clone, Serialize)]
pub struct Snapshot {
    pub now_s: u64,
    pub origin_s: u64,
    pub finished: bool,
    pub tasks: Vec<TaskView>,
    pub log: Vec<Entry>,
}

/// One task as the user interface sees it.
#[derive(Debug, Clone, Serialize)]
pub struct TaskView {
    pub id: String,
    pub state: &'static str,
    pub start_s: u64,
    pub started_s: Option<u64>,
    pub finished_s: Option<u64>,
    pub departed_s: Option<u64>,
    pub arrive_s: Option<u64>,
    pub from: Option<[f64; 2]>,
    pub to: Option<[f64; 2]>,
}
