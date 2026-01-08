from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .mongodb import get_collection


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
    # Ensure text index for search
    col = get_collection("snippets")
    # For MongoDB 4.2+, non-atlas doesn't have great CJK without specific configuration,
    # but we can at least index the fields.
    col.create_index([("title", "text"), ("text", "text"), ("tags", "text")])


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

    col = get_collection("snippets")
    col.insert_one(_snippet_to_record(snippet))
    return snippet


def search_snippets(
    workspace_root: Path,
    *,
    query: str,
    book_id: str | None,
    limit: int = 5,
) -> list[Snippet]:
    query = query.strip()
    if not query:
        return []

    col = get_collection("snippets")
    
    # Simple regex search for local robustness with CJK
    import re
    regex_query = re.compile(re.escape(query), re.IGNORECASE)
    
    filter_dict: dict[str, Any] = {
        "$or": [
            {"title": regex_query},
            {"text": regex_query},
            {"tags": regex_query}
        ]
    }
    
    if book_id:
        filter_dict["$or"] = [
            {"book_id": book_id},
            {"book_id": None},
            {"book_id": ""}
        ]
        # We need to combine the search query with the book filter
        filter_dict = {
            "$and": [
                {"$or": [{"book_id": book_id}, {"book_id": None}, {"book_id": ""}]},
                {"$or": [{"title": regex_query}, {"text": regex_query}, {"tags": regex_query}]}
            ]
        }

    docs = col.find(filter_dict).sort("created_at", -1).limit(int(limit))
    
    return [
        Snippet(
            snippet_id=str(d["snippet_id"]),
            book_id=d.get("book_id"),
            created_at=str(d["created_at"]),
            title=str(d["title"]),
            text=str(d["text"]),
            tags=list(d.get("tags", [])),
            source=str(d.get("source", "user")),
            url=d.get("url")
        )
        for d in docs
    ]


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
