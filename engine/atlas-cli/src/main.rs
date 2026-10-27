//! Runs a scenario headless and prints its event log and fingerprint.
//!
//! Usage: atlas-cli <scenario.json> [--horizon-min N]

use std::process::ExitCode;

use atlas_core::{Engine, Scenario};

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(path) = args.first() else {
        eprintln!("usage: atlas-cli <scenario.json> [--horizon-min N]");
        return ExitCode::from(2);
    };
    let horizon_min = match args.iter().position(|a| a == "--horizon-min") {
        Some(i) => match args.get(i + 1).and_then(|v| v.parse::<u64>().ok()) {
            Some(v) => v,
            None => {
                eprintln!("--horizon-min needs a whole number of minutes");
                return ExitCode::from(2);
            }
        },
        None => 24 * 60,
    };

    let text = match std::fs::read_to_string(path) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("cannot read {path}: {e}");
            return ExitCode::from(1);
        }
    };
    let result = Scenario::from_json(&text).and_then(|s| {
        let mut engine = Engine::new(&s, horizon_min * 60)?;
        engine.run_to_end();
        Ok((s.name, engine))
    });
    match result {
        Ok((name, engine)) => {
            println!("scenario: {name}");
            println!("{}", engine.log().to_text());
            println!("events: {}", engine.log().entries.len());
            println!("fingerprint: {:016x}", engine.log().fingerprint());
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::from(1)
        }
    }
}
