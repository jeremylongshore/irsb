"""
SQLite audit ledger — tracks every query and index operation.
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import Config
from .models import IndexResult, QueryResponse


class RunLedger:
    """SQLite-backed audit trail for all agent operations."""

    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or Config.LEDGER_DB_PATH
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS index_runs (
                    run_id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    files_processed INTEGER NOT NULL,
                    files_skipped INTEGER NOT NULL,
                    total_chunks INTEGER NOT NULL,
                    processing_time_ms REAL NOT NULL,
                    document_sources TEXT NOT NULL,
                    embed_provider TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS query_runs (
                    run_id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    model_used TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    latency_ms REAL NOT NULL,
                    citation_count INTEGER NOT NULL,
                    excerpt_hashes TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_query_ws
                ON query_runs(workspace_id, timestamp DESC)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_index_ws
                ON index_runs(workspace_id, timestamp DESC)
            """)
            conn.commit()

    def record_index_run(self, result: IndexResult, embed_provider: str) -> str:
        run_id = f"idx_{result.workspace_id}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        sources_json = json.dumps([
            {
                "file_path": s.file_path,
                "file_hash": s.file_hash,
                "file_mtime": s.file_mtime,
                "indexed_at": s.indexed_at.isoformat(),
            }
            for s in result.document_sources
        ])
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """INSERT INTO index_runs
                   (run_id, workspace_id, timestamp, files_processed, files_skipped,
                    total_chunks, processing_time_ms, document_sources, embed_provider)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    run_id,
                    result.workspace_id,
                    datetime.now().isoformat(),
                    result.files_processed,
                    result.files_skipped,
                    result.total_chunks,
                    result.processing_time_ms,
                    sources_json,
                    embed_provider,
                ),
            )
            conn.commit()
        return run_id

    def record_query_run(
        self, response: QueryResponse, excerpt_hashes: list[str] | None = None
    ) -> str:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """INSERT INTO query_runs
                   (run_id, workspace_id, timestamp, question, answer,
                    model_used, provider, latency_ms, citation_count, excerpt_hashes)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    response.run_id,
                    response.workspace_id,
                    response.timestamp.isoformat(),
                    response.question[:500],
                    response.answer[:2000],
                    response.model_used,
                    response.provider,
                    response.latency_ms,
                    len(response.citations),
                    json.dumps(excerpt_hashes or []),
                ),
            )
            conn.commit()
        return response.run_id

    def list_runs(
        self,
        workspace_id: str | None = None,
        run_type: str = "all",
        limit: int = 100,
    ) -> dict[str, list[dict[str, Any]]]:
        results: dict[str, list[dict[str, Any]]] = {"index_runs": [], "query_runs": []}
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            for table, key in [("index_runs", "index"), ("query_runs", "query")]:
                if run_type not in (key, "all"):
                    continue
                sql = f"SELECT * FROM {table} WHERE 1=1"
                params: list[Any] = []
                if workspace_id:
                    sql += " AND workspace_id = ?"
                    params.append(workspace_id)
                sql += " ORDER BY timestamp DESC LIMIT ?"
                params.append(limit)
                rows = conn.execute(sql, params).fetchall()
                results[f"{key}_runs"] = [dict(r) for r in rows]
        return results

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            for table in ("index_runs", "query_runs"):
                row = conn.execute(
                    f"SELECT * FROM {table} WHERE run_id = ?", (run_id,)
                ).fetchone()
                if row:
                    return dict(row)
        return None
