#!/usr/bin/env python3
"""Regenerate src/data/scattering.json from the vendored Waasmaier–Kirfel table.

Usage:
    python3 scripts/generate-scattering.py

Data source: DABAX f0_WaasKirf.dat (see scripts/vendor/).
The table is distributed with periodictable and derives from
International Tables for Crystallography Vol. C (1992).
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'scripts' / 'vendor' / 'f0_WaasKirf.dat'
TARGET = ROOT / 'src' / 'data' / 'scattering.json'


def main() -> None:
    entries = {}
    current = None
    for line in SOURCE.read_text().splitlines():
        if line.startswith('#S'):
            parts = line.split()
            current = {'z': int(parts[1]), 'symbol': parts[2]}
        elif line.startswith(' ') and current is not None:
            values = [float(v) for v in line.split()]
            current['a'] = values[0:5]
            current['c'] = values[5]
            current['b'] = values[6:11]
            entries[current['symbol']] = {
                'z': current['z'],
                'a': current['a'],
                'c': current['c'],
                'b': current['b'],
            }
            current = None
    TARGET.write_text(json.dumps(entries, ensure_ascii=False, separators=(',', ':')))
    print(f'wrote {len(entries)} entries to {TARGET.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
