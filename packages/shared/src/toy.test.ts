import { describe, it, expect } from 'vitest';
import { sampleToy, pathLengths } from './toy.js';
describe('explicit toy motion (not timetable inference)', () => {
  const path: [number, number][] = [
      [114, 22],
      [114.01, 22],
      [114.01, 22.01],
    ],
    lengths = pathLengths(path);
  it('stays on source segments and never jumps at the turnaround', () => {
    for (const t of [0, 40, 80, 85, 90, 130, 170, 175, 180]) {
      const p = sampleToy(path, lengths, t, 0);
      expect(p.progress).toBeGreaterThanOrEqual(0);
      expect(p.progress).toBeLessThanOrEqual(1);
    }
    expect(sampleToy(path, lengths, 80, 0).coordinates).toEqual(path[2]);
    expect(sampleToy(path, lengths, 90, 0).coordinates).toEqual(path[2]);
    expect(sampleToy(path, lengths, 180, 0).coordinates).toEqual(path[0]);
  });
  it('uses a repeatable toy clock and an endpoint dwell', () => {
    expect(sampleToy(path, lengths, 85, 0).coordinates).toEqual(
      sampleToy(path, lengths, 80, 0).coordinates,
    );
    expect(sampleToy(path, lengths, 20, 0)).toEqual(
      sampleToy(path, lengths, 200, 0),
    );
  });
});
