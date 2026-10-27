//! Scenario file format. Mirrors the JSON written by the front end.
//! Unknown fields are ignored so the front end can add fields freely.

use serde::Deserialize;

use crate::roads::Road;

pub const DEFAULT_DURATION_MIN: u64 = 30;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scenario {
    #[serde(default)]
    pub schema_version: u32,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub nodes: Vec<Node>,
    #[serde(default)]
    pub dependencies: Vec<Dependency>,
    /// Road network. Units route along these when they can.
    #[serde(default)]
    pub roads: Vec<Road>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    pub id: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub assignment: Assignment,
    /// Position on the map in metres.
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    /// Travel speed in km/h. Defaults by unit type when absent.
    #[serde(default)]
    pub speed_kmh: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Assignment {
    /// 24-hour HH:MM on the exercise clock.
    #[serde(default)]
    pub start: String,
    /// Task length in minutes. Defaults to DEFAULT_DURATION_MIN when absent.
    #[serde(default)]
    pub duration_min: Option<u64>,
    /// Node the unit must travel to before the work starts.
    #[serde(default)]
    pub destination_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dependency {
    pub id: String,
    pub from_id: String,
    pub to_id: String,
}

impl Scenario {
    pub fn from_json(text: &str) -> Result<Self, String> {
        serde_json::from_str(text).map_err(|e| format!("invalid scenario JSON: {e}"))
    }
}

/// Parses "HH:MM" into seconds since midnight.
pub fn parse_hhmm(s: &str) -> Result<u64, String> {
    let (h, m) = s
        .split_once(':')
        .ok_or_else(|| format!("start time '{s}' must look like HH:MM"))?;
    let h: u64 = h.parse().map_err(|_| format!("bad hour in '{s}'"))?;
    let m: u64 = m.parse().map_err(|_| format!("bad minute in '{s}'"))?;
    if h > 23 || m > 59 {
        return Err(format!("start time '{s}' is out of range"));
    }
    Ok((h * 60 + m) * 60)
}
