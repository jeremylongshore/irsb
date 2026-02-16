"""
Contract addresses and minimal ABIs for IRSB Sepolia deployment.

Full ABIs live in protocol/out/ — these are the read-only subsets needed by agents.
"""

CONTRACTS = {
    "SolverRegistry": {
        "address": "0xB6ab964832808E49635fF82D1996D6a888ecB745",
        "abi": [
            {
                "inputs": [{"name": "solverId", "type": "bytes32"}],
                "name": "getSolver",
                "outputs": [
                    {"name": "owner", "type": "address"},
                    {"name": "bondAmount", "type": "uint256"},
                    {"name": "active", "type": "bool"},
                    {"name": "registeredAt", "type": "uint256"},
                ],
                "stateMutability": "view",
                "type": "function",
            },
            {
                "inputs": [{"name": "solverId", "type": "bytes32"}],
                "name": "getSolverBond",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function",
            },
        ],
    },
    "IntentReceiptHub": {
        "address": "0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c",
        "abi": [
            {
                "inputs": [{"name": "receiptId", "type": "bytes32"}],
                "name": "getReceipt",
                "outputs": [
                    {"name": "intentHash", "type": "bytes32"},
                    {"name": "solver", "type": "address"},
                    {"name": "submittedAt", "type": "uint256"},
                    {"name": "version", "type": "uint8"},
                ],
                "stateMutability": "view",
                "type": "function",
            },
        ],
    },
    "DisputeModule": {
        "address": "0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D",
        "abi": [
            {
                "inputs": [{"name": "disputeId", "type": "bytes32"}],
                "name": "getDispute",
                "outputs": [
                    {"name": "receiptId", "type": "bytes32"},
                    {"name": "challenger", "type": "address"},
                    {"name": "status", "type": "uint8"},
                    {"name": "filedAt", "type": "uint256"},
                ],
                "stateMutability": "view",
                "type": "function",
            },
        ],
    },
    "ERC8004Registry": {
        "address": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
        "abi": [
            {
                "inputs": [{"name": "agentId", "type": "uint256"}],
                "name": "agentURI",
                "outputs": [{"name": "", "type": "string"}],
                "stateMutability": "view",
                "type": "function",
            },
            {
                "inputs": [{"name": "agentId", "type": "uint256"}],
                "name": "ownerOf",
                "outputs": [{"name": "", "type": "address"}],
                "stateMutability": "view",
                "type": "function",
            },
        ],
    },
}
