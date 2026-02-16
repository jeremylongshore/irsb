"""
On-chain reader — read-only queries against IRSB Sepolia contracts.

Uses web3.py to query SolverRegistry, IntentReceiptHub, DisputeModule.
"""

from typing import Any

from .contracts import CONTRACTS


class ChainReader:
    """Read-only on-chain queries for IRSB contracts."""

    def __init__(self, rpc_url: str | None = None):
        from ..core.config import Config

        self.rpc_url = rpc_url or Config.SEPOLIA_RPC_URL
        self._w3: Any = None

    def _get_w3(self) -> Any:
        if self._w3 is None:
            from web3 import Web3

            self._w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        return self._w3

    def _get_contract(self, name: str) -> Any:
        w3 = self._get_w3()
        info = CONTRACTS[name]
        return w3.eth.contract(address=info["address"], abi=info["abi"])

    def get_solver_info(self, solver_id: bytes) -> dict[str, Any]:
        """Get solver registration info from SolverRegistry."""
        contract = self._get_contract("SolverRegistry")
        try:
            info = contract.functions.getSolver(solver_id).call()
            return {
                "solver_id": solver_id.hex(),
                "owner": info[0],
                "bond_amount": info[1],
                "registered": True,
            }
        except Exception as e:
            return {"solver_id": solver_id.hex(), "registered": False, "error": str(e)}

    def get_receipt(self, receipt_id: bytes) -> dict[str, Any]:
        """Get intent receipt from IntentReceiptHub."""
        contract = self._get_contract("IntentReceiptHub")
        try:
            receipt = contract.functions.getReceipt(receipt_id).call()
            return {
                "receipt_id": receipt_id.hex(),
                "exists": True,
                "data": receipt,
            }
        except Exception as e:
            return {"receipt_id": receipt_id.hex(), "exists": False, "error": str(e)}

    def get_agent_uri(self, agent_id: int) -> str | None:
        """Get ERC-8004 agent URI from IdentityRegistry."""
        contract = self._get_contract("ERC8004Registry")
        try:
            result: str = contract.functions.agentURI(agent_id).call()
            return result
        except Exception:
            return None

    def is_connected(self) -> bool:
        try:
            connected: bool = self._get_w3().is_connected()
            return connected
        except Exception:
            return False
