#!/bin/sh
set -eu
mode=${1:?service or e2e}
case "$mode" in service|e2e) ;; *) exit 2;; esac
project="roadbook-test-$(date +%s)-$$"
cleanup() { docker compose -p "$project" -f compose.test.yaml down -v --remove-orphans >/dev/null; }
trap cleanup EXIT INT TERM
if [ "$mode" = service ]; then
  docker compose -p "$project" -f compose.test.yaml run --rm service
else
  docker compose -p "$project" -f compose.test.yaml build app
  docker compose -p "$project" -f compose.test.yaml run --rm browser
fi
