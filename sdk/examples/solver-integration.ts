/**
 * IRSB SDK - Solver Integration Example
 *
 * This example demonstrates how a solver integrates with IRSB Protocol:
 * 1. Register as a solver
 * 2. Deposit bond
 * 3. Post intent receipts
 * 4. Handle disputes
 * 5. Finalize receipts
 */

import { ethers } from "ethers";
import {
  IRSBClient,
  IntentReceipt,
  SolverStatus,
  DisputeReason,
} from "irsb-sdk";

// Contract addresses (Sepolia testnet)
const SOLVER_REGISTRY = "0xB6ab964832808E49635fF82D1996D6a888ecB745";
const INTENT_RECEIPT_HUB = "0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c";
const DISPUTE_MODULE = "0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D";

async function main() {
  // ===========================================
  // SETUP
  // ===========================================

  // Connect to Sepolia
  const provider = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org"
  );

  // Load solver wallet
  const solverWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  console.log(`Solver address: ${solverWallet.address}`);

  // Initialize IRSB client
  const irsb = new IRSBClient(
    SOLVER_REGISTRY,
    INTENT_RECEIPT_HUB,
    DISPUTE_MODULE,
    solverWallet
  );

  // ===========================================
  // STEP 1: REGISTER AS SOLVER
  // ===========================================

  console.log("\n--- Step 1: Register as Solver ---");

  // Check if already registered
  const existingSolverId = await irsb.getSolverByOperator(solverWallet.address);

  let solverId: string;

  if (existingSolverId === ethers.ZeroHash) {
    // Register new solver with metadata URI (IPFS or HTTP)
    const metadataURI = "ipfs://QmYourSolverMetadata";
    const tx = await irsb.registerSolver(metadataURI, solverWallet.address);
    const receipt = await tx.wait();

    // Get solverId from event
    const event = receipt?.logs.find((log) => {
      try {
        const parsed = irsb.solverRegistry.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        return parsed?.name === "SolverRegistered";
      } catch {
        return false;
      }
    });

    solverId = event ? (event as any).args.solverId : ethers.ZeroHash;
    console.log(`Registered! Solver ID: ${solverId}`);
  } else {
    solverId = existingSolverId;
    console.log(`Already registered. Solver ID: ${solverId}`);
  }

  // ===========================================
  // STEP 2: DEPOSIT BOND
  // ===========================================

  console.log("\n--- Step 2: Deposit Bond ---");

  // Check current bond
  const solver = await irsb.getSolver(solverId);
  console.log(`Current bond: ${ethers.formatEther(solver.bondBalance)} ETH`);

  // Minimum bond is 0.1 ETH
  const minimumBond = await irsb.getMinimumBond();
  console.log(`Minimum required: ${ethers.formatEther(minimumBond)} ETH`);

  if (solver.bondBalance < minimumBond) {
    const depositAmount = minimumBond - solver.bondBalance;
    console.log(`Depositing ${ethers.formatEther(depositAmount)} ETH...`);

    const tx = await irsb.depositBond(solverId, depositAmount);
    await tx.wait();
    console.log("Bond deposited!");
  } else {
    console.log("Bond requirement already met.");
  }

  // ===========================================
  // STEP 3: POST INTENT RECEIPT
  // ===========================================

  console.log("\n--- Step 3: Post Intent Receipt ---");

  // Create a receipt for an executed intent
  const intentHash = ethers.keccak256(ethers.toUtf8Bytes("user-intent-123"));
  const constraintsHash = ethers.keccak256(
    ethers.toUtf8Bytes("minOut:1000,maxSlippage:0.5%")
  );
  const routeHash = ethers.keccak256(
    ethers.toUtf8Bytes("USDC->WETH->DAI via Uniswap")
  );
  const outcomeHash = ethers.keccak256(
    ethers.toUtf8Bytes("received:1050,slippage:0.3%")
  );
  const evidenceHash = ethers.keccak256(
    ethers.toUtf8Bytes("ipfs://QmExecutionProof")
  );

  // Build unsigned receipt
  const now = Math.floor(Date.now() / 1000);
  const unsignedReceipt: IntentReceipt = {
    intentHash,
    constraintsHash,
    routeHash,
    outcomeHash,
    evidenceHash,
    createdAt: BigInt(now),
    expiry: BigInt(now + 3600), // 1 hour from now
    solverId,
    solverSig: "0x", // Will be filled after signing
  };

  // Sign the receipt
  const signedReceipt = await irsb.signReceipt(unsignedReceipt);
  console.log("Receipt signed!");

  // Post to chain
  const postTx = await irsb.postReceipt(signedReceipt);
  const postReceipt = await postTx.wait();

  // Get receiptId from event
  const receiptId = await irsb.computeReceiptId(signedReceipt);
  console.log(`Receipt posted! ID: ${receiptId}`);

  // ===========================================
  // STEP 4: MONITOR FOR DISPUTES
  // ===========================================

  console.log("\n--- Step 4: Monitor for Disputes ---");

  // Listen for dispute events on our receipts
  irsb.receiptHub.on(
    irsb.receiptHub.filters.DisputeOpened(null, solverId),
    (receiptId, solverId, challenger, reason, event) => {
      console.log(`\n⚠️  DISPUTE OPENED!`);
      console.log(`   Receipt: ${receiptId}`);
      console.log(`   Challenger: ${challenger}`);
      console.log(`   Reason: ${DisputeReason[reason]}`);

      // Handle dispute (see handleDispute function below)
      handleDispute(irsb, receiptId, reason);
    }
  );

  console.log("Listening for disputes on our receipts...");

  // ===========================================
  // STEP 5: FINALIZE RECEIPT (after challenge window)
  // ===========================================

  console.log("\n--- Step 5: Finalize Receipt ---");

  // Check if receipt can be finalized
  const canFinalize = await irsb.canFinalize(receiptId);

  if (canFinalize) {
    const finalizeTx = await irsb.finalize(receiptId);
    await finalizeTx.wait();
    console.log("Receipt finalized! Reputation updated.");
  } else {
    const challengeWindow = await irsb.getChallengeWindow();
    console.log(
      `Cannot finalize yet. Challenge window: ${challengeWindow} seconds`
    );
    console.log("Wait for challenge window to pass, then call finalize().");
  }

  // ===========================================
  // CHECK SOLVER STATUS
  // ===========================================

  console.log("\n--- Solver Status ---");

  const finalSolver = await irsb.getSolver(solverId);
  const score = await irsb.getIntentScore(solverId);

  console.log(`Status: ${SolverStatus[finalSolver.status]}`);
  console.log(`Bond: ${ethers.formatEther(finalSolver.bondBalance)} ETH`);
  console.log(`Total Fills: ${score.totalFills}`);
  console.log(`Successful: ${score.successfulFills}`);
  console.log(`Disputes Opened: ${score.disputesOpened}`);
  console.log(`Disputes Lost: ${score.disputesLost}`);
  console.log(
    `Volume Processed: ${ethers.formatEther(score.volumeProcessed)} ETH`
  );
}

/**
 * Handle a dispute opened against one of our receipts
 */
async function handleDispute(
  irsb: IRSBClient,
  receiptId: string,
  reason: number
) {
  console.log(`\nHandling dispute for ${receiptId}...`);

  // For deterministic disputes (timeout, constraint violation, forgery),
  // the protocol auto-resolves based on on-chain evidence.

  // For subjective disputes, we may need to:
  // 1. Submit evidence via DisputeModule
  // 2. Wait for arbitration

  if (reason === DisputeReason.SubjectiveViolation) {
    console.log("Subjective dispute - submitting evidence...");

    // Submit evidence hash (pointing to off-chain proof)
    const evidenceHash = ethers.keccak256(
      ethers.toUtf8Bytes("ipfs://QmOurDefenseEvidence")
    );

    const tx = await irsb.disputeModule.submitEvidence(receiptId, evidenceHash);
    await tx.wait();

    console.log("Evidence submitted. Waiting for arbitration...");
  } else {
    console.log(
      "Deterministic dispute - will be auto-resolved based on on-chain state."
    );
  }
}

// Run
main().catch(console.error);
