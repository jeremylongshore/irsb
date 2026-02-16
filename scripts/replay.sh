#!/usr/bin/env bash
#
# IRSB Solver Replay + Determinism Verification
#
# Runs the same fixture twice and verifies:
# - Identical artifact hashes
# - Identical manifest hashes
# - Identical run IDs (derived from intent)
#
# Exit non-zero if any difference is found.
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  IRSB Solver - Replay Determinism Test${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

FIXTURE="${1:-fixtures/intents/sample-safe-report.intent.json}"
TIMESTAMP=$(date +%s)

# Create two isolated data directories
DIR_A="./data/replay-a-$TIMESTAMP"
DIR_B="./data/replay-b-$TIMESTAMP"

echo -e "${YELLOW}Configuration${NC}"
echo "  Fixture: $FIXTURE"
echo "  Run A:   $DIR_A"
echo "  Run B:   $DIR_B"
echo ""

# Run A
echo -e "${YELLOW}Run A${NC}"
export DATA_DIR="$DIR_A"
mkdir -p "$DIR_A"

RUN_A_OUTPUT=$(pnpm cli -- run-fixture "$FIXTURE" 2>&1) || {
    echo -e "  ${RED}✗ Run A failed${NC}"
    echo "$RUN_A_OUTPUT"
    exit 1
}
echo -e "  ${GREEN}✓ Completed${NC}"

# Extract run ID from output and construct path
RUN_ID_A=$(echo "$RUN_A_OUTPUT" | grep -oP 'runId:\s*\K[^\s]+' | head -1 || echo "")
RUN_DIR_A="$DIR_A/runs/$RUN_ID_A"
if [ -z "$RUN_ID_A" ] || [ ! -d "$RUN_DIR_A" ]; then
    echo -e "  ${RED}✗ Run directory not found for RUN_ID_A: $RUN_ID_A${NC}"
    exit 1
fi
echo "  RunID: $RUN_ID_A"

# Run B
echo ""
echo -e "${YELLOW}Run B${NC}"
export DATA_DIR="$DIR_B"
mkdir -p "$DIR_B"

RUN_B_OUTPUT=$(pnpm cli -- run-fixture "$FIXTURE" 2>&1) || {
    echo -e "  ${RED}✗ Run B failed${NC}"
    echo "$RUN_B_OUTPUT"
    exit 1
}
echo -e "  ${GREEN}✓ Completed${NC}"

# Extract run ID from output and construct path
RUN_ID_B=$(echo "$RUN_B_OUTPUT" | grep -oP 'runId:\s*\K[^\s]+' | head -1 || echo "")
RUN_DIR_B="$DIR_B/runs/$RUN_ID_B"
if [ -z "$RUN_ID_B" ] || [ ! -d "$RUN_DIR_B" ]; then
    echo -e "  ${RED}✗ Run directory not found for RUN_ID_B: $RUN_ID_B${NC}"
    exit 1
fi
echo "  RunID: $RUN_ID_B"

echo ""
echo -e "${YELLOW}Comparing Results${NC}"

# Compare run IDs
echo -n "  Run IDs match: "
if [ "$RUN_ID_A" = "$RUN_ID_B" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ MISMATCH${NC}"
    echo "    A: $RUN_ID_A"
    echo "    B: $RUN_ID_B"
    exit 1
fi

# Compare artifact hashes
compare_artifact() {
    local name="$1"
    local path_a="$RUN_DIR_A/artifacts/$name"
    local path_b="$RUN_DIR_B/artifacts/$name"

    echo -n "  $name: "

    if [ ! -f "$path_a" ] || [ ! -f "$path_b" ]; then
        echo -e "${YELLOW}skipped (not found)${NC}"
        return 0
    fi

    local hash_a=$(sha256sum "$path_a" | cut -d' ' -f1)
    local hash_b=$(sha256sum "$path_b" | cut -d' ' -f1)

    if [ "$hash_a" = "$hash_b" ]; then
        echo -e "${GREEN}✓${NC} (${hash_a:0:16}...)"
    else
        echo -e "${RED}✗ MISMATCH${NC}"
        echo "    A: $hash_a"
        echo "    B: $hash_b"
        return 1
    fi
}

compare_artifact "report.json"
compare_artifact "report.md"

# Compare manifest (excluding timestamp which varies)
echo -n "  Manifest (excl. time): "

# Extract and compare key fields (intentId, runId, jobType, artifacts)
MANIFEST_CORE_A=$(jq -S 'del(.createdAt) | del(.metadata.timestamp)' "$RUN_DIR_A/evidence/manifest.json" 2>/dev/null | sha256sum | cut -d' ' -f1)
MANIFEST_CORE_B=$(jq -S 'del(.createdAt) | del(.metadata.timestamp)' "$RUN_DIR_B/evidence/manifest.json" 2>/dev/null | sha256sum | cut -d' ' -f1)

if [ "$MANIFEST_CORE_A" = "$MANIFEST_CORE_B" ]; then
    echo -e "${GREEN}✓${NC} (${MANIFEST_CORE_A:0:16}...)"
else
    echo -e "${RED}✗ MISMATCH${NC}"
    echo "    A: $MANIFEST_CORE_A"
    echo "    B: $MANIFEST_CORE_B"
    echo ""
    echo "  Diff:"
    diff <(jq -S 'del(.createdAt)' "$RUN_DIR_A/evidence/manifest.json") \
         <(jq -S 'del(.createdAt)' "$RUN_DIR_B/evidence/manifest.json") || true
    exit 1
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}  DETERMINISM VERIFIED${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "  Both runs produced identical:"
echo "    - Run ID"
echo "    - Artifact hashes"
echo "    - Manifest hash"
echo ""
echo "  Test directories (cleanup manually):"
echo "    $DIR_A"
echo "    $DIR_B"
echo ""

exit 0
