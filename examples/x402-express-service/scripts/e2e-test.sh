#!/bin/bash
# x402 End-to-End Test on Sepolia
#
# This script guides you through testing the full x402 flow:
# 1. Register solver (if needed)
# 2. Start service
# 3. Run client
# 4. Verify receipt on-chain
#
# Prerequisites:
# - Sepolia ETH in both service and client wallets
# - Node.js 18+

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           x402 + IRSB End-to-End Test (Sepolia)               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check for .env
if [ ! -f .env ]; then
    echo "❌ No .env file found!"
    echo ""
    echo "Create .env with:"
    echo "  cp .env.example .env"
    echo "  # Then edit with your keys"
    echo ""
    exit 1
fi

# Load env
source .env

# Validate required vars
if [ -z "$SERVICE_PRIVATE_KEY" ] || [ "$SERVICE_PRIVATE_KEY" = "0x...your-private-key-here..." ]; then
    echo "❌ SERVICE_PRIVATE_KEY not set in .env"
    exit 1
fi

if [ -z "$IRSB_HUB_ADDRESS" ]; then
    echo "❌ IRSB_HUB_ADDRESS not set in .env"
    exit 1
fi

echo "✓ Configuration loaded"
echo "  Hub: $IRSB_HUB_ADDRESS"
echo "  Chain: $CHAIN_ID"
echo ""

# Check if solver is registered
echo "Step 1: Check solver registration..."
echo ""

if [ -z "$SERVICE_SOLVER_ID" ] || [ "$SERVICE_SOLVER_ID" = "0x...your-registered-solver-id..." ]; then
    echo "⚠️  No solver ID configured."
    echo ""
    echo "Register your solver first:"
    echo ""
    echo "  cast send $IRSB_HUB_ADDRESS \\"
    echo "    --rpc-url $RPC_URL \\"
    echo "    --private-key \$SERVICE_PRIVATE_KEY \\"
    echo "    'registerSolver(address,string)' \\"
    echo "    \$(cast wallet address \$SERVICE_PRIVATE_KEY) \\"
    echo "    'ipfs://metadata' \\"
    echo "    --value 0.1ether"
    echo ""
    echo "Then get your solver ID:"
    echo ""
    echo "  cast call 0xB6ab964832808E49635fF82D1996D6a888ecB745 \\"
    echo "    --rpc-url $RPC_URL \\"
    echo "    'operatorToSolver(address)(bytes32)' \\"
    echo "    \$(cast wallet address \$SERVICE_PRIVATE_KEY)"
    echo ""
    echo "Add to .env: SERVICE_SOLVER_ID=0x..."
    echo ""
    exit 1
fi

echo "✓ Solver ID: ${SERVICE_SOLVER_ID:0:20}..."
echo ""

# Start server in background
echo "Step 2: Starting service..."
echo ""

npm run dev &
SERVER_PID=$!
sleep 3

# Check server is up
if ! curl -s http://localhost:${PORT:-3000}/health > /dev/null; then
    echo "❌ Server failed to start"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo "✓ Server running on port ${PORT:-3000}"
echo ""

# Run client test
echo "Step 3: Running client (mock payment)..."
echo ""

npm run client:mock

CLIENT_EXIT=$?

# Cleanup
echo ""
echo "Step 4: Cleanup..."
kill $SERVER_PID 2>/dev/null
echo "✓ Server stopped"
echo ""

if [ $CLIENT_EXIT -eq 0 ]; then
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                    ✅ TEST PASSED                             ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Next: Run with real payment (needs CLIENT_PRIVATE_KEY in env):"
    echo "  npm run client"
else
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                    ❌ TEST FAILED                             ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    exit 1
fi
