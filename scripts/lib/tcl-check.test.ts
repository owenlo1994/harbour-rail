import { describe, expect, it } from 'vitest';
import { pointToPolyline, polylineLength } from './tcl-check.js';
describe('audit-only geometric measurements', () => {
  it('computes length by segments and never bridges a gap', () => {
    expect(
      polylineLength([
        [114, 22],
        [114, 22.001],
      ]),
    ).toBeCloseTo(111.195, 2);
  });
  it('measures perpendicular distance to a source segment, not only its vertices', () => {
    expect(
      pointToPolyline(
        [114.005, 22.001],
        [
          [114, 22],
          [114.01, 22],
        ],
      ),
    ).toBeCloseTo(111.195, 2);
  });
  it('reports zero for an original point on the source track', () => {
    expect(
      pointToPolyline(
        [114.005, 22],
        [
          [114, 22],
          [114.01, 22],
        ],
      ),
    ).toBeLessThan(0.0001);
  });
});
