#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "dev" ]; then
  exec kool docker --publish=3000:3000 node:20-bookworm corepack yarn --cwd /app "$@"
fi

exec kool docker node:20-bookworm corepack yarn --cwd /app "$@"
