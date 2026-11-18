import {
  interchangeOverridesSchema,
  keyOf,
  type BuildWarning,
} from '../../packages/shared/src/index.js';
import type { CsvStation } from './csv.js';

export function buildInterchanges(stations: CsvStation[], input: unknown) {
  const overrides = interchangeOverridesSchema.parse(input);
  const keys = new Set(stations.map((s) => s.key));
  const warnings: BuildWarning[] = [
    {
      code: 'CROSS_CODE_INTERCHANGES_UNVERIFIED',
      message:
        'Different station codes are never merged automatically. Cross-code interchange paths require verified manual overrides.',
    },
  ];
  const buckets = new Map<string, CsvStation[]>();
  const codeNames = new Map<string, Set<string>>();
  const nameCodes = new Map<string, Set<string>>();
  const normalise = (name: string) => name.normalize('NFC').replace(/\s/g, '');
  for (const station of stations) {
    const name = normalise(station.chineseName);
    const k = `${station.stationCode}:${name}`;
    buckets.set(k, [...(buckets.get(k) ?? []), station]);
    codeNames.set(
      station.stationCode,
      new Set([...(codeNames.get(station.stationCode) ?? []), name]),
    );
    nameCodes.set(
      name,
      new Set([...(nameCodes.get(name) ?? []), station.stationCode]),
    );
  }
  for (const [code, names] of codeNames)
    if (names.size > 1)
      warnings.push({
        code: 'CODE_NAME_CONFLICT',
        message: `${code} has different Chinese names: ${[...names].join(', ')}`,
        members: stations
          .filter((s) => s.stationCode === code)
          .map((s) => s.key),
      });
  for (const [name, codes] of nameCodes)
    if (codes.size > 1)
      warnings.push({
        code: 'NAME_CODE_CONFLICT',
        message: `${name} has different station codes: ${[...codes].join(', ')}`,
        members: stations
          .filter((s) => normalise(s.chineseName) === name)
          .map((s) => s.key),
      });
  const parent = new Map(stations.map((s) => [s.key, s.key]));
  function find(key: string): string {
    const p = parent.get(key)!;
    if (p === key) return key;
    const root = find(p);
    parent.set(key, root);
    return root;
  }
  function union(members: string[]) {
    const root = find(members[0]);
    members.slice(1).forEach((key) => parent.set(find(key), root));
  }
  for (const group of buckets.values())
    if (group.length > 1 && codeNames.get(group[0].stationCode)!.size === 1)
      union(group.map((s) => s.key));
  const manualMembers = new Set<string>();
  const ids = new Set<string>();
  for (const group of overrides.groups) {
    if (ids.has(group.id))
      throw new Error(`Duplicate interchange override id: ${group.id}`);
    ids.add(group.id);
    const members = group.members.map(keyOf);
    if (new Set(members).size !== members.length)
      throw new Error(`Duplicate override members: ${group.id}`);
    for (const member of members) {
      if (!keys.has(member))
        throw new Error(`Unknown override station: ${member}`);
      if (manualMembers.has(member))
        throw new Error(`Overlapping interchange overrides: ${member}`);
      manualMembers.add(member);
    }
    // Manual override takes precedence: detach these members from automatic candidates.
    for (const member of members) {
      const remaining = [...parent.keys()].filter(
        (k) => k !== member && find(k) === find(member),
      );
      if (remaining.length) {
        const replacement = remaining[0];
        remaining.forEach((k) => parent.set(k, replacement));
      }
      parent.set(member, member);
    }
    union(members);
  }
  const groups = new Map<string, string[]>();
  stations.forEach((s) => {
    const root = find(s.key);
    groups.set(root, [...(groups.get(root) ?? []), s.key]);
  });
  return {
    interchanges: [...groups.values()]
      .filter((g) => g.length > 1)
      .map((members) => ({
        members: members.sort(),
        method: members.some((m) => manualMembers.has(m))
          ? ('manual-override' as const)
          : ('code-and-chinese-name' as const),
      })),
    warnings,
  };
}
