/**
 * IRSB SDK - Challenger Integration Example
 *
 * This example demonstrates how to challenge invalid receipts:
 * 1. Monitor for receipts
 * 2. Validate receipt claims
 * 3. Open disputes for violations
 * 4. Claim rewards from successful challenges
 */

import { ethers } from "ethers";
import { IRSBClient, DisputeReason, ReceiptStatus } from "irsb-sdk";

// Contract addresses (Sepolia testnet)
const SOLVER_REGISTRY = "0xB6ab964832808E49635fF82D1996D6a888ecB745";
const INTENT_RECEIPT_HUB = "0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c";
const DISPUTE_MODULE = "0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D";

async function main() {
  // ===========================================
  // SETUP
  // ===========================================

  const provider = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org"
  );

  const challengerWallet = new ethers.Wallet(
    process.env.PRIVATE_KEY!,
    provider
  );
  console.log(`Challenger address: ${challengerWallet.address}`);

  const irsb = new IRSBClient(
    SOLVER_REGISTRY,
    INTENT_RECEIPT_HUB,
    DISPUTE_MODULE,
    challengerWallet
  );

  // ===========================================
  // MONITOR FOR RECEIPTS
  // ===========================================

  console.log("\n--- Monitoring for Receipts ---");

  // Listen for all new receipts
  irsb.receiptHub.on(
    irsb.receiptHub.filters.ReceiptPosted(),
    async (receiptId, intentHash, solverId, expiry, event) => {
      console.log(`\n📄 New Receipt Posted`);
      console.log(`   Receipt ID: ${receiptId}`);
      console.log(`   Intent: ${intentHash}`);
      console.log(`   Solver: ${solverId}`);
      console.log(`   Expiry: ${new Date(Number(expiry) * 1000).toISOString()}`);

      // Validate this receipt
      await validateAndChallenge(irsb, receiptId);
    }
  );

  console.log("Listening for new receipts...");
  console.log("Press Ctrl+C to stop.\n");

  // Keep process running
  await new Promise(() => {});
}

/**
 * Validate a receipt and challenge if invalid
 */
async function validateAndChallenge(irsb: IRSBClient, receiptId: string) {
  console.log(`\nValidating receipt ${receiptId.slice(0, 10)}...`);

  // Get receipt details
  const { receipt, status } = await irsb.getReceipt(receiptId);

  // Skip if already disputed or finalized
  if (status !== ReceiptStatus.Pending) {
    console.log(`   Status: ${ReceiptStatus[status]} - skipping`);
    return;
  }

  // ===========================================
  // VALIDATION CHECKS
  // ===========================================

  // Check 1: Is receipt expired (timeout)?
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (receipt.expiry < now) {
    console.log("   ❌ Receipt expired! Opening timeout dispute...");
    await openDispute(irsb, receiptId, DisputeReason.Timeout);
    return;
  }

  // Check 2: Verify signature
  const isValidSig = await verifyReceiptSignature(irsb, receipt);
  if (!isValidSig) {
    console.log("   ❌ Invalid signature! Opening forgery dispute...");
    await openDispute(irsb, receiptId, DisputeReason.ReceiptForgery);
    return;
  }

  // Check 3: Verify constraints were met (requires off-chain data)
  const constraintsMet = await verifyConstraints(receipt);
  if (!constraintsMet) {
    console.log("   ❌ Constraints violated! Opening constraint dispute...");
    await openDispute(irsb, receiptId, DisputeReason.ConstraintViolation);
    return;
  }

  // Check 4: Verify outcome matches claim (requires off-chain data)
  const outcomeValid = await verifyOutcome(receipt);
  if (!outcomeValid) {
    console.log("   ❌ Outcome mismatch! Opening subjective dispute...");
    await openDispute(irsb, receiptId, DisputeReason.SubjectiveViolation);
    return;
  }

  console.log("   ✅ Receipt appears valid");
}

/**
 * Verify the solver's signature on the receipt
 */
async function verifyReceiptSignature(
  irsb: IRSBClient,
  receipt: any
): Promise<boolean> {
  try {
    // Reconstruct message hash
    const messageHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        [
          "bytes32",
          "bytes32",
          "bytes32",
          "bytes32",
          "bytes32",
          "uint64",
          "uint64",
          "bytes32",
        ],
        [
          receipt.intentHash,
          receipt.constraintsHash,
          receipt.routeHash,
          receipt.outcomeHash,
          receipt.evidenceHash,
          receipt.createdAt,
          receipt.expiry,
          receipt.solverId,
        ]
      )
    );

    // Get signer from signature
    const ethSignedHash = ethers.hashMessage(ethers.getBytes(messageHash));
    const recoveredAddress = ethers.recoverAddress(
      ethSignedHash,
      receipt.solverSig
    );

    // Get solver's operator address
    const solver = await irsb.getSolver(receipt.solverId);

    return (
      recoveredAddress.toLowerCase() === solver.operator.toLowerCase()
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Verify constraints were met (stub - implement with your off-chain logic)
 */
async function verifyConstraints(receipt: any): Promise<boolean> {
  // TODO: Implement constraint verification
  // This typically requires:
  // 1. Decode constraintsHash to get original constraints
  // 2. Decode outcomeHash to get actual outcome
  // 3. Compare outcome against constraints

  // For demo, assume valid
  return true;
}

/**
 * Verify outcome matches on-chain state (stub - implement with your off-chain logic)
 */
async function verifyOutcome(receipt: any): Promise<boolean> {
  // TODO: Implement outcome verification
  // This typically requires:
  // 1. Fetch the original intent from your system
  // 2. Check on-chain settlement (token transfers, etc.)
  // 3. Compare against claimed outcome

  // For demo, assume valid
  return true;
}

/**
 * Open a dispute against a receipt
 */
async function openDispute(
  irsb: IRSBClient,
  receiptId: string,
  reason: DisputeReason
) {
  console.log(`   Opening dispute (reason: ${DisputeReason[reason]})...`);

  try {
    // Get required challenger bond
    const challengerBond = await irsb.getChallengerBond(receiptId);
    console.log(
      `   Required bond: ${ethers.formatEther(challengerBond)} ETH`
    );

    // Prepare evidence hash (pointing to off-chain proof)
    const evidenceHash = ethers.keccak256(
      ethers.toUtf8Bytes(`ipfs://QmChallengeEvidence-${receiptId}`)
    );

    // Open dispute (sends challenger bond)
    const tx = await irsb.openDispute(receiptId, reason, evidenceHash, {
      value: challengerBond,
    });

    const receipt = await tx.wait();
    console.log(`   ✅ Dispute opened! TX: ${receipt?.hash}`);

    // Monitor for resolution
    monitorDisputeResolution(irsb, receiptId);
  } catch (error: any) {
    console.error(`   ❌ Failed to open dispute: ${error.message}`);
  }
}

/**
 * Monitor dispute resolution and claim rewards
 */
function monitorDisputeResolution(irsb: IRSBClient, receiptId: string) {
  irsb.receiptHub.once(
    irsb.receiptHub.filters.DisputeResolved(receiptId),
    (receiptId, solverId, slashed, slashAmount, event) => {
      console.log(`\n🏆 Dispute Resolved for ${receiptId.slice(0, 10)}!`);

      if (slashed) {
        console.log(`   Result: CHALLENGER WINS`);
        console.log(`   Slash amount: ${ethers.formatEther(slashAmount)} ETH`);
        console.log(`   Your reward has been sent to your address.`);
      } else {
        console.log(`   Result: SOLVER WINS`);
        console.log(`   Your challenger bond was forfeited.`);
      }
    }
  );
}

// Run
main().catch(console.error);
