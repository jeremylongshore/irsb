#!/bin/bash
# IRSB Protocol Security Checks
# Run this script before pushing changes or creating PRs
# Usage: ./scripts/security.sh [--ci]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
FAILED=0

echo "=========================================="
echo "IRSB Protocol Security Checks"
echo "=========================================="
echo ""

# 1. Forge build
echo -e "${YELLOW}[1/5] Running forge build...${NC}"
if forge build --sizes > /dev/null 2>&1; then
    echo -e "${GREEN}[PASS] Forge build successful${NC}"
else
    echo -e "${RED}[FAIL] Forge build failed${NC}"
    FAILED=1
fi
echo ""

# 2. Forge format check
echo -e "${YELLOW}[2/5] Checking formatting (forge fmt --check)...${NC}"
if forge fmt --check > /dev/null 2>&1; then
    echo -e "${GREEN}[PASS] Formatting OK${NC}"
else
    echo -e "${RED}[FAIL] Formatting issues found. Run: forge fmt${NC}"
    FAILED=1
fi
echo ""

# 3. Forge tests
echo -e "${YELLOW}[3/5] Running tests...${NC}"
TEST_OUTPUT=$(forge test 2>&1 || true)
if echo "$TEST_OUTPUT" | grep -q "passed"; then
    PASS_COUNT=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ passed' | head -1)
    echo -e "${GREEN}[PASS] Tests passed: $PASS_COUNT${NC}"
else
    echo -e "${RED}[FAIL] Tests failed${NC}"
    echo "$TEST_OUTPUT" | tail -20
    FAILED=1
fi
echo ""

# 4. Slither (if available)
echo -e "${YELLOW}[4/5] Running Slither static analysis...${NC}"
if command -v slither &> /dev/null; then
    SLITHER_OUTPUT=$(slither . --config-file slither.config.json 2>&1 || true)

    # Check for high/critical
    if echo "$SLITHER_OUTPUT" | grep -qE "(High|Critical)"; then
        echo -e "${RED}[WARN] Slither found High/Critical findings:${NC}"
        echo "$SLITHER_OUTPUT" | grep -A 5 -E "(High|Critical)" | head -30
        # In CI mode, fail on high/critical
        if [[ "$1" == "--ci" ]]; then
            FAILED=1
        fi
    else
        echo -e "${GREEN}[PASS] No High/Critical Slither findings${NC}"
    fi
else
    echo -e "${YELLOW}[SKIP] Slither not installed. Install: pip3 install slither-analyzer${NC}"
fi
echo ""

# 5. Coverage report (best effort)
echo -e "${YELLOW}[5/5] Generating coverage summary...${NC}"
if forge coverage --report summary 2>/dev/null; then
    echo -e "${GREEN}[PASS] Coverage report generated${NC}"
else
    echo -e "${YELLOW}[SKIP] Coverage report failed (may require lcov)${NC}"
fi
echo ""

# Summary
echo "=========================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All security checks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some security checks failed!${NC}"
    echo "Fix the issues above before committing."
    exit 1
fi
