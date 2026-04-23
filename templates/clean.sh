#!/usr/bin/env bash
set -euo pipefail

# Astro files
rm -rf .astro
rm -rf tmp-*
rm -rf dist

# Skip protected directories entirely
find . \
  \( -path './.claude' -o -path './.worktrees' \) -prune -o \
  \( -name '.DS_Store' -o -name 'Thumbs.db' -o -name '*.pyc' -o -name '*.pyo' -o -name '*~' \) \
  -print -delete

find . \
  \( -path './.claude' -o -path './.worktrees' \) -prune -o \
  -name '__pycache__' \
  -print -exec rm -rf {} +

# Prettier cache
rm -rf ./node_modules/.cache/prettier/.prettier-cache