import Link from 'next/link'
import { pageMetadata } from '@/lib/seo'
import CodeBlock from '@/components/CodeBlock'
import { CONTRACTS } from '@/lib/content'

export const metadata = pageMetadata({
  title: 'Quickstart',
  description: 'Post your first IRSB receipt in 5 minutes. Install the SDK, configure a client, build and post a receipt on Sepolia.',
  path: '/developers/quickstart',
})

export default function QuickstartPage() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-zinc-50">Quickstart</h1>
        <p className="mt-3 text-zinc-300">
          Post your first receipt on Sepolia in 5 minutes.
        </p>
      </div>

      {/* Prerequisites */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Prerequisites</h2>
        <ul className="mt-3 space-y-1 text-sm text-zinc-300">
          <li>Node.js 18+ and a package manager (npm, pnpm, or yarn)</li>
          <li>A Sepolia RPC URL (e.g., from Alchemy or Infura)</li>
          <li>A wallet with Sepolia ETH (for gas + bond staking)</li>
        </ul>
      </div>

      {/* Step 1: Install */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">1. Install the SDK</h2>
        <div className="mt-4">
          <CodeBlock
            language="bash"
            code={`npm install irsb ethers`}
          />
        </div>
      </div>

      {/* Step 2: Initialize Client */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">2. Initialize the Client</h2>
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`import { IRSBClient } from 'irsb';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const client = new IRSBClient({
  chainId: 11155111, // Sepolia
  rpcUrl: process.env.RPC_URL,
  contracts: {
    solverRegistry: '${CONTRACTS.solverRegistry}',
    intentReceiptHub: '${CONTRACTS.intentReceiptHub}',
    disputeModule: '${CONTRACTS.disputeModule}',
  },
});`}
          />
        </div>
      </div>

      {/* Step 3: Register Solver */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">3. Register a Solver (One-Time)</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Solvers must register and stake a minimum bond of 0.1 ETH before posting receipts.
        </p>
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`// Register solver
const solverId = await client.registerSolver(
  'ipfs://QmYourMetadata', // Metadata URI
  signer,
);
console.log('Solver registered:', solverId);

// Deposit bond (minimum 0.1 ETH)
await client.depositBond(solverId, ethers.parseEther('0.1'), signer);
console.log('Bond deposited');`}
          />
        </div>
      </div>

      {/* Step 4: Build and Post Receipt */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">4. Build and Post a Receipt</h2>
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`import { buildReceiptV2 } from 'irsb';

const receipt = buildReceiptV2({
  intentHash: ethers.keccak256(
    ethers.toUtf8Bytes('my-intent-data')
  ),
  solverId: solverId,
  constraintsHash: ethers.keccak256(
    ethers.toUtf8Bytes('min-output:1000')
  ),
  routeHash: ethers.keccak256(
    ethers.toUtf8Bytes('uniswap-v3-direct')
  ),
  outcomeHash: ethers.keccak256(
    ethers.toUtf8Bytes('output:1050')
  ),
  evidenceHash: ethers.keccak256(
    ethers.toUtf8Bytes('tx:0xabc...')
  ),
});

const receiptId = await client.postReceiptV2(receipt, signer);
console.log('Receipt posted:', receiptId);`}
          />
        </div>
      </div>

      {/* Step 5: Verify */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">5. Verify the Receipt</h2>
        <div className="mt-4">
          <CodeBlock
            language="bash"
            code={`# Verify using CLI
npx irsb verify <receipt-id>

# Or check on Etherscan
# https://sepolia.etherscan.io/address/${CONTRACTS.intentReceiptHub}`}
          />
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
        <h2 className="text-xl font-bold text-zinc-50">Next Steps</h2>
        <ul className="mt-4 space-y-2 text-sm text-zinc-300">
          <li>Read the <Link href="/developers/sdk" className="text-zinc-100 hover:text-zinc-50 underline">SDK Reference</Link> for the full API</li>
          <li>See <Link href="/developers/x402" className="text-zinc-100 hover:text-zinc-50 underline">x402 Guide</Link> for HTTP payment integration</li>
          <li>Review <Link href="/developers/contracts" className="text-zinc-100 hover:text-zinc-50 underline">Contract Reference</Link> for direct contract interaction</li>
          <li>View live data on the <Link href="/dashboard" className="text-zinc-100 hover:text-zinc-50 underline">Dashboard</Link></li>
        </ul>
      </div>
    </div>
  )
}
