#!/bin/sh
set -eu
cat /usr/local/go/LICENSE
go list -m -f '{{if .Version}}{{.Path}} {{.Version}} {{.Dir}}{{end}}' all |
while read -r module_name module_version module_dir; do
  [ -n "$module_dir" ] || continue
  printf '\n\n%s %s\n' "$module_name" "$module_version"
  found=0
  for candidate in LICENSE LICENSE.txt LICENSE.md COPYING NOTICE; do
    if [ -f "$module_dir/$candidate" ]; then
      cat "$module_dir/$candidate"
      found=1
    fi
  done
  if [ "$found" -ne 1 ]; then
    echo "Missing license for $module_name" >&2
    exit 1
  fi
done
