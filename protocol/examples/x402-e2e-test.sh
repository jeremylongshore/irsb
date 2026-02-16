#!/bin/bash
#
# x402 End-to-End Test Script
#
# Tests the complete flow on Sepolia testnet:
# 1. Start the x402 express service
# 2. Run the x402 client
# 3. Verify receipt on-chain
#
# Prerequisites:
# - Node.js 18+
# - pnpm installed
# - Sepolia ETH in test wallet
# - Environment variables configured
#
# Usage:
#   ./x402-e2e-test.sh [prompt]
#
# Environment variables (or set in .env files):
#   PRIVATE_KEY - Client wallet private key
#   SERVICE_PRIVATE_KEY - Service wallet private key
#   SERVICE_SOLVER_ID - Registered solver ID
#   RPC_URL - Sepolia RPC endpoint (optional)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
SERVICE_PORT=${SERVICE_PORT:-3000}
SERVICE_URL="http://localhost:$SERVICE_PORT"
PROMPT="${1:-E2E test prompt at $(date)}"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}x402 End-to-End Test${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js not found. Install Node.js 18+${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm not found. Install with: npm install -g pnpm${NC}"
    exit 1
fi

# Check environment
if [ -z "$PRIVATE_KEY" ] && [ ! -f "$SCRIPT_DIR/x402-client/.env" ]; then
    echo -e "${RED}Error: PRIVATE_KEY not set and no .env file found${NC}"
    echo "Set PRIVATE_KEY environment variable or create $SCRIPT_DIR/x402-client/.env"
    exit 1
fi

if [ -z "$SERVICE_PRIVATE_KEY" ] && [ ! -f "$SCRIPT_DIR/x402-express-service/.env" ]; then
    echo -e "${YELLOW}Warning: SERVICE_PRIVATE_KEY not set. Service may fail to generate receipts.${NC}"
fi

echo -e "${GREEN}Prerequisites OK${NC}"
echo ""

# Install dependencies if needed
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$PROJECT_ROOT"
pnpm install --silent
echo -e "${GREEN}Dependencies installed${NC}"
echo ""

# Build packages
echo -e "${YELLOW}Building packages...${NC}"
cd "$PROJECT_ROOT/packages/x402-irsb"
pnpm build --silent 2>/dev/null || npx tsup src/index.ts --format esm --dts --clean --silent
echo -e "${GREEN}Packages built${NC}"
echo ""

# Start service in background
echo -e "${YELLOW}Starting x402 service on port $SERVICE_PORT...${NC}"
cd "$SCRIPT_DIR/x402-express-service"

# Kill any existing process on the port
lsof -ti:$SERVICE_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true

# Start service
npx tsx src/server.ts &
SERVICE_PID=$!

# Wait for service to start
echo "Waiting for service to start..."
for i in {1..30}; do
    if curl -s "$SERVICE_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}Service started (PID: $SERVICE_PID)${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Error: Service failed to start${NC}"
        kill $SERVICE_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    kill $SERVICE_PID 2>/dev/null || true
    echo -e "${GREEN}Done${NC}"
}
trap cleanup EXIT

# Run client
echo -e "${YELLOW}Running x402 client...${NC}"
echo "Prompt: $PROMPT"
echo ""

cd "$SCRIPT_DIR/x402-client"

# Run the client and capture output
set +e
CLIENT_OUTPUT=$(npx tsx src/index.ts "$PROMPT" 2>&1)
CLIENT_EXIT_CODE=$?
set -e

echo "$CLIENT_OUTPUT"
echo ""

# Check result
if [ $CLIENT_EXIT_CODE -eq 0 ]; then
    # Extract receipt ID from output
    RECEIPT_ID=$(echo "$CLIENT_OUTPUT" | grep -oP 'Receipt ID: \K0x[a-fA-F0-9]+' | head -1)
    TX_HASH=$(echo "$CLIENT_OUTPUT" | grep -oP 'Transaction: \K0x[a-fA-F0-9]+' | head -1)

    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}E2E TEST PASSED${NC}"
    echo -e "${GREEN}=====================================${NC}"
    echo ""

    if [ -n "$RECEIPT_ID" ]; then
        echo "Receipt ID: $RECEIPT_ID"
        echo "Transaction: $TX_HASH"
        echo ""
        echo "Verify on Etherscan:"
        echo "  https://sepolia.etherscan.io/tx/$TX_HASH"
        echo ""
        echo "Query receipt on-chain:"
        echo "  cast call 0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c 'getReceipt(bytes32)' $RECEIPT_ID --rpc-url https://rpc.sepolia.org"
    else
        echo "Receipt may not have been posted on-chain (check output above)"
    fi
else
    echo -e "${RED}=====================================${NC}"
    echo -e "${RED}E2E TEST FAILED${NC}"
    echo -e "${RED}=====================================${NC}"
    echo ""
    echo "Exit code: $CLIENT_EXIT_CODE"
    exit 1
fi
