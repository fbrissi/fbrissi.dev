#!/usr/bin/env bash
# Runs the Playwright E2E suite against the local Docker stack (`kool start`).
#
# - Chromium comes from the official Playwright image, pinned to the @playwright/test version in package.json.
# - The test container joins the app container's network namespace, so the browser opens http://localhost:3000
#   (a secure context, which the `__Host-` session cookies need). e2e/global-setup.ts forwards localhost:8790 to the
#   fake Google IdP container.
# - The local study group database is moved aside (tmp/study-group/local.sqlite.e2e-backup-<timestamp>) and recreated so every run
#   starts from the migrations, with DevTalk unclaimed. Set E2E_KEEP_DB=1 to skip the reset.
#
# Usage: kool run e2e [playwright test args]
set -euo pipefail

cd "$(dirname "$0")/.."

version="$(sed -n 's/.*"@playwright\/test": "\([^"]*\)".*/\1/p' package.json)"
image="mcr.microsoft.com/playwright:v${version}-noble"

app="$(docker compose ps -q app)"
if [ -z "$app" ]; then
  echo "The app container isn't running. Start the stack with: kool start" >&2
  exit 1
fi

if [ "${E2E_KEEP_DB:-}" != "1" ]; then
  db="tmp/study-group/local.sqlite"
  stamp="$(date +%Y%m%d%H%M%S)"
  docker compose stop study-group-api >/dev/null
  for suffix in "" "-wal" "-shm"; do
    if [ -f "${db}${suffix}" ]; then mv "${db}${suffix}" "${db}${suffix}.e2e-backup-${stamp}"; fi
  done
  docker compose start study-group-api >/dev/null
  echo "Reset the local study group database (previous copy: ${db}.e2e-backup-${stamp})."
  for _ in $(seq 1 60); do
    if docker run --rm --network "container:${app}" "$image" \
      node -e "fetch('http://localhost:3000/api/study-group/me').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

exec docker run --rm --init --ipc=host \
  --network "container:${app}" \
  -v "$PWD:/app" -w /app \
  -e CI="${CI:-}" \
  "$image" \
  yarn e2e "$@"
