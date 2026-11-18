import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, parseMtrCsv } from './csv.js';

const source = readFileSync(
  new URL('../../data/raw/mtr_lines_and_stations.csv', import.meta.url),
  'utf8',
);
const csv = parseMtrCsv(source);
const mini = (rows: string[]) => [CSV_COLUMNS.join(','), ...rows].join('\n');
describe('official CSV snapshot', () => {
  it('validates 270 records, 97 codes and 120 line/code keys', () => {
    expect(csv.rows).toHaveLength(270);
    expect(new Set(csv.stations.map((s) => s.stationCode)).size).toBe(97);
    expect(csv.stations).toHaveLength(120);
    expect(new Set(csv.stations.map((s) => s.key)).size).toBe(120);
    expect(csv.blankRecords).toBe(3);
  });
  it('preserves distinct line-specific station IDs for Hong Kong', () => {
    expect(
      csv.stations
        .filter((s) => s.stationCode === 'HOK')
        .map((s) => [s.key, s.stationId]),
    ).toEqual([
      ['AEL:HOK', '44'],
      ['TCL:HOK', '39'],
    ]);
  });
  it('keeps Lo Wu and Lok Ma Chau routes separate in both directions', () => {
    const routes = csv.routes.filter((r) => r.line === 'EAL');
    expect(routes).toHaveLength(4);
    expect(
      routes.find((r) => r.direction === 'UT')?.stations.slice(-2),
    ).toEqual(['SHS', 'LOW']);
    expect(
      routes.find((r) => r.direction === 'LMC-UT')?.stations.slice(-2),
    ).toEqual(['SHS', 'LMC']);
    expect(
      routes.find((r) => r.direction === 'LMC-DT')?.stations.slice(0, 2),
    ).toEqual(['LMC', 'SHS']);
    expect(routes.filter((r) => r.branchToken === 'LMC')).toHaveLength(2);
    routes.forEach((r) =>
      expect(r.stations.includes('LOW') && r.stations.includes('LMC')).toBe(
        false,
      ),
    );
  });
  it('preserves actual TKS branch extent without inventing through services', () => {
    const routes = csv.routes.filter((r) => r.line === 'TKL');
    expect(routes.find((r) => r.direction === 'TKS-UT')).toMatchObject({
      branchToken: 'TKS',
      directionFamily: 'UT',
      stations: ['TIK', 'TKO', 'LHP'],
    });
    expect(routes.find((r) => r.direction === 'TKS-DT')?.stations).toEqual([
      'LHP',
      'TKO',
      'TIK',
    ]);
    expect(routes.find((r) => r.direction === 'UT')?.stations.at(-1)).toBe(
      'POA',
    );
    routes.forEach((r) =>
      expect(r.stations.includes('POA') && r.stations.includes('LHP')).toBe(
        false,
      ),
    );
  });
  it('preserves complete Tuen Ma sequence and reverses its opposite direction', () => {
    const up = csv.routes.find(
      (r) => r.line === 'TML' && r.direction === 'UT',
    )!;
    const down = csv.routes.find(
      (r) => r.line === 'TML' && r.direction === 'DT',
    )!;
    expect(up.stations).toHaveLength(27);
    expect(up.stations).toEqual([...down.stations].reverse());
  });
});
describe('CSV schema guards', () => {
  it('accepts BOM and quoted names', () => {
    const r = parseMtrCsv(
      '\ufeff' + mini(['TCL,UT,HOK,39,香港,"Hong Kong",1.00']),
    );
    expect(r.stations[0].englishName).toBe('Hong Kong');
  });
  it('rejects missing or renamed headers', () =>
    expect(() =>
      parseMtrCsv(source.replace('Station Code', 'Stop Code')),
    ).toThrow('CSV_SCHEMA_MISMATCH'));
  it.each([
    'TCL,UP,HOK,39,香港,Hong Kong,1',
    'TCL,UT,HOK,39,香港,Hong Kong,-1',
    'XXX,UT,HOK,39,香港,Hong Kong,1',
  ])('rejects invalid fields: %s', (row) =>
    expect(() => parseMtrCsv(mini([row]))).toThrow('CSV_INVALID_RECORD'),
  );
  it('rejects duplicate station/direction records', () =>
    expect(() =>
      parseMtrCsv(
        mini([
          'TCL,UT,HOK,39,香港,Hong Kong,1',
          'TCL,UT,HOK,39,香港,Hong Kong,2',
        ]),
      ),
    ).toThrow('CSV_DUPLICATE'));
  it('rejects ambiguous sequence order', () =>
    expect(() =>
      parseMtrCsv(
        mini([
          'TCL,UT,HOK,39,香港,Hong Kong,1',
          'TCL,UT,KOW,40,九龍,Kowloon,1',
        ]),
      ),
    ).toThrow('CSV_DUPLICATE_SEQUENCE'));
  it('rejects conflicting metadata for a line/code key', () =>
    expect(() =>
      parseMtrCsv(
        mini([
          'TCL,UT,HOK,39,香港,Hong Kong,1',
          'TCL,DT,HOK,40,香港,Hong Kong,1',
        ]),
      ),
    ).toThrow('CSV_STATION_CONFLICT'));
});
