"""Tests for corpus ingestor configuration (no network required)."""

import os
import tempfile

from shared.corpus.ingestor import ERC_SPECS, IRSB_REPOS, discover_files


def test_irsb_repos_defined():
    """All 4 IRSB repos are configured for ingestion."""
    names = [r["name"] for r in IRSB_REPOS]
    assert "irsb-protocol" in names
    assert "irsb-solver" in names
    assert "irsb-watchtower" in names
    assert "irsb-agent-passkey" in names
    assert len(IRSB_REPOS) == 4


def test_repos_have_urls():
    """Each repo has a valid GitHub URL."""
    for repo in IRSB_REPOS:
        assert repo["url"].startswith("https://github.com/intent-solutions-io/")
        assert repo["url"].endswith(".git")


def test_repos_have_extensions():
    """Each repo specifies file extensions to index."""
    for repo in IRSB_REPOS:
        assert len(repo["extensions"]) > 0
        for ext in repo["extensions"]:
            assert ext.startswith(".")


def test_repos_exclude_node_modules():
    """All repos exclude node_modules."""
    for repo in IRSB_REPOS:
        assert "node_modules" in repo["exclude_dirs"]
        assert ".git" in repo["exclude_dirs"]


def test_erc_specs_defined():
    """ERC specs are configured."""
    names = [s["name"] for s in ERC_SPECS]
    assert "ERC-8004" in names
    assert "EIP-7702" in names


def test_discover_files():
    """discover_files finds files by extension and respects exclusions."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create test files
        os.makedirs(os.path.join(tmpdir, "src"))
        os.makedirs(os.path.join(tmpdir, "node_modules"))

        open(os.path.join(tmpdir, "src", "contract.sol"), "w").close()
        open(os.path.join(tmpdir, "src", "helper.ts"), "w").close()
        open(os.path.join(tmpdir, "node_modules", "dep.ts"), "w").close()
        open(os.path.join(tmpdir, "README.md"), "w").close()

        # Should find .sol and .ts but not in node_modules
        files = discover_files(tmpdir, [".sol", ".ts"], ["node_modules"])
        basenames = [os.path.basename(f) for f in files]
        assert "contract.sol" in basenames
        assert "helper.ts" in basenames
        assert "dep.ts" not in basenames
        assert "README.md" not in basenames

        # Should find .md
        md_files = discover_files(tmpdir, [".md"], ["node_modules"])
        assert len(md_files) == 1
