import { pageMetadata } from '@/lib/seo'
import CodeBlock from '@/components/CodeBlock'

export const metadata = pageMetadata({
  title: 'x402 Integration Guide',
  description: 'Integrate IRSB with x402 HTTP 402 payments. Add on-chain receipts to paid API services using the irsb-x402 package.',
  path: '/developers/x402',
})

export default function X402Page() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-zinc-50">x402 Integration Guide</h1>
        <p className="mt-3 text-zinc-300">
          x402 is an HTTP 402 payment protocol. The <code className="text-zinc-200 bg-zinc-800 px-1 rounded">irsb-x402</code> package
          bridges HTTP payments to on-chain IRSB receipts, providing proof of service delivery for paid API calls.
        </p>
      </div>

      {/* Status note */}
      <div className="bg-zinc-800/60 rounded-lg px-4 py-3 border border-zinc-600">
        <p className="text-sm text-zinc-400">
          The irsb-x402 package is published. Receipt signing uses Cloud KMS. Buyer-side payments use EIP-7702 delegated signing via X402Facilitator.
        </p>
      </div>

      {/* How It Works */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">How It Works</h2>
        <div className="mt-4 bg-zinc-800/60 rounded-lg p-4 border border-zinc-700 font-mono text-sm text-zinc-300 whitespace-pre overflow-x-auto">{`Client sends HTTP request with x402 payment
    |
    v
Server verifies payment, executes request
    |
    v
irsb-x402 middleware builds V2 receipt
  - Links payment hash to intent hash
  - Stores response hash as evidence
  - Sets privacy level
    |
    v
Receipt posted to IntentReceiptHub on Sepolia
    |
    v
Client can verify service delivery on-chain`}</div>
      </div>

      {/* Install */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Installation</h2>
        <div className="mt-4">
          <CodeBlock
            language="bash"
            code={`npm install irsb-x402 irsb`}
          />
        </div>
      </div>

      {/* Server-Side Integration */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Server-Side: Express Example</h2>
        <p className="mt-2 text-sm text-zinc-400">
          After verifying an x402 payment, build and post a receipt linking the payment to the service response.
        </p>
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`import { buildReceiptV2FromX402, postReceiptV2FromX402 } from 'irsb-x402';
import { IRSBClient } from 'irsb';

const irsbClient = new IRSBClient({
  chainId: 11155111,
  rpcUrl: process.env.RPC_URL,
});

app.post('/api/inference', async (req, res) => {
  // 1. Verify x402 payment (your existing logic)
  const payment = verifyX402Payment(req);

  // 2. Execute the service
  const startTime = Date.now();
  const result = await runInference(req.body);
  const endTime = Date.now();

  // 3. Build IRSB receipt from x402 context
  const receipt = buildReceiptV2FromX402({
    payload: {
      service: 'inference-api',
      payment: payment,
      request: req.body,
      response: result,
      timing: { startTime, endTime },
    },
    ciphertextPointer: resultCID, // IPFS CID of full response
    solverId: process.env.SOLVER_ID,
  });

  // 4. Post receipt on-chain
  await postReceiptV2FromX402(irsbClient, receipt, solverSigner);

  // 5. Return response with receipt reference
  res.json({
    result: result,
    receipt: receipt.receiptId,
  });
});`}
          />
        </div>
      </div>

      {/* Client-Side Verification */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Client-Side: Verifying Delivery</h2>
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`import { IRSBClient } from 'irsb';

// After receiving response with receipt ID
const client = new IRSBClient({ chainId: 11155111, rpcUrl });

const receipt = await client.getReceipt(receiptId);
const isValid = await client.verifyReceipt(receiptId);

console.log('Service delivery verified:', isValid);
console.log('Evidence hash:', receipt.evidenceHash);
console.log('Timestamp:', receipt.createdAt);`}
          />
        </div>
      </div>

      {/* Receipt Fields */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Receipt Field Mapping</h2>
        <p className="mt-2 text-sm text-zinc-400">
          How x402 payment fields map to IRSB receipt fields:
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-700">
          <table className="w-full">
            <thead className="bg-zinc-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">x402 Field</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Receipt Field</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Derivation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
              {[
                { x402: 'payment hash', receipt: 'intentHash', derivation: 'keccak256(payment + request)' },
                { x402: 'service constraints', receipt: 'constraintsHash', derivation: 'keccak256(SLA terms)' },
                { x402: 'execution path', receipt: 'routeHash', derivation: 'keccak256(service endpoint)' },
                { x402: 'response', receipt: 'outcomeHash', derivation: 'keccak256(response body)' },
                { x402: 'full response CID', receipt: 'ciphertextPointer', derivation: 'IPFS CID of response' },
                { x402: 'timing data', receipt: 'evidenceHash', derivation: 'keccak256(timing + metadata)' },
              ].map((row) => (
                <tr key={row.x402}>
                  <td className="px-6 py-3 text-sm text-zinc-200">{row.x402}</td>
                  <td className="px-6 py-3 text-sm font-mono text-zinc-300">{row.receipt}</td>
                  <td className="px-6 py-3 text-sm text-zinc-400">{row.derivation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Package link */}
      <div className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
        <h2 className="text-xl font-bold text-zinc-50">Resources</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <a href="https://www.npmjs.com/package/irsb-x402" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-zinc-100">
              npm: irsb-x402 &#8599;
            </a>
          </li>
          <li>
            <a href="https://github.com/intent-solutions-io/irsb-protocol/tree/main/packages/x402-irsb" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-zinc-100">
              Source code (packages/x402-irsb) &#8599;
            </a>
          </li>
          <li>
            <a href="https://github.com/intent-solutions-io/irsb-protocol/tree/main/examples/x402-express-service" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-zinc-100">
              Express example &#8599;
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}
