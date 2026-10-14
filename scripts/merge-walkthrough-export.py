#!/usr/bin/env python3
"""Merge the three-page source export while retaining the public-only call tour."""
import argparse
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    '.nojekyll', 'index.html',
    'order-status/cedar-home-walkthrough.html',
    'single-turn/single-turn-walkthrough.html',
    'create-persona/create-persona-walkthrough.html',
)
CALL = 'twilio-call/twilio-call-walkthrough.html'


def merge(export: Path):
    # Validate everything before any replacement. Missing retained cards fail closed.
    for filename in FILES:
        if not (export / filename).is_file():
            raise ValueError(f'Incomplete source export: {filename}')
    if not (ROOT / CALL).is_file():
        raise ValueError('The retained call walkthrough is missing')
    old = (ROOT / 'index.html').read_text()
    cards = re.findall(r'<article\b[^>]*>.*?</article>', old, re.S)
    retained = [card for card in cards if f'href="{CALL}"' in card]
    if len(retained) != 1:
        raise ValueError('Expected exactly one retained call card in the public homepage')
    html = (export / 'index.html').read_text()
    if len(re.findall(r'<article\b', html)) != 3 or CALL in html:
        raise ValueError('Expected the reviewed three-walkthrough source catalog')
    if html.count('3 guided demos') != 1:
        raise ValueError('Source catalog count format changed; review the merge')
    grid = re.search(r'(<section class="demo-grid"[^>]*>)(.*?)(</section>)', html, re.S)
    if not grid:
        raise ValueError('Source catalog structure changed; review the merge')
    html = html[:grid.end(2)] + retained[0] + html[grid.end(2):]
    html = html.replace('3 guided demos', '4 guided demos')
    html = html.replace(
        'Prepared examples. Generation is simulated; audio playback and downloads are real.',
        'Prepared examples. Generation is simulated; audio playback and downloads are real. '
        'The retained call tour also offers an optional private mobile test.'
    )
    for filename in FILES:
        if filename == 'index.html':
            continue
        target = ROOT / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(export / filename, target)
    (ROOT / 'index.html').write_text(html)
    print('Merged three redesigned walkthroughs; retained the fourth card and tour. '
          'Backend, render.yaml and call-backend.json were not modified.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', type=Path, help='Private source .cache/github-pages directory')
    merge(parser.parse_args().export.resolve())
