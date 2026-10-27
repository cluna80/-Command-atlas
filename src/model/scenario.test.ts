import { describe, expect, it } from 'vitest';
import { createSampleScenario, parseScenario, serializeScenario, validateScenario } from './scenario';

describe('scenario save/load', () => {
  it('round-trips nodes, assignments, and dependencies intact', () => {
    const original = createSampleScenario();
    const { scenario, issues } = parseScenario(serializeScenario(original));
    expect(issues).toEqual([]);
    expect(scenario).toEqual(original);
  });

  it('rejects invalid JSON with a clear message', () => {
    const { scenario, issues } = parseScenario('{not json');
    expect(scenario).toBeNull();
    expect(issues[0].message).toMatch(/not valid JSON/);
  });

  it('rejects a bad start time and names the node and field', () => {
    const s = createSampleScenario();
    s.nodes[0].assignment.start = '25:00';
    const issues = validateScenario(s);
    expect(issues).toContainEqual({
      where: 'Team Alpha',
      message: 'start: Start must be a 24-hour time such as 09:00.',
    });
  });

  it('flags dependencies that reference missing nodes', () => {
    const s = createSampleScenario();
    s.dependencies.push({ id: 'bad', fromId: 'ghost', toId: 'alpha' });
    expect(validateScenario(s).some((i) => i.where === 'dependency bad')).toBe(true);
  });

  it('flags dependency cycles', () => {
    const s = createSampleScenario();
    s.dependencies.push({ id: 'loop', fromId: 'alpha', toId: 'supply' });
    expect(validateScenario(s).some((i) => i.message.includes('cycle'))).toBe(true);
  });
});
