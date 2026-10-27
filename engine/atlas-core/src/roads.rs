//! Road network. Road polylines become a graph: crossings become junctions, and each unit
//! routes along the fastest path. Off-road legs are straight lines at a slower speed.

use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Road {
    pub id: String,
    /// highway, road, or track. Anything else is treated as off-road.
    #[serde(default)]
    pub class: String,
    /// Polyline in map metres.
    pub points: Vec<[f64; 2]>,
}

/// Speed multiplier for off-road legs (and unknown road classes).
pub const OFF_ROAD_FACTOR: f64 = 0.5;
/// Points closer than this (metres) are the same junction.
const SNAP_M: f64 = 0.5;

pub fn class_factor(class: &str) -> f64 {
    match class {
        "highway" => 1.0,
        "road" => 0.9,
        "track" => 0.6,
        _ => OFF_ROAD_FACTOR,
    }
}

/// A planned route: `points` in order, and `factors[i]` for the leg from points[i] to points[i+1].
#[derive(Debug, Clone)]
pub struct Leg {
    pub points: Vec<[f64; 2]>,
    pub factors: Vec<f64>,
}

#[derive(Debug, Clone)]
pub struct Network {
    nodes: Vec<[f64; 2]>,
    adj: Vec<Vec<(usize, f64, f64)>>, // (neighbour, length in metres, speed factor)
}

fn cross(a: [f64; 2], b: [f64; 2]) -> f64 {
    a[0] * b[1] - a[1] * b[0]
}

/// Parameters (t on a-b, u on c-d) where the two segments cross inside both.
fn intersect(a: [f64; 2], b: [f64; 2], c: [f64; 2], d: [f64; 2]) -> Option<(f64, f64)> {
    let r = [b[0] - a[0], b[1] - a[1]];
    let s = [d[0] - c[0], d[1] - c[1]];
    let denom = cross(r, s);
    if denom.abs() < 1e-12 {
        return None;
    }
    let ca = [c[0] - a[0], c[1] - a[1]];
    let t = cross(ca, s) / denom;
    let u = cross(ca, r) / denom;
    let eps = 1e-9;
    if t > eps && t < 1.0 - eps && u > eps && u < 1.0 - eps {
        Some((t, u))
    } else {
        None
    }
}

fn dist(a: [f64; 2], b: [f64; 2]) -> f64 {
    (b[0] - a[0]).hypot(b[1] - a[1])
}

fn node_for(
    p: [f64; 2],
    index: &mut HashMap<(i64, i64), usize>,
    nodes: &mut Vec<[f64; 2]>,
    adj: &mut Vec<Vec<(usize, f64, f64)>>,
) -> usize {
    let key = ((p[0] / SNAP_M).round() as i64, (p[1] / SNAP_M).round() as i64);
    *index.entry(key).or_insert_with(|| {
        nodes.push(p);
        adj.push(Vec::new());
        nodes.len() - 1
    })
}

impl Network {
    pub fn build(roads: &[Road]) -> Network {
        // Every polyline segment, with its speed factor.
        let mut segs: Vec<([f64; 2], [f64; 2], f64)> = Vec::new();
        for r in roads {
            let f = class_factor(&r.class);
            for w in r.points.windows(2) {
                segs.push((w[0], w[1], f));
            }
        }

        // Crossings split both segments into pieces.
        let mut splits: Vec<Vec<f64>> = vec![vec![0.0, 1.0]; segs.len()];
        for i in 0..segs.len() {
            for j in (i + 1)..segs.len() {
                if let Some((ti, tj)) = intersect(segs[i].0, segs[i].1, segs[j].0, segs[j].1) {
                    splits[i].push(ti);
                    splits[j].push(tj);
                }
            }
        }

        let mut index = HashMap::new();
        let mut nodes = Vec::new();
        let mut adj: Vec<Vec<(usize, f64, f64)>> = Vec::new();
        for (i, (a, b, f)) in segs.iter().enumerate() {
            let mut ts = splits[i].clone();
            ts.sort_by(|x, y| x.partial_cmp(y).unwrap());
            ts.dedup_by(|x, y| (*x - *y).abs() < 1e-9);
            let pts: Vec<[f64; 2]> = ts
                .iter()
                .map(|t| [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
                .collect();
            for w in pts.windows(2) {
                let u = node_for(w[0], &mut index, &mut nodes, &mut adj);
                let v = node_for(w[1], &mut index, &mut nodes, &mut adj);
                if u != v {
                    let len = dist(w[0], w[1]);
                    adj[u].push((v, len, *f));
                    adj[v].push((u, len, *f));
                }
            }
        }
        Network { nodes, adj }
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    fn nearest(&self, p: [f64; 2]) -> Option<usize> {
        (0..self.nodes.len()).min_by(|&a, &b| {
            dist(self.nodes[a], p)
                .partial_cmp(&dist(self.nodes[b], p))
                .unwrap()
                .then(a.cmp(&b))
        })
    }

    /// Fastest path by travel cost (length / speed factor), as node indices.
    fn path(&self, s: usize, t: usize) -> Option<Vec<usize>> {
        let n = self.nodes.len();
        let mut cost = vec![f64::INFINITY; n];
        let mut prev = vec![usize::MAX; n];
        let mut heap = BinaryHeap::new();
        cost[s] = 0.0;
        heap.push(Reverse((0.0f64.to_bits(), s)));
        while let Some(Reverse((bits, u))) = heap.pop() {
            let c = f64::from_bits(bits);
            if c > cost[u] {
                continue;
            }
            if u == t {
                break;
            }
            for &(v, len, f) in &self.adj[u] {
                let nc = c + len / f;
                if nc < cost[v] {
                    cost[v] = nc;
                    prev[v] = u;
                    heap.push(Reverse((nc.to_bits(), v)));
                }
            }
        }
        if !cost[t].is_finite() {
            return None;
        }
        let mut path = vec![t];
        let mut cur = t;
        while cur != s {
            cur = prev[cur];
            path.push(cur);
        }
        path.reverse();
        Some(path)
    }

    fn factor_between(&self, u: usize, v: usize) -> f64 {
        self.adj[u]
            .iter()
            .filter(|(w, _, _)| *w == v)
            .map(|(_, _, f)| *f)
            .fold(OFF_ROAD_FACTOR, f64::max)
    }

    /// Route from a to b: off-road to the nearest junction, along roads, then off-road to b.
    pub fn route(&self, a: [f64; 2], b: [f64; 2]) -> Leg {
        let straight = Leg { points: vec![a, b], factors: vec![OFF_ROAD_FACTOR] };
        if self.is_empty() {
            return straight;
        }
        let (Some(na), Some(nb)) = (self.nearest(a), self.nearest(b)) else {
            return straight;
        };
        let Some(path) = self.path(na, nb) else {
            return straight;
        };
        let mut points = vec![a, self.nodes[path[0]]];
        let mut factors = vec![OFF_ROAD_FACTOR];
        for w in path.windows(2) {
            points.push(self.nodes[w[1]]);
            factors.push(self.factor_between(w[0], w[1]));
        }
        points.push(b);
        factors.push(OFF_ROAD_FACTOR);
        Leg { points, factors }
    }
}
