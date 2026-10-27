//! Append-only event log with a stable fingerprint for determinism checks.

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Entry {
    /// Exercise time in seconds since the start of the exercise clock.
    pub t_s: u64,
    pub event: &'static str,
    pub task_id: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EventLog {
    pub entries: Vec<Entry>,
}

const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

impl EventLog {
    pub fn push(&mut self, t_s: u64, event: &'static str, task_id: &str) {
        self.entries.push(Entry { t_s, event, task_id: task_id.to_string() });
    }

    /// FNV-1a over the canonical text form. Equal logs give equal fingerprints.
    pub fn fingerprint(&self) -> u64 {
        let mut h = FNV_OFFSET;
        for e in &self.entries {
            for b in format!("{}|{}|{}\n", e.t_s, e.event, e.task_id).bytes() {
                h ^= b as u64;
                h = h.wrapping_mul(FNV_PRIME);
            }
        }
        h
    }

    pub fn to_text(&self) -> String {
        self.entries
            .iter()
            .map(|e| format!("{}  {:<10} {}", clock(e.t_s), e.event, e.task_id))
            .collect::<Vec<_>>()
            .join("\n")
    }
}

/// Formats seconds as HH:MM:SS.
pub fn clock(t_s: u64) -> String {
    format!("{:02}:{:02}:{:02}", t_s / 3600, (t_s % 3600) / 60, t_s % 60)
}
