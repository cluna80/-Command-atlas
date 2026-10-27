import { useCallback, useEffect, useRef, useState } from 'react';
import type { Scenario } from '../model/types';
import { effectiveRoads } from '../map/roads';
import { isDesktop, simAdvance, simLoad, simStep, type Snapshot } from './bridge';

export const HORIZON_MIN = 24 * 60;

/**
 * Real-time control of the engine. Run advances the exercise clock by `speed`
 * seconds every real second. Pause stops calling the engine, so the clock holds.
 */
export function useSimulation(scenario: Scenario) {
  const desktop = isDesktop();
  const key = JSON.stringify(scenario);

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const stale = loadedKey !== null && loadedKey !== key;
  const needsLoad = !snap || stale || snap.finished;

  const load = useCallback(async () => {
    const payload = JSON.stringify({ ...scenario, roads: effectiveRoads(scenario) });
    const s = await simLoad(payload, HORIZON_MIN);
    setSnap(s);
    setLoadedKey(key);
    return s;
  }, [key, scenario]);

  const fail = (e: unknown) => {
    setError(String(e));
    setRunning(false);
  };

  const notDesktop = () => setError('The simulation runs in the Command Atlas desktop app.');

  const run = async () => {
    if (!desktop) return notDesktop();
    try {
      if (needsLoad) await load();
      setError(null);
      setRunning(true);
    } catch (e) {
      fail(e);
    }
  };

  const pause = () => setRunning(false);

  const step = async () => {
    if (!desktop) return notDesktop();
    setRunning(false);
    try {
      if (needsLoad) await load();
      setSnap(await simStep());
      setError(null);
    } catch (e) {
      fail(e);
    }
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const s = await simAdvance(speed);
        setSnap(s);
        if (s.finished) setRunning(false);
      } catch (e) {
        fail(e);
      } finally {
        busy.current = false;
      }
    }, 1000);
    return () => clearInterval(id);
    // fail uses stable setters only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, speed]);

  return { snap, running, speed, setSpeed, run, pause, step, error, stale, desktop };
}
