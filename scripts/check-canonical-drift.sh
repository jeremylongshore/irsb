#!/bin/bash
# Check that 000-* files match the canonical source (irsb-solver)
# Usage: ./scripts/check-canonical-drift.sh [canonical-repo-path]
#
# Returns exit code 0 if checksums match, 1 if drift detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DOCS="${SCRIPT_DIR}/../000-docs"
CANONICAL_REPO="${1:-/home/jeremy/000-projects/irsb-solver}"
CANONICAL_DOCS="${CANONICAL_REPO}/000-docs"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

has_drift=0

log_info "Checking canonical doc drift against: ${CANONICAL_REPO}"
echo ""

# Check each 000-* file
for canonical_file in "$CANONICAL_DOCS"/000-*.md; do
    if [ -f "$canonical_file" ]; then
        filename=$(basename "$canonical_file")
        local_file="$LOCAL_DOCS/$filename"

        if [ ! -f "$local_file" ]; then
            log_error "MISSING: $filename"
            has_drift=1
            continue
        fi

        canonical_sum=$(shasum -a 256 "$canonical_file" | cut -d' ' -f1)
        local_sum=$(shasum -a 256 "$local_file" | cut -d' ' -f1)

        if [ "$canonical_sum" = "$local_sum" ]; then
            log_info "OK: $filename"
        else
            log_error "DRIFT: $filename"
            echo "  Canonical: ${canonical_sum:0:16}..."
            echo "  Local:     ${local_sum:0:16}..."
            has_drift=1
        fi
    fi
done

echo ""
if [ $has_drift -eq 0 ]; then
    log_info "All canonical docs are in sync!"
    exit 0
else
    log_error "Drift detected! Run sync script from irsb-solver to fix."
    exit 1
fi
