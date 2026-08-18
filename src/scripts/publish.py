#!/usr/bin/env python3
"""Rebuild the decks and copy them to the site root, where Pages serves them.

    python3 src/scripts/build_data.py     # src/data/chunks/*  ->  src/build/data/*
    python3 src/scripts/publish.py        # src/build/data/*   ->  ./data/*
"""
import os, shutil, subprocess, sys

SRC  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # <repo>/src
REPO = os.path.dirname(SRC)
BUILT = os.path.join(SRC, 'build', 'data')
OUT   = os.path.join(REPO, 'data')

if '--skip-build' not in sys.argv:
    subprocess.check_call([sys.executable, os.path.join(SRC, 'scripts', 'build_data.py')])

os.makedirs(OUT, exist_ok=True)
n = 0
for f in sorted(os.listdir(BUILT)):
    if f.endswith('.json'):
        shutil.copy2(os.path.join(BUILT, f), os.path.join(OUT, f))
        n += 1
print(f'published {n} deck files to {os.path.relpath(OUT, REPO)}/')
