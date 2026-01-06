from __future__ import annotations

from pathlib import Path


def project_root_dir(workspace_root: Path) -> Path:
    return workspace_root / ".fiction_ai"


def project_file(workspace_root: Path) -> Path:
    return project_root_dir(workspace_root) / "project.json"


def books_dir(workspace_root: Path) -> Path:
    return project_root_dir(workspace_root) / "books"


def book_dir(workspace_root: Path, book_id: str) -> Path:
    return books_dir(workspace_root) / book_id


def book_file(workspace_root: Path, book_id: str) -> Path:
    return book_dir(workspace_root, book_id) / "book.json"


def book_outline_file(workspace_root: Path, book_id: str) -> Path:
    return book_dir(workspace_root, book_id) / "outline.md"


def book_chapters_dir(workspace_root: Path, book_id: str) -> Path:
    return book_dir(workspace_root, book_id) / "chapters"


def book_chapters_index_file(workspace_root: Path, book_id: str) -> Path:
    return book_chapters_dir(workspace_root, book_id) / "index.json"


def book_sessions_dir(workspace_root: Path, book_id: str) -> Path:
    return book_dir(workspace_root, book_id) / "sessions"


def book_chat_log_file(workspace_root: Path, book_id: str) -> Path:
    return book_sessions_dir(workspace_root, book_id) / "chat.jsonl"


def snippets_dir(workspace_root: Path) -> Path:
    return project_root_dir(workspace_root) / "snippets"


def snippets_jsonl_file(workspace_root: Path) -> Path:
    return snippets_dir(workspace_root) / "snippets.jsonl"


def snippets_db_file(workspace_root: Path) -> Path:
    return snippets_dir(workspace_root) / "snippets.db"
