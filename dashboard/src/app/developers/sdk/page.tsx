import { pageMetadata } from '@/lib/seo'
import CodeBlock from '@/components/CodeBlock'

export const metadata = pageMetadata({
  title: 'SDK Reference',
  description: 'IRSB TypeScript SDK API reference: IRSBClient, receipt building, bond management, dispute operations, and EIP-712 signing.',
  path: '/developers/sdk',
})

export default function SDKPage() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-zinc-50">SDK Reference</h1>
        <p className="mt-3 text-zinc-300">
          TypeScript SDK for interacting with IRSB contracts. Two packages:
        </p>
        <div className="mt-4">
          <CodeBlock
            language="bash"
            code={`npm install irsb        # Core SDK
npm install irsb-x402   # x402 HTTP payment integration`}
          />
        </div>
      </div>

      {/* IRSBClient */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">IRSBClient</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Main entry point. Handles connection, contract interaction, and receipt lifecycle.
        </p>
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`import { IRSBClient } from 'irsb';

const client = new IRSBClient({
  chainId: 11155111,
  rpcUrl: 'https://rpc.sepolia.org',
  // Optional: override default contract addresses
  contracts: {
    solverRegistry: '0x...',
    intentReceiptHub: '0x...',
    disputeModule: '0x...',
  },
});`}
          />
        </div>
      </div>

      {/* Receipt Building */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Receipt Building</h2>
        <div className="mt-4 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-zinc-200">buildReceiptV1()</h3>
            <p className="mt-1 text-sm text-zinc-400">Single attestation receipt. Solver signature only.</p>
            <div className="mt-3">
              <CodeBlock
                language="typescript"
                code={`import { buildReceiptV1 } from 'irsb';

const receipt = buildReceiptV1({
  intentHash: '0x...',     // keccak256 of intent data
  solverId: '0x...',       // Registered solver identifier
  constraintsHash: '0x...', // Hash of intent constraints
  routeHash: '0x...',      // Hash of execution route
  outcomeHash: '0x...',    // Hash of execution outcome
  evidenceHash: '0x...',   // Hash of evidence bundle
});`}
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-zinc-200">buildReceiptV2()</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Dual attestation receipt with privacy support. Both solver and client sign via EIP-712.
            </p>
            <div className="mt-3">
              <CodeBlock
                language="typescript"
                code={`import { buildReceiptV2 } from 'irsb';

const receipt = buildReceiptV2({
  // V1 fields
  intentHash: '0x...',
  solverId: '0x...',
  constraintsHash: '0x...',
  routeHash: '0x...',
  outcomeHash: '0x...',
  evidenceHash: '0x...',
  // V2 additions
  metadataCommitment: '0x...',  // Hash of metadata (not plaintext)
  ciphertextPointer: 'ipfs://...', // IPFS CID or content digest
  privacyLevel: 'SEMI_PUBLIC',  // PUBLIC | SEMI_PUBLIC | PRIVATE
  escrowId: '0x...',            // Optional escrow link
});`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Posting */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Posting Receipts</h2>
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`// Post V1 receipt
const receiptId = await client.postReceipt(receipt, signer);

// Post V2 receipt (requires both solver and client signatures)
const receiptId = await client.postReceiptV2(receipt, solverSigner, clientSigner);

// Verify a receipt
const isValid = await client.verifyReceipt(receiptId);

// Get receipt by ID
const receipt = await client.getReceipt(receiptId);`}
          />
        </div>
      </div>

      {/* Bond Management */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Bond Management</h2>
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`// Register solver
const solverId = await client.registerSolver(metadataURI, signer);

// Deposit bond (minimum 0.1 ETH)
await client.depositBond(solverId, ethers.parseEther('0.5'), signer);

// Request withdrawal (starts 7-day cooldown)
await client.requestWithdrawal(solverId, amount, signer);

// Execute withdrawal (after cooldown)
await client.executeWithdrawal(solverId, signer);

// Query bond balance
const balance = await client.getBondBalance(solverId);`}
          />
        </div>
      </div>

      {/* Dispute Operations */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Dispute Operations</h2>
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`// Open dispute (requires evidence and bond)
const disputeId = await client.openDispute({
  receiptId: '0x...',
  evidenceHash: '0x...',
  reasonCode: 'TIMEOUT', // TIMEOUT | WRONG_AMOUNT | CONSTRAINT_VIOLATION | OTHER
}, signer);

// Submit additional evidence
await client.submitEvidence(disputeId, evidenceHash, signer);

// Resolve deterministic dispute
await client.resolveDeterministic(disputeId, signer);

// Post counter-bond (optimistic disputes)
await client.postCounterBond(disputeId, amount, signer);`}
          />
        </div>
      </div>

      {/* Reputation */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Reputation Queries</h2>
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`// Get IntentScore (0-10000 basis points)
const score = await client.getIntentScore(solverId);
// Returns: { score: 8500, components: { successRate, disputeWinRate, ... } }

// Get solver stats
const stats = await client.getSolverStats(solverId);
// Returns: { totalTasks, successfulTasks, disputes, jailCount, bondBalance }`}
          />
        </div>
      </div>

      {/* npm links */}
      <div className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
        <h2 className="text-xl font-bold text-zinc-50">Package Links</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <a href="https://www.npmjs.com/package/irsb" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-zinc-100">
              npm: irsb &#8599;
            </a>
            <span className="text-zinc-500 ml-2">Core SDK</span>
          </li>
          <li>
            <a href="https://www.npmjs.com/package/irsb-x402" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-zinc-100">
              npm: irsb-x402 &#8599;
            </a>
            <span className="text-zinc-500 ml-2">x402 integration</span>
          </li>
          <li>
            <a href="https://github.com/intent-solutions-io/irsb-protocol/tree/main/sdk" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-zinc-100">
              Source code &#8599;
            </a>
            <span className="text-zinc-500 ml-2">GitHub</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
