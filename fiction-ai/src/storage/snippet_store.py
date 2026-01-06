from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .paths import snippets_db_file, snippets_dir, snippets_jsonl_file


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Snippet:
    snippet_id: str
    book_id: str | None
    created_at: str
    title: str
    text: str
    tags: list[str]
    source: str
    url: str | None


def ensure_snippet_store(workspace_root: Path) -> None:
    snippets_dir(workspace_root).mkdir(parents=True, exist_ok=True)
    _ensure_db(workspace_root)


def add_snippet(
    workspace_root: Path,
    *,
    text: str,
    book_id: str | None,
    title: str | None = None,
    tags: Iterable[str] | None = None,
    source: str = "user",
    url: str | None = None,
) -> Snippet:
    ensure_snippet_store(workspace_root)

    snippet = Snippet(
        snippet_id=str(uuid.uuid4()),
        book_id=book_id,
        created_at=_now_iso(),
        title=(title or "").strip(),
        text=text.strip(),
        tags=[t.strip() for t in (tags or []) if t and t.strip()],
        source=source,
        url=url,
    )

    jsonl_path = snippets_jsonl_file(workspace_root)
    with jsonl_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(_snippet_to_record(snippet), ensure_ascii=False) + "\n")

    _insert_snippet_db(workspace_root, snippet)
    return snippet


def search_snippets(
    workspace_root: Path,
    *,
    query: str,
    book_id: str | None,
    limit: int = 5,
) -> list[Snippet]:
    ensure_snippet_store(workspace_root)
    query = query.strip()
    if not query:
        return []

    # SQLite FTS tokenization is often unfriendly to CJK substring queries.
    # Strategy:
    # - For CJK-heavy queries: prefer LIKE first (substring match).
    # - Otherwise: try FTS first (better ranking), then fallback to LIKE if empty.
    prefer_like = _looks_like_cjk(query)

    primary: list[Snippet] = []
    secondary: list[Snippet] = []

    if prefer_like:
        primary = _search_db_like(workspace_root, query=query, book_id=book_id, limit=limit)
        try:
            secondary = _search_db_fts(workspace_root, query=query, book_id=book_id, limit=limit)
        except sqlite3.OperationalError:
            secondary = []
    else:
        try:
            primary = _search_db_fts(workspace_root, query=query, book_id=book_id, limit=limit)
        except sqlite3.OperationalError:
            primary = []
        if not primary:
            secondary = _search_db_like(workspace_root, query=query, book_id=book_id, limit=limit)

    merged = _merge_unique(primary, secondary)
    return merged[: int(limit)]


def _looks_like_cjk(text: str) -> bool:
    # Basic CJK unified ideographs block.
    for ch in text:
        if "\u4e00" <= ch <= "\u9fff":
            return True
    return False


def _merge_unique(a: list[Snippet], b: list[Snippet]) -> list[Snippet]:
    seen: set[str] = set()
    out: list[Snippet] = []
    for item in a + b:
        if item.snippet_id in seen:
            continue
        seen.add(item.snippet_id)
        out.append(item)
    return out


def _ensure_db(workspace_root: Path) -> None:
    db_path = snippets_db_file(workspace_root)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS snippets (
                snippet_id TEXT PRIMARY KEY,
                book_id TEXT,
                created_at TEXT NOT NULL,
                title TEXT NOT NULL,
                text TEXT NOT NULL,
                tags_json TEXT NOT NULL,
                source TEXT NOT NULL,
                url TEXT
            )
            """
        )

        # Prefer FTS5. If not compiled, this will error and we fallback at query time.
        conn.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS snippets_fts
            USING fts5(snippet_id, title, text, tags, book_id, created_at, source, url)
            """
        )
        conn.commit()
    finally:
        conn.close()


def _insert_snippet_db(workspace_root: Path, snippet: Snippet) -> None:
    db_path = snippets_db_file(workspace_root)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO snippets
            (snippet_id, book_id, created_at, title, text, tags_json, source, url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                snippet.snippet_id,
                snippet.book_id,
                snippet.created_at,
                snippet.title,
                snippet.text,
                json.dumps(snippet.tags, ensure_ascii=False),
                snippet.source,
                snippet.url,
            ),
        )

        try:
            conn.execute(
                """
                INSERT OR REPLACE INTO snippets_fts
                (snippet_id, title, text, tags, book_id, created_at, source, url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    snippet.snippet_id,
                    snippet.title,
                    snippet.text,
                    " ".join(snippet.tags),
                    snippet.book_id or "",
                    snippet.created_at,
                    snippet.source,
                    snippet.url or "",
                ),
            )
        except sqlite3.OperationalError:
            # No FTS available.
            pass

        conn.commit()
    finally:
        conn.close()


def _search_db_fts(
    workspace_root: Path,
    *,
    query: str,
    book_id: str | None,
    limit: int,
) -> list[Snippet]:
    db_path = snippets_db_file(workspace_root)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        # Search both active book and global (book_id = ''). We store null as '' in FTS.
        book_scope = "" if book_id is None else book_id
        rows = conn.execute(
            """
            SELECT snippet_id, book_id, created_at, title, text, tags, source, url
            FROM snippets_fts
            WHERE snippets_fts MATCH ?
              AND (book_id = ? OR book_id = '')
            ORDER BY bm25(snippets_fts)
            LIMIT ?
            """,
            (query, book_scope, int(limit)),
        ).fetchall()
        return [
            Snippet(
                snippet_id=str(r["snippet_id"]),
                book_id=str(r["book_id"]) or None,
                created_at=str(r["created_at"]),
                title=str(r["title"]),
                text=str(r["text"]),
                tags=[t for t in str(r["tags"]).split() if t],
                source=str(r["source"]),
                url=str(r["url"]) or None,
            )
            for r in rows
        ]
    finally:
        conn.close()


def _search_db_like(
    workspace_root: Path,
    *,
    query: str,
    book_id: str | None,
    limit: int,
) -> list[Snippet]:
    db_path = snippets_db_file(workspace_root)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        like = f"%{query}%"
        rows = conn.execute(
            """
            SELECT snippet_id, book_id, created_at, title, text, tags_json, source, url
            FROM snippets
            WHERE (book_id = ? OR book_id IS NULL)
              AND (title LIKE ? OR text LIKE ? OR tags_json LIKE ?)
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (book_id, like, like, like, int(limit)),
        ).fetchall()

        out: list[Snippet] = []
        for r in rows:
            try:
                tags = json.loads(r["tags_json"])
            except Exception:
                tags = []
            out.append(
                Snippet(
                    snippet_id=str(r["snippet_id"]),
                    book_id=str(r["book_id"]) if r["book_id"] is not None else None,
                    created_at=str(r["created_at"]),
                    title=str(r["title"]),
                    text=str(r["text"]),
                    tags=list(tags) if isinstance(tags, list) else [],
                    source=str(r["source"]),
                    url=str(r["url"]) if r["url"] is not None else None,
                )
            )
        return out
    finally:
        conn.close()


def _snippet_to_record(snippet: Snippet) -> dict[str, Any]:
    return {
        "snippet_id": snippet.snippet_id,
        "book_id": snippet.book_id,
        "created_at": snippet.created_at,
        "title": snippet.title,
        "text": snippet.text,
        "tags": snippet.tags,
        "source": snippet.source,
        "url": snippet.url,
    }
