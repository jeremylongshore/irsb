import { pageMetadata } from '@/lib/seo'
import CodeBlock from '@/components/CodeBlock'
import { CONTRACTS, EXPLORER_BASE } from '@/lib/content'

export const metadata = pageMetadata({
  title: 'Contract Reference',
  description: 'IRSB contract ABI reference: SolverRegistry, IntentReceiptHub, DisputeModule functions, events, and error codes.',
  path: '/developers/contracts',
})

export default function ContractsPage() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-zinc-50">Contract Reference</h1>
        <p className="mt-3 text-zinc-300">
          Key functions and events for direct contract interaction. All contracts are verified on
          {' '}<a href={`${EXPLORER_BASE}/address/${CONTRACTS.solverRegistry}#code`} target="_blank" rel="noopener noreferrer" className="text-zinc-200 hover:text-zinc-50">Etherscan &#8599;</a>.
        </p>
      </div>

      {/* SolverRegistry */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">SolverRegistry</h2>
        <p className="mt-2 text-sm text-zinc-400 font-mono break-all">
          <a href={`${EXPLORER_BASE}/address/${CONTRACTS.solverRegistry}`} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200">
            {CONTRACTS.solverRegistry} &#8599;
          </a>
        </p>
        <div className="mt-4">
          <CodeBlock
            language="solidity"
            code={`// Registration
function registerSolver(string metadataURI) returns (bytes32 solverId);
function updateMetadata(bytes32 solverId, string metadataURI);

// Bond Management
function depositBond(bytes32 solverId) payable;
function requestWithdrawal(bytes32 solverId, uint256 amount);
function executeWithdrawal(bytes32 solverId);

// Read Functions
function getSolver(bytes32 solverId) returns (SolverInfo);
function getBondBalance(bytes32 solverId) returns (uint256);
function getIntentScore(bytes32 solverId) returns (uint256);
function minimumBond() returns (uint256);  // 0.1 ETH

// Events
event SolverRegistered(bytes32 indexed solverId, address indexed owner);
event BondDeposited(bytes32 indexed solverId, uint256 amount);
event BondSlashed(bytes32 indexed solverId, uint256 amount, string reason);
event SolverJailed(bytes32 indexed solverId, uint8 jailCount);
event SolverBanned(bytes32 indexed solverId);`}
          />
        </div>
      </div>

      {/* IntentReceiptHub */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">IntentReceiptHub</h2>
        <p className="mt-2 text-sm text-zinc-400 font-mono break-all">
          <a href={`${EXPLORER_BASE}/address/${CONTRACTS.intentReceiptHub}`} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200">
            {CONTRACTS.intentReceiptHub} &#8599;
          </a>
        </p>
        <div className="mt-4">
          <CodeBlock
            language="solidity"
            code={`// Post Receipts
function postReceipt(IntentReceipt receipt) returns (bytes32 receiptId);
function postReceiptV2(IntentReceiptV2 receipt) returns (bytes32 receiptId);

// Disputes
function openDispute(
    bytes32 receiptId,
    bytes32 evidenceHash,
    uint8 reasonCode
) payable returns (bytes32 disputeId);
function resolveDeterministic(bytes32 disputeId);

// Finalization
function finalize(bytes32 receiptId);

// Read Functions
function getReceipt(bytes32 receiptId) returns (IntentReceipt);
function getReceiptV2(bytes32 receiptId) returns (IntentReceiptV2);
function getDisputeStatus(bytes32 disputeId) returns (DisputeStatus);
function challengeWindow() returns (uint256);  // 3600 (1 hour)

// Events
event ReceiptPosted(bytes32 indexed receiptId, bytes32 indexed solverId);
event ReceiptFinalized(bytes32 indexed receiptId);
event DisputeOpened(bytes32 indexed disputeId, bytes32 indexed receiptId);
event DisputeResolved(bytes32 indexed disputeId, bool solverFault);`}
          />
        </div>
      </div>

      {/* DisputeModule */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">DisputeModule</h2>
        <p className="mt-2 text-sm text-zinc-400 font-mono break-all">
          <a href={`${EXPLORER_BASE}/address/${CONTRACTS.disputeModule}`} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200">
            {CONTRACTS.disputeModule} &#8599;
          </a>
        </p>
        <div className="mt-4">
          <CodeBlock
            language="solidity"
            code={`// Evidence
function submitEvidence(bytes32 disputeId, bytes32 evidenceHash);

// Optimistic Resolution
function postCounterBond(bytes32 disputeId) payable;
function escalateToArbitrator(bytes32 disputeId);
function resolveArbitration(bytes32 disputeId, bool solverFault);

// Read Functions
function counterBondWindow() returns (uint256);   // 86400 (24 hours)
function arbitrationTimeout() returns (uint256);   // 604800 (7 days)

// Events
event EvidenceSubmitted(bytes32 indexed disputeId, bytes32 evidenceHash);
event CounterBondPosted(bytes32 indexed disputeId, uint256 amount);
event DisputeEscalated(bytes32 indexed disputeId);
event ArbitrationResolved(bytes32 indexed disputeId, bool solverFault);`}
          />
        </div>
      </div>

      {/* Reason Codes */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Dispute Reason Codes</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-700">
          <table className="w-full">
            <thead className="bg-zinc-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
              {[
                { code: '0', name: 'TIMEOUT', resolution: 'Deterministic (auto-slash)' },
                { code: '1', name: 'WRONG_AMOUNT', resolution: 'Deterministic (auto-slash)' },
                { code: '2', name: 'CONSTRAINT_VIOLATION', resolution: 'Deterministic (auto-slash)' },
                { code: '3', name: 'INVALID_SIGNATURE', resolution: 'Deterministic (auto-slash)' },
                { code: '4', name: 'OTHER', resolution: 'Optimistic (counter-bond / arbitration)' },
              ].map((row) => (
                <tr key={row.code}>
                  <td className="px-6 py-3 text-sm font-mono text-zinc-200">{row.code}</td>
                  <td className="px-6 py-3 text-sm font-mono text-zinc-300">{row.name}</td>
                  <td className="px-6 py-3 text-sm text-zinc-400">{row.resolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Errors */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Custom Errors</h2>
        <div className="mt-4">
          <CodeBlock
            language="solidity"
            code={`error SolverNotActive();
error InsufficientBond();
error ChallengeWindowExpired();
error ChallengeWindowActive();
error DisputeAlreadyOpen();
error UnauthorizedCaller();
error WithdrawalCooldownActive();
error SolverBanned();`}
          />
        </div>
      </div>

      {/* Interacting via cast */}
      <div>
        <h2 className="text-xl font-bold text-zinc-50">Direct Interaction (cast)</h2>
        <div className="mt-4">
          <CodeBlock
            language="bash"
            code={`# Read minimum bond
cast call ${CONTRACTS.solverRegistry} \\
  "minimumBond()" --rpc-url https://rpc.sepolia.org

# Read challenge window (seconds)
cast call ${CONTRACTS.intentReceiptHub} \\
  "challengeWindow()" --rpc-url https://rpc.sepolia.org

# Read solver info
cast call ${CONTRACTS.solverRegistry} \\
  "getSolver(bytes32)" <solver-id> --rpc-url https://rpc.sepolia.org`}
          />
        </div>
      </div>
    </div>
  )
}
