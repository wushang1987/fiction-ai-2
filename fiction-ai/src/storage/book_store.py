from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .paths import (
    book_chat_log_file,
    book_chapters_dir,
    book_chapters_index_file,
    book_dir,
    book_file,
    book_outline_file,
    book_sessions_dir,
)


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


def ensure_book_dirs(workspace_root: Path, book_id: str) -> None:
    book_dir(workspace_root, book_id).mkdir(parents=True, exist_ok=True)
    book_chapters_dir(workspace_root, book_id).mkdir(parents=True, exist_ok=True)
    book_sessions_dir(workspace_root, book_id).mkdir(parents=True, exist_ok=True)


def save_book(workspace_root: Path, state: BookState) -> None:
    ensure_book_dirs(workspace_root, state.book_id)
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
    }
    book_file(workspace_root, state.book_id).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def load_book(workspace_root: Path, book_id: str) -> BookState:
    data = json.loads(book_file(workspace_root, book_id).read_text(encoding="utf-8"))
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
    )


def save_outline(workspace_root: Path, book_id: str, outline_markdown: str) -> None:
    ensure_book_dirs(workspace_root, book_id)
    book_outline_file(workspace_root, book_id).write_text(outline_markdown, encoding="utf-8")


def load_outline(workspace_root: Path, book_id: str) -> str | None:
    path = book_outline_file(workspace_root, book_id)
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def _load_chapter_index(workspace_root: Path, book_id: str) -> list[dict[str, Any]]:
    path = book_chapters_index_file(workspace_root, book_id)
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _save_chapter_index(workspace_root: Path, book_id: str, items: list[dict[str, Any]]) -> None:
    path = book_chapters_index_file(workspace_root, book_id)
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def next_chapter_number(workspace_root: Path, book_id: str) -> int:
    items = _load_chapter_index(workspace_root, book_id)
    if not items:
        return 1
    return int(max(i.get("number", 0) for i in items) + 1)


def list_chapters(workspace_root: Path, book_id: str) -> list[dict[str, Any]]:
    """Return the chapter index items sorted by chapter number.

    Each item is a dict with: number (int), title (str), updated_at (str).
    """
    items = _load_chapter_index(workspace_root, book_id)
    items.sort(key=lambda x: int(x.get("number", 0)))
    return items


def load_chapter(workspace_root: Path, book_id: str, *, number: int) -> str | None:
    """Load chapter markdown by number. Returns None if the file doesn't exist."""
    path = book_chapters_dir(workspace_root, book_id) / f"{int(number):04d}.md"
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def chapter_title_from_index(
    workspace_root: Path, book_id: str, *, number: int
) -> str | None:
    for item in _load_chapter_index(workspace_root, book_id):
        if int(item.get("number", -1)) == int(number):
            return str(item.get("title") or "") or None
    return None


def save_chapter(
    workspace_root: Path,
    book_id: str,
    *,
    number: int,
    title: str,
    content_markdown: str,
) -> Path:
    ensure_book_dirs(workspace_root, book_id)
    chapter_path = book_chapters_dir(workspace_root, book_id) / f"{number:04d}.md"
    chapter_path.write_text(content_markdown, encoding="utf-8")

    items = _load_chapter_index(workspace_root, book_id)
    now = _now_iso()
    items = [i for i in items if int(i.get("number", -1)) != int(number)]
    items.append({"number": int(number), "title": title, "updated_at": now})
    items.sort(key=lambda x: int(x.get("number", 0)))
    _save_chapter_index(workspace_root, book_id, items)
    return chapter_path


def append_chat_log(workspace_root: Path, book_id: str, record: dict[str, Any]) -> None:
    ensure_book_dirs(workspace_root, book_id)
    path = book_chat_log_file(workspace_root, book_id)
    line = json.dumps(record, ensure_ascii=False)
    with path.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
