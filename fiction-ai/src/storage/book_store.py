from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .mongodb import get_collection


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class BookState:
    book_id: str
    title: str
    slug: str
    premise: str
    genre: str
    target_words: int | None
    style_guide: str
    created_at: str
    updated_at: str
    is_public: bool = False
    user_id: str | None = None


def ensure_book_dirs(workspace_root: Path, book_id: str) -> None:
    # No directories needed for MongoDB
    pass


def save_book(workspace_root: Path, state: BookState) -> None:
    col = get_collection("books")
    payload: dict[str, Any] = {
        "book_id": state.book_id,
        "title": state.title,
        "slug": state.slug,
        "premise": state.premise,
        "genre": state.genre,
        "target_words": state.target_words,
        "style_guide": state.style_guide,
        "created_at": state.created_at,
        "updated_at": state.updated_at,
        "is_public": state.is_public,
        "user_id": state.user_id,
    }
    col.replace_one({"book_id": state.book_id}, payload, upsert=True)


def load_book(workspace_root: Path, book_id: str) -> BookState:
    col = get_collection("books")
    data = col.find_one({"book_id": book_id})
    if not data:
        raise FileNotFoundError(f"Book {book_id} not found in MongoDB")
    
    return BookState(
        book_id=str(data["book_id"]),
        title=str(data.get("title", "Untitled")),
        slug=str(data.get("slug", "book")),
        premise=str(data.get("premise", "")),
        genre=str(data.get("genre", "")),
        target_words=data.get("target_words"),
        style_guide=str(data.get("style_guide", "")),
        created_at=str(data.get("created_at", _now_iso())),
        updated_at=str(data.get("updated_at", _now_iso())),
        is_public=bool(data.get("is_public", False)),
        user_id=data.get("user_id"),
    )


def create_book_state(
    *,
    book_id: str,
    title: str,
    slug: str,
    premise: str,
    genre: str,
    target_words: int | None,
    style_guide: str = "",
    is_public: bool = False,
    user_id: str | None = None,
) -> BookState:
    now = _now_iso()
    return BookState(
        book_id=book_id,
        title=title,
        slug=slug,
        premise=premise,
        genre=genre,
        target_words=target_words,
        style_guide=style_guide,
        created_at=now,
        updated_at=now,
        is_public=is_public,
        user_id=user_id,
    )


def save_outline(workspace_root: Path, book_id: str, outline_markdown: str) -> None:
    col = get_collection("outlines")
    col.replace_one(
        {"book_id": book_id},
        {"book_id": book_id, "outline_markdown": outline_markdown, "updated_at": _now_iso()},
        upsert=True
    )


def load_outline(workspace_root: Path, book_id: str) -> str | None:
    col = get_collection("outlines")
    doc = col.find_one({"book_id": book_id})
    return doc["outline_markdown"] if doc else None


def _load_chapter_index(workspace_root: Path, book_id: str) -> list[dict[str, Any]]:
    col = get_collection("chapters")
    # Return metadata only
    docs = col.find({"book_id": book_id}, {"number": 1, "title": 1, "updated_at": 1, "_id": 0})
    return list(docs)


def _save_chapter_index(workspace_root: Path, book_id: str, items: list[dict[str, Any]]) -> None:
    # In MongoDB, we don't strictly need a separate index, as we can query the chapters collection.
    # But for compatibility, we ensure chapters exist or metadata is updated.
    pass


def next_chapter_number(workspace_root: Path, book_id: str) -> int:
    items = _load_chapter_index(workspace_root, book_id)
    if not items:
        return 1
    return int(max(i.get("number", 0) for i in items) + 1)


def list_chapters(workspace_root: Path, book_id: str) -> list[dict[str, Any]]:
    items = _load_chapter_index(workspace_root, book_id)
    items.sort(key=lambda x: int(x.get("number", 0)))
    return items


def load_chapter(workspace_root: Path, book_id: str, *, number: int) -> str | None:
    col = get_collection("chapters")
    doc = col.find_one({"book_id": book_id, "number": int(number)})
    return doc["content_markdown"] if doc else None


def chapter_title_from_index(
    workspace_root: Path, book_id: str, *, number: int
) -> str | None:
    col = get_collection("chapters")
    doc = col.find_one({"book_id": book_id, "number": int(number)}, {"title": 1})
    return doc["title"] if doc else None


def save_chapter(
    workspace_root: Path,
    book_id: str,
    *,
    number: int,
    title: str,
    content_markdown: str,
) -> Any:
    col = get_collection("chapters")
    now = _now_iso()
    col.replace_one(
        {"book_id": book_id, "number": int(number)},
        {
            "book_id": book_id,
            "number": int(number),
            "title": title,
            "content_markdown": content_markdown,
            "updated_at": now
        },
        upsert=True
    )
    return True


    col.insert_one(record)


def delete_book_all_data(workspace_root: Path, book_id: str) -> None:
    # Remove from books collection
    get_collection("books").delete_one({"book_id": book_id})
    # Remove from outlines collection
    get_collection("outlines").delete_one({"book_id": book_id})
    # Remove from chapters collection
    get_collection("chapters").delete_many({"book_id": book_id})
    # Remove from chat_logs
    get_collection("chat_logs").delete_many({"book_id": book_id})
    # Snippets associated with the book could be kept or removed;
    # Usually better to remove them if they are book-specific.
    get_collection("snippets").delete_many({"book_id": book_id})
