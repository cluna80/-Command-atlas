# Command Atlas engine

Deterministic discrete-event simulation core (Rust). Fictional training exercises only.

- `atlas-core`: scenario loading, event engine, event log and fingerprint
- `atlas-cli`: run a scenario headless and print its event log

```
cargo test
cargo run -p atlas-cli -- examples/chain.json --horizon-min 720
```

Determinism: the same scenario gives the same event log and fingerprint. Simulation time only moves when the caller steps the engine.

Not yet built: random seeds (for stochastic runs), instructor events, resource accounting, and the desktop shell (Tauri).
