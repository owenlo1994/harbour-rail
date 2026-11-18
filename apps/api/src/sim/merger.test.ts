import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TripMerger, resolveRoutes } from './merger';
import { normalizeSchedule } from '../schedules';
import { liveNetwork } from '../trains';
import {
  LiveMotion,
  hkTime,
  timelineDistance,
  routeLengths,
  pointAtDistance,
  type OfficialBoard,
} from '@hk-mtr/shared/live';
import config from '../../../../data/config/segment_times.json';
const raw = (key: string) =>
  JSON.parse(readFileSync(`data/raw/next-train-20261118/${key}.json`, 'utf8'));
const now = hkTime('2026-11-18 09:00:00');
function board(line: 'TWL' | 'TKL' | 'EAL', station: string) {
  return normalizeSchedule(
    raw(`${line}-${station}`),
    line,
    station,
    now,
  ) as OfficialBoard;
}
describe('official forecast virtual trips', () => {
  it('uses the dictionary direction, terminal and branch, never cross-matches Lo Wu/Lok Ma Chau or Po Lam/LOHAS', () => {
    expect(
      resolveRoutes(liveNetwork, 'TKL', 'UP', 'TKO', 'LHP', null).every(
        (r) =>
          r.stops.some((s) => s.code === 'LHP') &&
          !r.stops.some((s) => s.code === 'POA'),
      ),
    ).toBe(true);
    expect(
      resolveRoutes(liveNetwork, 'EAL', 'UP', 'SHS', 'LOW', null).every(
        (r) =>
          r.stops.some((s) => s.code === 'LOW') &&
          !r.stops.some((s) => s.code === 'LMC'),
      ),
    ).toBe(true);
    expect(
      resolveRoutes(liveNetwork, 'EAL', 'UP', 'SHT', 'LOW', 'RAC').every(
        (r) => r.via === 'RAC' && r.stops.some((s) => s.code === 'RAC'),
      ),
    ).toBe(true);
    expect(
      resolveRoutes(liveNetwork, 'TWL', 'DOWN', 'ADM', 'TSW', null),
    ).toHaveLength(0);
  });
  it('merges real adjacent-station forecasts and calibrates repeated event offsets', () => {
    const result = new TripMerger(liveNetwork, config).build(
      [board('TKL', 'TKO'), board('TKL', 'TIK')],
      now,
    );
    expect(result.unmapped).toBe(0);
    expect(
      result.trains.some((t) => t.dest === 'LHP' && t.evidenceCount === 2),
    ).toBe(true);
    expect(
      result.trains.some((t) => t.dest === 'POA' && t.evidenceCount === 2),
    ).toBe(true);
    expect(new Set(result.trains.map((t) => t.id)).size).toBe(
      result.trains.length,
    );
  });
  it('keeps identities on unchanged and modestly revised forecasts', () => {
    const merger = new TripMerger(liveNetwork, config),
      boards = [board('TWL', 'ADM'), board('TWL', 'TST')];
    const a = merger.build(boards, now);
    const b = merger.build(boards, now + 1000);
    expect(b.trains.map((t) => t.id)).toEqual(a.trains.map((t) => t.id));
    const revised = structuredClone(boards);
    for (const bo of revised)
      for (const rows of Object.values(bo.directions))
        for (const r of rows)
          r.time = new Date(hkTime(r.time) + 5000 + 8 * 3600000)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');
    const c = merger.build(revised, now + 2000);
    expect(c.trains.some((t) => a.trains.some((old) => old.id === t.id))).toBe(
      true,
    );
  });
  it('hits a frozen official forecast at its exact timestamp on the original path', () => {
    const result = new TripMerger(liveNetwork, config).build(
      [board('TKL', 'TIK'), board('TKL', 'TKO')],
      now,
    );
    const trip = result.trains.find(
      (t) => t.dest === 'LHP' && t.direction === 'UP',
    )!;
    expect(trip).toBeDefined();
    const point = trip.points.find((p) => p.official && p.at > now)!;
    expect(point.at - trip.sourceTime).toBe(60000);
    expect(timelineDistance(trip.points, point.at)).toBeCloseTo(
      point.distance,
      5,
    );
    const motion = new LiveMotion();
    for (let t = now; t < point.at; t += 250) motion.sample(trip, t);
    expect(motion.sample(trip, point.at).distance).toBeCloseTo(
      point.distance,
      2,
    );
    const route = liveNetwork.routes.find((r) => r.id === trip.pathId)!,
      lengths = routeLengths(route.path);
    const actual = pointAtDistance(
      route.path,
      lengths,
      timelineDistance(trip.points, point.at),
    );
    expect(actual.coordinates.every(Number.isFinite)).toBe(true);
  });
  it('resynchronizes to the official clock after background suspension', () => {
    const trip = new TripMerger(liveNetwork, config)
      .build([board('TKL', 'TIK'), board('TKL', 'TKO')], now)
      .trains.find((t) => t.dest === 'LHP')!;
    const motion = new LiveMotion();
    motion.sample(trip, now);
    const point = trip.points.find((p) => p.official && p.at > now)!;
    expect(motion.sample(trip, point.at).distance).toBeCloseTo(
      point.distance,
      5,
    );
  });
  it('smooths corrections, never reverses or teleports, and fades interrupted data', () => {
    const trip = new TripMerger(liveNetwork, config).build(
      [board('TWL', 'ADM'), board('TWL', 'TST')],
      now,
    ).trains[0];
    expect(trip).toBeDefined();
    const motion = new LiveMotion(),
      a = motion.sample(trip, now),
      updated = {
        ...trip,
        revision: 'revised',
        points: trip.points.map((p) => ({ ...p, at: p.at - 45000 })),
      };
    const b = motion.sample(updated, now + 16);
    expect(b.distance).toBeGreaterThanOrEqual(a.distance);
    expect(b.distance - a.distance).toBeLessThanOrEqual(
      trip.nominalSpeedMps * 2 * 0.016 + 0.001,
    );
    expect(motion.sample(trip, trip.sourceTime + 90000).state).toBe(
      'interrupted',
    );
    expect(motion.sample(trip, trip.sourceTime + 106000).opacity).toBe(0);
  });
  it('distinguishes actual timeType, dictionary timetype, departure and dummy fields', () => {
    const eal = board('EAL', 'SHS');
    expect(eal.directions.UP[0].timeType).toBe('A');
    const departure = structuredClone(eal);
    departure.directions.UP = departure.directions.UP.slice(0, 1);
    departure.directions.UP[0].timeType = 'D';
    departure.directions.DOWN = [];
    const trips = new TripMerger(liveNetwork, config).build(
      [departure],
      now,
    ).trains;
    const p = trips.flatMap((t) => t.points).find((p) => p.official)!;
    expect(p.kind).toBe('departure');
    expect(p.at).toBe(hkTime(departure.directions.UP[0].time));
    const changed = raw('TWL-ADM');
    for (const rows of Object.values(changed.data['TWL-ADM']) as unknown[])
      if (Array.isArray(rows))
        for (const r of rows) {
          r.ttnt = '999';
          r.valid = 'invalid';
        }
    expect(
      (normalizeSchedule(changed, 'TWL', 'ADM', now) as OfficialBoard)
        .directions.UP[0].time,
    ).toBe(board('TWL', 'ADM').directions.UP[0].time);
  });
  it('accepts only recorded short-turn exceptions and clamps their timelines at the destination', () => {
    const evidence = JSON.parse(
      readFileSync('data/reports/observed-short-turns.json', 'utf8'),
    );
    expect(
      evidence.entries.some((e: { cachedEntry: { result: OfficialBoard } }) =>
        e.cachedEntry.result.directions.DOWN.some((r) => r.dest === 'HOM'),
      ),
    ).toBe(true);
    expect(
      resolveRoutes(liveNetwork, 'KTL', 'DOWN', 'MOK', 'HOM', null),
    ).not.toHaveLength(0);
    expect(
      resolveRoutes(liveNetwork, 'TML', 'UP', 'AUS', 'MEF', null),
    ).not.toHaveLength(0);
    expect(
      resolveRoutes(liveNetwork, 'TML', 'DOWN', 'AUS', 'DIH', null),
    ).not.toHaveLength(0);
    expect(
      resolveRoutes(liveNetwork, 'TML', 'UP', 'TAW', 'HUH', null),
    ).toHaveLength(0);
    const rawShort = raw('TML-AUS-short-turn');
    const sample = normalizeSchedule(
      rawShort,
      'TML',
      'AUS',
      now,
    ) as OfficialBoard;
    const found = sample.directions.UP.find((r) => r.dest === 'MEF');
    expect(found).toBeDefined();
    // Construct a fixed 60-second first forecast from a genuinely observed short turn.
    const synthetic = structuredClone(sample);
    synthetic.updatedAt = '2026-11-18 09:00:00';
    synthetic.directions.DOWN = [];
    synthetic.directions.UP = [
      { ...found!, seq: 1, time: '2026-11-18 09:01:00' },
    ];
    const result = new TripMerger(liveNetwork, config).build([synthetic], now);
    const trip = result.trains.find((t) => t.dest === 'MEF')!;
    expect(trip).toBeDefined();
    const path = liveNetwork.routes.find((r) => r.id === trip.pathId)!;
    const terminus = path.stops.find((s) => s.code === 'MEF')!.distance;
    expect(trip.points.every((p) => p.distance <= terminus)).toBe(true);
  });
  it('keeps unsupported destination observations out and never promotes an alert into a train', () => {
    const bo = board('EAL', 'SHS');
    bo.directions.UP[0].dest = 'XYZ';
    expect(new TripMerger(liveNetwork, config).build([bo], now).unmapped).toBe(
      1,
    );
    expect(
      normalizeSchedule(
        { status: 0, message: 'Service alert' },
        'EAL',
        'SHS',
        now,
      ).state,
    ).toBe('unavailable');
  });
});
