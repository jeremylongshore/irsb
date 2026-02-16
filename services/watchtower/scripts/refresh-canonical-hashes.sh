#!/bin/bash
# Regenerate scripts/canonical-hashes.json from current 000-docs/000-*.md files.
# Run after syncing canonical docs from irsb-solver.
#
# Usage: ./scripts/refresh-canonical-hashes.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="${SCRIPT_DIR}/../000-docs"
HASH_FILE="${SCRIPT_DIR}/canonical-hashes.json"

files=("$DOCS_DIR"/000-*.md)

if [ ${#files[@]} -eq 0 ] || [ ! -f "${files[0]}" ]; then
  echo "No 000-*.md files found in $DOCS_DIR"
  exit 1
fi

{
  echo "{"
  first=true
  for f in "${files[@]}"; do
    filename=$(basename "$f")
    hash=$(sha256sum "$f" | cut -d' ' -f1)
    if [ "$first" = true ]; then
      first=false
    else
      printf ",\n"
    fi
    printf '  "%s": "%s"' "$filename" "$hash"
  done
  printf "\n"
  echo "}"
} > "$HASH_FILE"

echo "Wrote $(echo "${files[@]}" | wc -w) hash(es) to $HASH_FILE"
