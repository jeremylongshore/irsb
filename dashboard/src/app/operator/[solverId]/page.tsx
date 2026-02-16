import OperatorPageClient from './OperatorPageClient'

// Real testnet solver IDs (bytes32, registered on Sepolia)
const TESTNET_SOLVER_IDS = [
  '0xdf816d7b86303c3452e53d84aaa02c01b0de6ae23c1e518bd2642870f9f7603b', // IRSB Test Solver
]

export function generateStaticParams() {
  return TESTNET_SOLVER_IDS.map(solverId => ({ solverId }))
}

interface PageProps {
  params: { solverId: string }
}

export default function OperatorPage({ params }: PageProps) {
  return <OperatorPageClient solverId={params.solverId} />
}
