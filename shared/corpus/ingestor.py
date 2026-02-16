"""
Corpus ingestor — clone all IRSB repos, discover code/docs, index into ChromaDB.

Usage:
    python -m shared.corpus.ingestor
"""

import os
from collections.abc import Sequence

from ..core.config import Config
from ..core.models import IndexRequest
from ..core.rag_pipeline import RAGPipeline

# IRSB repositories to index
IRSB_REPOS = [
    {
        "name": "irsb-protocol",
        "url": "https://github.com/intent-solutions-io/irsb-protocol.git",
        "extensions": [".sol", ".ts", ".md", ".json"],
        "exclude_dirs": ["node_modules", ".git", "out", "cache", "artifacts", "lib"],
    },
    {
        "name": "irsb-solver",
        "url": "https://github.com/intent-solutions-io/irsb-solver.git",
        "extensions": [".ts", ".md", ".json"],
        "exclude_dirs": ["node_modules", ".git", "dist"],
    },
    {
        "name": "irsb-watchtower",
        "url": "https://github.com/intent-solutions-io/irsb-watchtower.git",
        "extensions": [".ts", ".md", ".json"],
        "exclude_dirs": ["node_modules", ".git", "dist"],
    },
    {
        "name": "irsb-agent-passkey",
        "url": "https://github.com/intent-solutions-io/irsb-agent-passkey.git",
        "extensions": [".ts", ".md", ".json"],
        "exclude_dirs": ["node_modules", ".git", "dist"],
    },
]

# ERC/EIP specs to fetch (as raw markdown from ethereum/ERCs)
ERC_SPECS = [
    {
        "name": "ERC-8004",
        "url": "https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-8004.md",
    },
    {
        "name": "EIP-7702",
        "url": "https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-7702.md",
    },
]


def clone_or_pull_repo(repo: dict, corpus_dir: str) -> str:
    """Clone repo if missing, or pull latest if exists. Returns local path."""
    import git

    local_path = os.path.join(corpus_dir, repo["name"])

    if os.path.exists(local_path):
        try:
            r = git.Repo(local_path)
            r.remotes.origin.pull()
            print(f"  Updated {repo['name']}")
        except Exception as e:
            print(f"  Warning: pull failed for {repo['name']}: {e}")
    else:
        print(f"  Cloning {repo['name']}...")
        git.Repo.clone_from(repo["url"], local_path)
        print(f"  Cloned {repo['name']}")

    return local_path


def fetch_erc_spec(spec: dict, corpus_dir: str) -> str:
    """Fetch ERC/EIP spec markdown. Returns local path."""
    import httpx

    specs_dir = os.path.join(corpus_dir, "specs")
    os.makedirs(specs_dir, exist_ok=True)

    filename = f"{spec['name'].lower()}.md"
    local_path = os.path.join(specs_dir, filename)

    try:
        resp = httpx.get(spec["url"], timeout=30, follow_redirects=True)
        resp.raise_for_status()
        with open(local_path, "w") as f:
            f.write(resp.text)
        print(f"  Fetched {spec['name']}")
    except Exception as e:
        print(f"  Warning: failed to fetch {spec['name']}: {e}")

    return local_path


def discover_files(
    repo_path: str, extensions: Sequence[str], exclude_dirs: Sequence[str]
) -> list[str]:
    """Walk repo and collect files matching extensions, excluding dirs."""
    files: list[str] = []
    for root, dirs, filenames in os.walk(repo_path):
        # Prune excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for fname in filenames:
            if any(fname.endswith(ext) for ext in extensions):
                files.append(os.path.join(root, fname))
    return files


def ingest(corpus_dir: str | None = None, workspace_id: str = "irsb") -> dict:
    """
    Main ingestion: clone repos, fetch specs, index everything.

    Returns stats dict.
    """
    corpus_dir = corpus_dir or Config.CORPUS_DIR
    os.makedirs(corpus_dir, exist_ok=True)

    all_files: list[str] = []

    # Clone/update IRSB repos
    print("Cloning/updating IRSB repos...")
    for repo in IRSB_REPOS:
        local_path = clone_or_pull_repo(repo, corpus_dir)
        files = discover_files(local_path, repo["extensions"], repo["exclude_dirs"])
        all_files.extend(files)
        print(f"  {repo['name']}: {len(files)} files")

    # Fetch ERC specs
    print("Fetching ERC/EIP specs...")
    for spec in ERC_SPECS:
        spec_path = fetch_erc_spec(spec, corpus_dir)
        if os.path.exists(spec_path):
            all_files.append(spec_path)

    print(f"\nTotal files to index: {len(all_files)}")

    # Index into ChromaDB
    print("Indexing into ChromaDB...")
    pipeline = RAGPipeline(workspace_id=workspace_id)
    request = IndexRequest(paths=all_files, workspace_id=workspace_id, force_reindex=True)
    result = pipeline.index_documents(request)

    stats = {
        "repos": len(IRSB_REPOS),
        "specs": len(ERC_SPECS),
        "files_processed": result.files_processed,
        "total_chunks": result.total_chunks,
        "processing_time_ms": result.processing_time_ms,
    }

    print("\nIngestion complete:")
    print(f"  Repos: {stats['repos']}")
    print(f"  Specs: {stats['specs']}")
    print(f"  Files: {stats['files_processed']}")
    print(f"  Chunks: {stats['total_chunks']}")
    print(f"  Time: {stats['processing_time_ms']:.0f}ms")

    return stats


if __name__ == "__main__":
    ingest()
