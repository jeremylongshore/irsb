#!/usr/bin/env bash
#
# IRSB Solver Demo Script
#
# Runs a complete end-to-end demo:
# 1. Check config
# 2. Run fixture (intent → evidence → receipt)
# 3. Verify evidence bundle
# 4. Print summary
#
# Exit non-zero on any failure.
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  IRSB Solver - End-to-End Demo${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Create temp data directory
DEMO_DIR="./data/demo-$(date +%s)"
export DATA_DIR="$DEMO_DIR"
export RECEIPTS_PATH="$DEMO_DIR/receipts.jsonl"
export REFUSALS_PATH="$DEMO_DIR/refusals.jsonl"
export EVIDENCE_DIR="$DEMO_DIR/evidence"

echo -e "${YELLOW}Step 0: Setup${NC}"
echo "  DATA_DIR: $DEMO_DIR"
mkdir -p "$DEMO_DIR"
echo ""

# Step 1: Check config
echo -e "${YELLOW}Step 1: Check Configuration${NC}"
if pnpm cli -- check-config > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Configuration valid${NC}"
else
    echo -e "  ${RED}✗ Configuration invalid${NC}"
    exit 1
fi
echo ""

# Step 2: Run fixture
echo -e "${YELLOW}Step 2: Run Fixture${NC}"
FIXTURE="fixtures/intents/sample-safe-report.intent.json"
echo "  Fixture: $FIXTURE"

# Capture output
RUN_OUTPUT=$(pnpm cli -- run-fixture "$FIXTURE" 2>&1) || {
    echo -e "  ${RED}✗ Run failed${NC}"
    echo "$RUN_OUTPUT"
    exit 1
}

echo -e "  ${GREEN}✓ Run completed${NC}"

# Extract key values from output
INTENT_ID=$(echo "$RUN_OUTPUT" | grep -oP 'intentId:\s*\K[^\s]+' | head -1 || echo "")
RUN_ID=$(echo "$RUN_OUTPUT" | grep -oP 'runId:\s*\K[^\s]+' | head -1 || echo "")
MANIFEST_SHA=$(echo "$RUN_OUTPUT" | grep -oP 'manifestSha256:\s*\K[a-f0-9]+' | head -1 || echo "")

# Construct run directory using extracted RUN_ID
RUN_DIR="$DEMO_DIR/runs/$RUN_ID"

if [ -z "$RUN_ID" ] || [ ! -d "$RUN_DIR" ]; then
    echo -e "  ${RED}✗ Run directory not found for RUN_ID: $RUN_ID${NC}"
    exit 1
fi

echo "  Run directory: $RUN_DIR"
echo ""

# Step 3: Verify evidence bundle
echo -e "${YELLOW}Step 3: Verify Evidence Bundle${NC}"

if pnpm cli -- validate-evidence "$RUN_DIR" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Evidence bundle valid${NC}"
else
    echo -e "  ${RED}✗ Evidence bundle invalid${NC}"
    exit 1
fi
echo ""

# Step 4: Check evidence manifest
echo -e "${YELLOW}Step 4: Check Evidence Manifest${NC}"

MANIFEST_PATH="$RUN_DIR/evidence/manifest.json"
if [ -f "$MANIFEST_PATH" ]; then
    echo -e "  ${GREEN}✓ Manifest found${NC}"
    # Extract receiptId from manifest if present, otherwise use runId
    RECEIPT_ID=$(grep -oP '"runId"\s*:\s*"\K[^"]+' "$MANIFEST_PATH" || basename "$RUN_DIR")
else
    echo -e "  ${RED}✗ Manifest not found${NC}"
    exit 1
fi
echo ""

# Step 5: Summary
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}  DEMO PASS${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "  Summary:"
echo "    intentId:       ${INTENT_ID:-extracted-from-run}"
echo "    runId:          $(basename "$RUN_DIR")"
echo "    receiptId:      $RECEIPT_ID"
echo "    manifestSha256: $MANIFEST_SHA"
echo ""
echo "  Artifacts:"
echo "    Evidence:       $RUN_DIR/evidence/manifest.json"
echo "    Receipts:       $RECEIPTS_PATH"
echo ""
echo -e "${GREEN}Demo completed successfully!${NC}"

# Cleanup option (disabled by default to allow inspection)
# rm -rf "$DEMO_DIR"

exit 0
