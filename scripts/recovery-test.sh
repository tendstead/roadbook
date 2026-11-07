#!/bin/sh
set -eu
project="roadbook-recovery-$(date +%s)-$$"
scratch=$(mktemp -d /tmp/roadbook-recovery.XXXXXX)
compose() { docker compose -p "$project" -f compose.test.yaml "$@"; }
cleanup() { compose down -v --remove-orphans >/dev/null; rm -rf "$scratch"; }
trap cleanup EXIT INT TERM
compose build app restore-app
compose up -d --wait app
compose run --rm -T probe node /app/scripts/recovery.mjs seed > "$scratch/expected.json"
compose stop app
compose exec -T db pg_dump -U roadbook -d roadbook -Fc > "$scratch/database.dump"
compose cp app:/data/. "$scratch/files"
compose exec -T db createdb -U roadbook restored
compose exec -T db pg_restore -U roadbook -d restored --exit-on-error < "$scratch/database.dump"
compose create restore-app
compose cp "$scratch/files/." restore-app:/data/
compose run --rm --no-deps -u 0 --entrypoint sh restore-app -c 'chown -R 10001:10001 /data'
compose start --wait restore-app
BASE_URL=http://restore-app:8080 compose run --rm -T probe node /app/scripts/recovery.mjs verify < "$scratch/expected.json"
