"""Three deterministic local passes, using pyosmium; no network access."""
import collections
import hashlib
import json
from pathlib import Path
import re
import sys
import osmium

ROOT = Path(__file__).resolve().parents[1]
PBF = ROOT / 'data/raw/hong-kong-latest.osm.pbf'
OUT = ROOT / 'data/reports/osm-extract.json'
if not PBF.is_file():
    raise SystemExit('PBF_INPUT_MISSING: data/raw/hong-kong-latest.osm.pbf; no download or Overpass fallback.')
expected_path = ROOT / 'data/raw' / (PBF.resolve().name + '.md5')
if not expected_path.is_file():
    raise SystemExit('PBF_MD5_SIDECAR_MISSING: no network fallback.')
expected_md5 = expected_path.read_text().split()[0]
actual_md5 = hashlib.file_digest(PBF.open('rb'), 'md5').hexdigest()
if actual_md5 != expected_md5:
    raise SystemExit('PBF_MD5_MISMATCH: local source differs from Geofabrik sidecar; stopped.')
relations, areas, ways, nodes = [], [], {}, {}
tcl_memberships = []
tcl_check_ids = {1176509649, 1558652644, 1558652643, 1558652640, 1558652637}
needed_ways, needed_nodes = set(), set()
stats = {kind: {'count': 0, 'keys': collections.Counter(), 'values': {}} for kind in ['route', 'way', 'railway-node', 'stop_area']}
def tags(obj):
    return dict(obj.tags)
def count(kind, t):
    s = stats[kind]; s['count'] += 1
    for key, value in t.items():
        s['keys'][key] += 1
        s['values'].setdefault(key, collections.Counter())[value] += 1
def relation(r):
    return {'id': r.id, 'tags': tags(r), 'members': [{'type': m.type, 'ref': m.ref, 'role': m.role} for m in r.members]}
class Relations(osmium.SimpleHandler):
    def relation(self, r):
        t = tags(r)
        if any(m.type == 'w' and m.ref in tcl_check_ids for m in r.members):
            tcl_memberships.append(relation(r))
        if t.get('type') == 'route' and t.get('route') in ['subway', 'light_rail', 'train'] and re.search('MTR|港鐵', t.get('operator', ''), re.I):
            relations.append(relation(r)); count('route', t)
            for m in r.members:
                if m.type == 'w': needed_ways.add(m.ref)
                if m.type == 'n': needed_nodes.add(m.ref)
        if t.get('public_transport') == 'stop_area':
            areas.append(relation(r)); count('stop_area', t)
            for m in r.members:
                if m.type == 'n': needed_nodes.add(m.ref)
class Ways(osmium.SimpleHandler):
    def way(self, w):
        if w.id not in needed_ways: return
        t = tags(w); refs = [n.ref for n in w.nodes]
        ways[str(w.id)] = {'id': w.id, 'tags': t, 'nodes': refs}; needed_nodes.update(refs); count('way', t)
class Nodes(osmium.SimpleHandler):
    def node(self, n):
        t = tags(n)
        rail = t.get('railway') in ['station', 'stop', 'halt', 'stop_position'] or t.get('public_transport') == 'stop_position'
        if rail: count('railway-node', t)
        if (rail or n.id in needed_nodes) and n.location.valid():
            nodes[str(n.id)] = {'id': n.id, 'tags': t, 'coordinates': [n.location.lon, n.location.lat]}
for handler in [Relations(), Ways(), Nodes()]:
    handler.apply_file(str(PBF))
    print(type(handler).__name__ + ' pass completed', flush=True)
r = osmium.io.Reader(str(PBF)); h = r.header()
header = {key: h.get(key) or None for key in ['osmosis_replication_timestamp', 'osmosis_replication_sequence_number', 'osmosis_replication_base_url', 'generator']};r.close()
metadata = {'sourceFile': PBF.resolve().name, 'sizeBytes': PBF.stat().st_size, 'sha256': hashlib.file_digest(PBF.open('rb'), 'sha256').hexdigest(), 'md5': hashlib.file_digest(PBF.open('rb'), 'md5').hexdigest(), 'header': header, 'reader': 'pyosmium 4.2.0', 'attribution': '© OpenStreetMap contributors', 'license': 'ODbL-1.0'}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({'metadata': metadata, 'relations': relations, 'tclWayMemberships': tcl_memberships, 'stopAreas': areas, 'ways': ways, 'nodes': nodes}, ensure_ascii=False, separators=(',', ':')) + '\n')
(ROOT / 'data/reports/osm-tags.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2) + '\n')
report = ['# 本地 Geofabrik PBF 實際 tag 統計', '', f"來源：`{metadata['sourceFile']}`；SHA-256：`{metadata['sha256']}`。", '', f"檔頭 replication timestamp：`{header['osmosis_replication_timestamp'] or '檔頭冇提供'}`。", '', '© OpenStreetMap contributors，ODbL 1.0。三次本地解析，沒有 Overpass fallback。railway-node 額外納入實際出現的 stop_position；不把它改名為 stop。', '']
for kind, s in stats.items():
    report += [f'## {kind}: {s["count"]} 個物件', '', '| Tag | 物件數 |', '| --- | --- |']
    for key, value in sorted(s['keys'].items()): report.append(f'| `{key}` | {value} |')
    report += ['', '重點實際值：', '']
    for key in ['operator', 'route', 'ref', 'railway', 'public_transport', 'tunnel', 'bridge', 'layer', 'railway:position']:
        report.append('- `' + key + '`：' + ('；'.join(f'`{v}` × {c}' for v, c in s['values'].get(key, {}).items()) or '未見') + '。')
    report += ['']
(ROOT / 'docs/osm-tag-report.md').write_text('\n'.join(report))
print(json.dumps({'relations':len(relations),'ways':len(ways),'nodes':len(nodes),'stopAreas':len(areas),'header':header,'refs':dict(collections.Counter(r['tags'].get('ref') for r in relations))},ensure_ascii=False),flush=True)
