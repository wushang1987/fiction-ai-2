from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .paths import books_dir, project_file, project_root_dir


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"[^a-z0-9\-\u4e00-\u9fff]", "", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "book"


@dataclass
class BookRef:
    book_id: str
    title: str
    slug: str
    created_at: str
    updated_at: str
    status: str = "active"


@dataclass
class ProjectState:
    schema_version: int
    project_id: str
    created_at: str
    active_book_id: str | None
    books: list[BookRef]


def ensure_project(workspace_root: Path) -> ProjectState:
    project_root = project_root_dir(workspace_root)
    project_root.mkdir(parents=True, exist_ok=True)
    books_dir(workspace_root).mkdir(parents=True, exist_ok=True)

    path = project_file(workspace_root)
    if path.exists():
        return load_project(workspace_root)

    state = ProjectState(
        schema_version=1,
        project_id=str(uuid.uuid4()),
        created_at=_now_iso(),
        active_book_id=None,
        books=[],
    )
    save_project(workspace_root, state)
    return state


def load_project(workspace_root: Path) -> ProjectState:
    data = json.loads(project_file(workspace_root).read_text(encoding="utf-8"))
    books = [BookRef(**b) for b in data.get("books", [])]
    return ProjectState(
        schema_version=int(data.get("schema_version", 1)),
        project_id=str(data.get("project_id")),
        created_at=str(data.get("created_at")),
        active_book_id=data.get("active_book_id"),
        books=books,
    )


def save_project(workspace_root: Path, state: ProjectState) -> None:
    payload: dict[str, Any] = {
        "schema_version": state.schema_version,
        "project_id": state.project_id,
        "created_at": state.created_at,
        "active_book_id": state.active_book_id,
        "books": [
            {
                "book_id": b.book_id,
                "title": b.title,
                "slug": b.slug,
                "created_at": b.created_at,
                "updated_at": b.updated_at,
                "status": b.status,
            }
            for b in state.books
        ],
    }
    project_file(workspace_root).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def create_book(workspace_root: Path, state: ProjectState, *, title: str) -> BookRef:
    now = _now_iso()
    book = BookRef(
        book_id=str(uuid.uuid4()),
        title=title.strip() or "Untitled",
        slug=_slugify(title),
        created_at=now,
        updated_at=now,
        status="active",
    )
    state.books.append(book)
    state.active_book_id = book.book_id
    save_project(workspace_root, state)
    return book


def set_active_book(workspace_root: Path, state: ProjectState, book_id: str) -> None:
    state.active_book_id = book_id
    save_project(workspace_root, state)


def find_books(state: ProjectState, query: str) -> list[BookRef]:
    q = query.strip().lower()
    if not q:
        return []

    hits: list[BookRef] = []
    for b in state.books:
        if q in b.title.lower() or q == b.slug.lower() or q == b.book_id.lower():
            hits.append(b)

    # fallback: fuzzy contains on chinese punctuation-stripped
    if not hits:
        q2 = re.sub(r"[《》\"'“”]", "", q)
        for b in state.books:
            t2 = re.sub(r"[《》\"'“”]", "", b.title.lower())
            if q2 and q2 in t2:
                hits.append(b)

    return hits


def list_books_text(state: ProjectState) -> str:
    if not state.books:
        return "当前还没有任何小说。你可以说：‘写一个3000字的校园爱情小说’ 来创建第一本。"

    lines = []
    for b in state.books:
        marker = "*" if b.book_id == state.active_book_id else " "
        lines.append(f"{marker} {b.title}  (id={b.book_id[:8]})")
    return "\n".join(lines)
