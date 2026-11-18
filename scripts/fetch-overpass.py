"""One sequential acquisition round. Never called by build/dev/test."""
import datetime
import json
import os
from pathlib import Path
import subprocess
import time
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data' / 'raw'
MANIFEST = RAW / 'overpass-attempts.json'
UA = 'hk-mtr-live/0.1 (+' + os.environ.get('MTR_CONTACT_EMAIL', 'CONTACT_EMAIL_NOT_PROVIDED') + ')'
ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://z.overpass-api.de/api/interpreter']
BBOX = '(22.15,113.80,22.57,114.45)'
QUERIES = [(kind, '[out:json][timeout:35];relation["type"="route"]["route"="' + kind + '"]["operator"~"MTR|港鐵",i]' + BBOX + ';out body geom;') for kind in ['subway', 'light_rail', 'train']]
QUERIES.append(('stations', '[out:json][timeout:35];node["railway"~"^(station|stop)$"]' + BBOX + ';out body;'))

def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def main():
    if MANIFEST.exists():
        raise SystemExit('Acquisition round already recorded. No retry without explicit authorisation; see data/raw/overpass-attempts.json.')
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = {'startedAt': stamp(), 'userAgent': UA, 'contactEmailMissing': 'CONTACT_EMAIL_NOT_PROVIDED' in UA, 'bbox': BBOX, 'attempts': [], 'complete': False}
    def persist():
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    persist()
    for index, endpoint in enumerate(ENDPOINTS):
        complete = True
        for kind, query in QUERIES:
            base = RAW / f'overpass-{index + 1}-{kind}'
            base.with_suffix('.overpass').write_text(query + '\n')
            headers = base.with_suffix('.headers.txt')
            body = base.with_suffix('.response.txt')
            result = subprocess.run(['curl', '--silent', '--show-error', '--max-time', '50', '--connect-timeout', '12', '--user-agent', UA, '--request', 'POST', '--data-urlencode', 'data=' + query, '--dump-header', str(headers), '--output', str(body), '--write-out', '%{http_code}', endpoint], capture_output=True, text=True)
            status = int(result.stdout.strip() or '0')
            record = {'endpoint': endpoint, 'queryType': kind, 'queryFile': str(base.with_suffix('.overpass').relative_to(ROOT)), 'retrievedAt': stamp(), 'httpStatus': status or None, 'curlExitCode': result.returncode, 'error': result.stderr.strip(), 'success': False}
            if result.returncode == 0 and status == 200:
                try:
                    data = json.loads(body.read_text())
                    if not isinstance(data.get('elements'), list) or data.get('remark'):
                        raise ValueError('Missing elements or Overpass remark: ' + str(data.get('remark')))
                    target = base.with_suffix('.json')
                    body.rename(target)
                    key_counts = Counter()
                    value_counts = {}
                    for el in data['elements']:
                        for key, value in el.get('tags', {}).items():
                            key_counts[key] += 1
                            value_counts.setdefault(key, Counter())[str(value)] += 1
                    stats = {'elements': len(data['elements']), 'keys': dict(key_counts), 'values': {key: dict(counts) for key, counts in value_counts.items()}}
                    base.with_suffix('.tags.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2) + '\n')
                    record.update({'success': True, 'file': str(target.relative_to(ROOT)), 'elementCount': len(data['elements'])})
                    print(json.dumps({'endpoint': endpoint, 'queryType': kind, 'tagStatistics': stats}, ensure_ascii=False), flush=True)
                except (ValueError, OSError) as exc:
                    record['error'] = str(exc)
            manifest['attempts'].append(record)
            persist()
            if not record['success']:
                if not record['error'] and body.exists():
                    record['error'] = body.read_text(errors='replace')[:500]
                    persist()
                print(json.dumps(record, ensure_ascii=False), flush=True)
                complete = False
                if status == 429:
                    wait = 30
                    for line in headers.read_text().splitlines() if headers.exists() else []:
                        if line.lower().startswith('retry-after:'):
                            try:
                                wait = max(wait, int(line.split(':', 1)[1].strip()))
                            except ValueError:
                                from email.utils import parsedate_to_datetime
                                try:
                                    wait = max(wait, int((parsedate_to_datetime(line.split(':', 1)[1].strip()) - datetime.datetime.now(datetime.timezone.utc)).total_seconds()) + 1)
                                except (ValueError, TypeError):
                                    pass
                    print(f'HTTP 429: waiting {wait} seconds before any further request.', flush=True)
                    time.sleep(wait)
                break
            time.sleep(1)
        if complete:
            manifest['complete'] = True
            manifest['completedAt'] = stamp()
            persist()
            print('Acquisition complete. Inspect tags and matching before building geometry.', flush=True)
            return
    manifest['completedAt'] = stamp()
    manifest['blocked'] = 'All endpoint rounds failed; no geometry inferred or substituted.'
    persist()
    raise SystemExit(2)

if __name__ == '__main__':
    main()
