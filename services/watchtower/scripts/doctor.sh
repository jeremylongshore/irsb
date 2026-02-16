#!/bin/bash
#
# IRSB Watchtower Doctor Script
# Checks that the development environment is properly configured
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "🏥 IRSB Watchtower Doctor"
echo "========================="
echo ""

# Check Node.js version
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        echo -e "${GREEN}✓ Node.js $(node --version)${NC}"
    else
        echo -e "${RED}✗ Node.js $(node --version) (requires v20+)${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ Node.js not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check pnpm version
echo -n "Checking pnpm... "
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version | cut -d'.' -f1)
    if [ "$PNPM_VERSION" -ge 8 ]; then
        echo -e "${GREEN}✓ pnpm $(pnpm --version)${NC}"
    else
        echo -e "${RED}✗ pnpm $(pnpm --version) (requires v8+)${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ pnpm not found${NC}"
    echo "  Install with: npm install -g pnpm"
    ERRORS=$((ERRORS + 1))
fi

# Check for .env file
echo -n "Checking .env file... "
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env exists${NC}"
else
    echo -e "${YELLOW}⚠ .env not found${NC}"
    echo "  Copy .env.example to .env and configure"
    WARNINGS=$((WARNINGS + 1))
fi

# Check required environment variables (if .env exists)
if [ -f ".env" ]; then
    source .env 2>/dev/null || true

    echo -n "Checking RPC_URL... "
    if [ -n "$RPC_URL" ]; then
        echo -e "${GREEN}✓ Set${NC}"
    else
        echo -e "${YELLOW}⚠ Not set (will use default)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi

    echo -n "Checking CHAIN_ID... "
    if [ -n "$CHAIN_ID" ]; then
        echo -e "${GREEN}✓ Set ($CHAIN_ID)${NC}"
    else
        echo -e "${YELLOW}⚠ Not set (will use default 11155111)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi

    echo -n "Checking ENABLE_ACTIONS... "
    if [ "$ENABLE_ACTIONS" = "true" ]; then
        echo -e "${YELLOW}⚠ Enabled (be careful!)${NC}"
        WARNINGS=$((WARNINGS + 1))

        echo -n "Checking SIGNER_TYPE... "
        if [ -n "$SIGNER_TYPE" ]; then
            echo -e "${GREEN}✓ Set ($SIGNER_TYPE)${NC}"

            if [ "$SIGNER_TYPE" = "local" ]; then
                echo -n "Checking PRIVATE_KEY... "
                if [ -n "$PRIVATE_KEY" ]; then
                    echo -e "${GREEN}✓ Set (hidden)${NC}"
                else
                    echo -e "${RED}✗ Not set (required for local signer)${NC}"
                    ERRORS=$((ERRORS + 1))
                fi
            fi
        else
            echo -e "${RED}✗ Not set (required when ENABLE_ACTIONS=true)${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo -e "${GREEN}✓ Disabled (safe mode)${NC}"
    fi
fi

# Check node_modules
echo -n "Checking dependencies... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ Installed${NC}"
else
    echo -e "${YELLOW}⚠ Not installed${NC}"
    echo "  Run: pnpm install"
    WARNINGS=$((WARNINGS + 1))
fi

# Check if build exists
echo -n "Checking build... "
if [ -d "packages/core/dist" ] && [ -d "apps/api/dist" ]; then
    echo -e "${GREEN}✓ Built${NC}"
else
    echo -e "${YELLOW}⚠ Not built${NC}"
    echo "  Run: pnpm build"
    WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "========================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s), but OK to proceed${NC}"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s), $WARNINGS warning(s)${NC}"
    echo "Please fix the errors above before proceeding."
    exit 1
fi
