import { describe, expect, it } from 'vitest';
import { generateField } from './terrain';

describe('terrain generation', () => {
  it('is deterministic for a given seed', () => {
    const a = generateField(120, 80, 42);
    const b = generateField(120, 80, 42);
    expect(Array.from(a.elev)).toEqual(Array.from(b.elev));
    expect(Array.from(a.water)).toEqual(Array.from(b.water));
  });

  it('produces a mix of water and land, not a flat field', () => {
    const f = generateField(120, 80, 42);
    const wet = f.water.reduce((s, v) => s + v, 0) / f.water.length;
    expect(wet).toBeGreaterThan(0.01);
    expect(wet).toBeLessThan(0.6);
    const min = Math.min(...f.elev);
    const max = Math.max(...f.elev);
    expect(max - min).toBeGreaterThan(0.5);
  });

  it('changes with the seed', () => {
    const a = generateField(120, 80, 1);
    const b = generateField(120, 80, 2);
    expect(Array.from(a.elev)).not.toEqual(Array.from(b.elev));
  });
});
