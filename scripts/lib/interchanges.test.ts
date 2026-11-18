import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMtrCsv } from './csv.js';
import { buildInterchanges } from './interchanges.js';
const csv = parseMtrCsv(
  readFileSync(
    new URL('../../data/raw/mtr_lines_and_stations.csv', import.meta.url),
    'utf8',
  ),
);
const empty = { version: 1, groups: [] };
const result = buildInterchanges(csv.stations, empty);
describe('interchange candidates and explicit overrides', () => {
  it('matches code plus Chinese name, regardless of different IDs', () => {
    expect(result.interchanges).toContainEqual({
      members: ['AEL:HOK', 'TCL:HOK'],
      method: 'code-and-chinese-name',
    });
    expect(result.interchanges).toHaveLength(21);
  });
  it('never merges Central/Hong Kong or Kowloon/Kowloon Tong by assumption', () => {
    for (const g of result.interchanges) {
      expect(
        g.members.some((k) => k.endsWith(':CEN')) &&
          g.members.some((k) => k.endsWith(':HOK')),
      ).toBe(false);
      expect(
        g.members.some((k) => k.endsWith(':KOW')) &&
          g.members.some((k) => k.endsWith(':KOT')),
      ).toBe(false);
    }
    expect(result.warnings[0].code).toBe('CROSS_CODE_INTERCHANGES_UNVERIFIED');
  });
  it('leaves conflicting names unresolved and warns', () => {
    const stations = csv.stations
      .filter((s) => s.stationCode === 'HOK')
      .map((s, i) => (i ? { ...s, chineseName: '不同站名' } : s));
    const r = buildInterchanges(stations, empty);
    expect(r.interchanges).toHaveLength(0);
    expect(r.warnings.map((w) => w.code)).toContain('CODE_NAME_CONFLICT');
  });
  it('applies reviewed groups instead of automatic grouping', () => {
    const r = buildInterchanges(csv.stations, {
      version: 1,
      groups: [
        {
          id: 'fixture-only',
          members: [
            { line: 'TCL', stationCode: 'HOK' },
            { line: 'TWL', stationCode: 'CEN' },
          ],
          reason: 'Synthetic test, not a deployed transfer decision',
          source: 'test-fixture',
        },
      ],
    });
    expect(r.interchanges).toContainEqual({
      members: ['TCL:HOK', 'TWL:CEN'],
      method: 'manual-override',
    });
    expect(
      r.interchanges.some(
        (g) => g.members.includes('AEL:HOK') && g.members.includes('TCL:HOK'),
      ),
    ).toBe(false);
  });
  it('rejects unknown members', () =>
    expect(() =>
      buildInterchanges(csv.stations, {
        version: 1,
        groups: [
          {
            id: 'bad',
            members: [
              { line: 'TCL', stationCode: 'ZZZ' },
              { line: 'TWL', stationCode: 'CEN' },
            ],
            reason: 'test',
            source: 'test',
          },
        ],
      }),
    ).toThrow('Unknown override station'));
});
