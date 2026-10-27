//! Discrete-event engine.
//!
//! Each task starts when its scheduled start time has arrived and every
//! prerequisite has completed, then runs for its duration. Events are ordered by
//! (time, sequence number), so ties always resolve the same way.

use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

use crate::log::EventLog;
use crate::scenario::{parse_hhmm, Scenario, DEFAULT_DURATION_MIN};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Kind {
    /// Scheduled start time reached: try to start the task.
    Gate,
    /// Task duration elapsed: complete the task.
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
    Active,
    Complete,
}

#[derive(Debug, Clone)]
pub struct Task {
    pub id: String,
    pub start_s: u64,
    pub duration_s: u64,
    pub state: State,
    prereqs: Vec<usize>,
    successors: Vec<usize>,
}

#[derive(Debug)]
pub struct Engine {
    tasks: Vec<Task>,
    queue: BinaryHeap<Reverse<Event>>,
    seq: u64,
    now: u64,
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
                prereqs: Vec::new(),
                successors: Vec::new(),
            });
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

        let mut engine = Engine {
            tasks,
            queue: BinaryHeap::new(),
            seq: 0,
            now: 0,
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
            Kind::Finish => {
                let task = &mut self.tasks[ev.task];
                task.state = State::Complete;
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
        let (id, duration) = {
            let t = &mut self.tasks[idx];
            t.state = State::Active;
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
