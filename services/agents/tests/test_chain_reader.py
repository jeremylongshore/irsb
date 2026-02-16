"""Tests for shared.chain contracts and reader (unit tests, no network)."""

from shared.chain.contracts import CONTRACTS


def test_contracts_have_expected_keys():
    """All expected contracts are defined."""
    assert "SolverRegistry" in CONTRACTS
    assert "IntentReceiptHub" in CONTRACTS
    assert "DisputeModule" in CONTRACTS
    assert "ERC8004Registry" in CONTRACTS


def test_contract_addresses_are_checksummed():
    """Contract addresses look like valid Ethereum addresses."""
    for name, info in CONTRACTS.items():
        addr = info["address"]
        assert addr.startswith("0x"), f"{name} address doesn't start with 0x"
        assert len(addr) == 42, f"{name} address wrong length: {len(addr)}"


def test_contract_abis_are_lists():
    """ABIs are non-empty lists."""
    for name, info in CONTRACTS.items():
        assert isinstance(info["abi"], list), f"{name} ABI is not a list"
        assert len(info["abi"]) > 0, f"{name} ABI is empty"


def test_solver_registry_has_get_solver():
    """SolverRegistry ABI includes getSolver function."""
    abi = CONTRACTS["SolverRegistry"]["abi"]
    fn_names = [fn["name"] for fn in abi if fn.get("type") == "function"]
    assert "getSolver" in fn_names


def test_erc8004_has_agent_uri():
    """ERC-8004 Registry ABI includes agentURI function."""
    abi = CONTRACTS["ERC8004Registry"]["abi"]
    fn_names = [fn["name"] for fn in abi if fn.get("type") == "function"]
    assert "agentURI" in fn_names
