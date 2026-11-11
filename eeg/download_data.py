"""Download OpenNeuro ds004504 (CC0) from the public OpenNeuro S3 bucket.

Miltiadous et al. (2023), "A Dataset of Scalp EEG Recordings of Alzheimer's Disease, Frontotemporal
Dementia and Healthy Subjects from Routine EEG", Data 8(6):95. doi:10.18112/openneuro.ds004504.v1.0.9

Usage:  python download_data.py <target_dir> [raw|derivatives|all]
Files already present with the right size are skipped, so the script can be re-run after an interruption.
"""
import concurrent.futures as cf
import os
import re
import sys
import urllib.parse
import urllib.request

BASE = 'https://s3.amazonaws.com/openneuro.org'
DATASET = 'ds004504'


def listing():
    token, items = None, []
    while True:
        q = {'list-type': '2', 'prefix': DATASET + '/', 'max-keys': '1000'}
        if token:
            q['continuation-token'] = token
        xml = urllib.request.urlopen(BASE + '?' + urllib.parse.urlencode(q), timeout=60).read().decode()
        items += [(k, int(s)) for k, s in re.findall(r'<Key>([^<]+)</Key>.*?<Size>(\d+)</Size>', xml)]
        m = re.search(r'<NextContinuationToken>([^<]+)<', xml)
        if not m:
            return items
        token = m.group(1)


def fetch(job):
    key, size, dest = job
    if os.path.exists(dest) and os.path.getsize(dest) == size:
        return key, 'skip'
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + '.part'
    for attempt in range(4):
        try:
            with urllib.request.urlopen(BASE + '/' + urllib.parse.quote(key), timeout=120) as r, open(tmp, 'wb') as f:
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    f.write(chunk)
            if os.path.getsize(tmp) == size:
                os.replace(tmp, dest)
                return key, 'ok'
        except Exception as e:  # network hiccup: try again
            err = e
    return key, 'FAILED'


def main():
    target = os.path.abspath(sys.argv[1])
    part = sys.argv[2] if len(sys.argv) > 2 else 'all'
    jobs = []
    for key, size in listing():
        rel = key[len(DATASET) + 1:]
        if rel.startswith('.') or '..' in rel.split('/'):
            continue
        is_deriv = rel.startswith('derivatives/')
        is_big = rel.endswith('.set')
        if is_big and ((part == 'raw' and is_deriv) or (part == 'derivatives' and not is_deriv)):
            continue
        jobs.append((key, size, os.path.join(target, *rel.split('/'))))
    jobs.sort(key=lambda j: ('derivatives/' in j[0], j[0]))        # raw first
    total = sum(j[1] for j in jobs)
    print(f'{len(jobs)} files, {total / 1e9:.2f} GB -> {target}', flush=True)
    done = failed = 0
    with cf.ThreadPoolExecutor(6) as ex:
        for key, status in ex.map(fetch, jobs):
            done += 1
            failed += status == 'FAILED'
            if status == 'FAILED' or done % 20 == 0 or done == len(jobs):
                print(f'{done}/{len(jobs)} {status} {key}', flush=True)
    print('FINISHED, failed:', failed, flush=True)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
