from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
import json
import re
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

try:
    # When running as module: `uvicorn src.http_api:app`
    from .llm.client import build_llm, has_llm_config
    from .storage import book_store, project_store, snippet_store, user_store
    from .writing.planner import OutlineRequest, make_outline_markdown
    from .writing.writer import ChapterRequest, stream_chapter_markdown, write_chapter_markdown
    from .auth import (
        create_access_token,
        get_current_user_id,
        get_optional_user_id,
        get_password_hash,
        verify_password,
    )
    from .email_service import send_verification_email
except ImportError:  # pragma: no cover
    # When running with app-dir: `uvicorn http_api:app --app-dir src`
    from llm.client import build_llm, has_llm_config
    from storage import book_store, project_store, snippet_store, user_store
    from writing.planner import OutlineRequest, make_outline_markdown
    from writing.writer import ChapterRequest, stream_chapter_markdown, write_chapter_markdown
    from auth import (
        create_access_token,
        get_current_user_id,
        get_optional_user_id,
        get_password_hash,
        verify_password,
    )
    from email_service import send_verification_email


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _workspace_root() -> Path:
    # Make storage root stable regardless of current working directory.
    # http_api.py lives in: <repo_root>/src/http_api.py
    return Path(__file__).resolve().parents[1]


def _ok(data: Any, *, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"ok": True, "data": data})


def _err(
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "error": {
            "code": code,
            "message": message,
        },
    }
    if details is not None:
        payload["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


def _require_llm() -> JSONResponse | None:
    load_dotenv()
    if not has_llm_config():
        return _err(
            503,
            "LLM_NOT_CONFIGURED",
            "Missing OPENAI_API_KEY; generation endpoints are unavailable.",
        )
    return None


def _guess_title_from_premise(premise: str) -> str:
    for g in ["校园", "爱情", "悬疑", "科幻", "奇幻", "武侠", "历史", "都市", "推理", "治愈"]:
        if g in premise:
            return f"{g}小说"
    return "未命名小说"


def _book_exists(workspace_root: Path, book_id: str) -> bool:
    # Prefer project membership check to avoid reading arbitrary paths.
    project = project_store.ensure_project(workspace_root)
    return any(b.book_id == book_id for b in project.books)


def _get_active_book_id(workspace_root: Path) -> str | None:
    project = project_store.ensure_project(workspace_root)
    return project.active_book_id


def _chapter_count(workspace_root: Path, book_id: str) -> int:
    return len(book_store.list_chapters(workspace_root, book_id))


def _outline_exists(workspace_root: Path, book_id: str) -> bool:
    return book_store.load_outline(workspace_root, book_id) is not None


def _planned_last_chapter_number(outline_markdown: str) -> int | None:
    # Best-effort parsing: outline prompt asks for “第N章” items.
    # We intentionally keep the heuristic simple and conservative.
    m = re.search(r"共\s*(\d{1,3})\s*章", outline_markdown)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            pass

    matches = re.findall(r"第\s*(\d{1,3})\s*章", outline_markdown)
    if not matches:
        matches = re.findall(r"\bChapter\s*(\d{1,3})\b", outline_markdown, flags=re.IGNORECASE)
    nums = [int(x) for x in matches if str(x).isdigit()]

    # Support outlines that use an ordered list under “章节列表”:
    # 1. ...  2. ...  10. ...
    list_nums = re.findall(r"^\s*(\d{1,3})\s*[\.)、]", outline_markdown, flags=re.MULTILINE)
    nums.extend([int(x) for x in list_nums if str(x).isdigit()])

    return max(nums) if nums else None


def _book_payload(workspace_root: Path, book_id: str) -> dict[str, Any]:
    bs = book_store.load_book(workspace_root, book_id)
    payload = asdict(bs)
    payload["outline_exists"] = _outline_exists(workspace_root, book_id)
    payload["chapters_count"] = _chapter_count(workspace_root, book_id)
    return payload


class CreateBookRequest(BaseModel):
    premise: str
    title: str | None = None
    genre: str | None = None
    target_words: int | None = None
    style_guide: str | None = None
    generate_outline: bool = True
    set_active: bool = True


class SetActiveBookRequest(BaseModel):
    book_id: str


class UpdateBookRequest(BaseModel):
    title: str | None = None


class GenerateOutlineRequest(BaseModel):
    instruction: str | None = None


class GenerateChapterRequest(BaseModel):
    number: int | None = None
    instruction: str | None = None
    target_chapter_words: int | None = None
    retrieve_query: str | None = None
    retrieve_limit: int = 5
    overwrite: bool = False


class GenerateAllChaptersRequest(BaseModel):
    instruction: str | None = None
    target_chapter_words: int | None = None
    retrieve_query: str | None = None
    retrieve_limit: int = 5
    overwrite: bool = False
    start_number: int | None = None
    end_number: int | None = None


class CreateSnippetRequest(BaseModel):
    text: str
    title: str | None = None
    tags: list[str] = Field(default_factory=list)
    source: str = "user"
    url: str | None = None
    book_id: str | None = None


class UserRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str


class UserLoginRequest(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict[str, Any]


app = FastAPI(title="fiction-ai", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)


@app.get("/api/status")
def api_status() -> JSONResponse:
    load_dotenv()
    workspace_root = _workspace_root()
    # Note: project_store is currently global/per-workspace. 
    # In a multi-user system, we should filter by user_id.
    project = project_store.ensure_project(workspace_root)
    return _ok(
        {
            "server_time": _now_iso(),
            "llm_configured": bool(has_llm_config()),
            "active_book_id": project.active_book_id,
            "project": {
                "project_id": project.project_id,
                "schema_version": project.schema_version,
                "created_at": project.created_at,
            },
        }
    )


# --- Auth Endpoints ---

@app.post("/api/auth/register")
def api_register(req: UserRegisterRequest) -> JSONResponse:
    email = req.email.lower().strip()
    if user_store.get_user_by_email(email):
        return _err(400, "USER_ALREADY_EXISTS", "User already exists")

    hashed_password = get_password_hash(req.password)
    user = user_store.create_user(email, hashed_password, req.full_name)
    
    # Send verification email
    send_verification_email(user.email, user.verification_token, user.full_name)

    return _ok(
        {
            "message": "User registered successfully. Please check your email to verify your account.",
            "user": {
                "user_id": user.user_id,
                "email": user.email,
                "full_name": user.full_name,
                "is_verified": user.is_verified,
            },
        },
        status_code=201,
    )


@app.post("/api/auth/login")
def api_login(req: UserLoginRequest) -> JSONResponse:
    email = req.email.lower().strip()
    user = user_store.get_user_by_email(email)
    if not user or not verify_password(req.password, user.password_hash):
        return _err(401, "INVALID_CREDENTIALS", "Invalid email or password")

    if not user.is_verified:
        return _err(403, "EMAIL_NOT_VERIFIED", "Please verify your email address before logging in")

    access_token = create_access_token(data={"sub": user.user_id})
    return _ok(
        {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "user_id": user.user_id,
                "email": user.email,
                "full_name": user.full_name,
            },
        }
    )


@app.get("/api/auth/verify-email")
def api_verify_email(token: str) -> JSONResponse:
    user = user_store.get_user_by_verification_token(token)
    if not user:
        return _err(400, "INVALID_TOKEN", "Invalid or expired verification token")

    user_store.verify_user(user.user_id)
    return _ok({"message": "Email verified successfully. You can now log in."})


@app.get("/api/auth/me")
def api_me(user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    user = user_store.get_user_by_id(user_id)
    if not user:
        return _err(404, "USER_NOT_FOUND", "User not found")
    
    return _ok({
        "user_id": user.user_id,
        "email": user.email,
        "full_name": user.full_name,
    })


# --- Book Endpoints ---

@app.get("/api/books")
def api_list_books(user_id: str | None = Depends(get_optional_user_id)) -> JSONResponse:
    workspace_root = _workspace_root()
    project = project_store.ensure_project(workspace_root)
    
    # Filter books:
    # 1. If logged in: show their books + public books
    # 2. If not logged in: only show public books
    user_books = []
    for b in project.books:
        is_public = getattr(b, "is_public", False)
        book_user_id = getattr(b, "user_id", None)
        
        if user_id:
            if book_user_id == user_id or is_public:
                user_books.append(b)
        elif is_public:
            user_books.append(b)
    
    return _ok(
        {
            "active_book_id": project.active_book_id,
            "books": [asdict(b) for b in user_books],
        }
    )


@app.post("/api/books")
def api_create_book(req: CreateBookRequest, user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    premise = (req.premise or "").strip()
    if not premise:
        return _err(400, "VALIDATION_ERROR", "premise is required")

    if req.generate_outline:
        llm_err = _require_llm()
        if llm_err is not None:
            return llm_err

    workspace_root = _workspace_root()
    project = project_store.ensure_project(workspace_root)
    prev_active = project.active_book_id

    title = (req.title or "").strip() or _guess_title_from_premise(premise)
    book_ref = project_store.create_book(workspace_root, project, title=title)
    
    # Store user_id in the book ref for filtering
    book_ref.user_id = user_id
    project_store.save_project(workspace_root, project)

    if not req.set_active:
        project_store.set_active_book(workspace_root, project, prev_active)

    bs = book_store.create_book_state(
        book_id=book_ref.book_id,
        title=book_ref.title,
        slug=book_ref.slug,
        premise=premise,
        genre=(req.genre or "").strip(),
        target_words=req.target_words,
        style_guide=(req.style_guide or "").strip(),
        user_id=user_id,
    )
    book_store.save_book(workspace_root, bs)

    outline_markdown: str | None = None
    if req.generate_outline:
        llm = build_llm()
        outline_markdown = make_outline_markdown(
            llm,
            OutlineRequest(
                title=bs.title,
                premise=bs.premise,
                genre=bs.genre,
                target_words=bs.target_words,
            ),
        )
        book_store.save_outline(workspace_root, bs.book_id, outline_markdown)

    active_book_id = _get_active_book_id(workspace_root)
    return _ok(
        {
            "book": _book_payload(workspace_root, bs.book_id),
            "active_book_id": active_book_id,
            "outline": {"outline_markdown": outline_markdown} if outline_markdown else None,
        },
        status_code=201,
    )


@app.get("/api/books/active")
def api_get_active_book(user_id: str | None = Depends(get_optional_user_id)) -> JSONResponse:
    workspace_root = _workspace_root()
    project = project_store.ensure_project(workspace_root)
    if not project.active_book_id:
        return _ok({"active_book_id": None, "book": None})

    book_id = project.active_book_id
    try:
        book = _book_payload(workspace_root, book_id)
    except FileNotFoundError:
        return _ok({"active_book_id": None, "book": None})

    return _ok({"active_book_id": book_id, "book": book})


@app.put("/api/books/active")
def api_set_active_book(req: SetActiveBookRequest, user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    book_id = (req.book_id or "").strip()
    if not book_id:
        return _err(400, "VALIDATION_ERROR", "book_id is required")

    workspace_root = _workspace_root()
    project = project_store.ensure_project(workspace_root)
    if not any(b.book_id == book_id for b in project.books):
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    project_store.set_active_book(workspace_root, project, book_id)
    return _ok({"active_book_id": book_id, "book": _book_payload(workspace_root, book_id)})


@app.get("/api/books/{book_id}")
def api_get_book(book_id: str, user_id: str | None = Depends(get_optional_user_id)) -> JSONResponse:
    book_id = (book_id or "").strip()
    if not book_id:
        return _err(400, "VALIDATION_ERROR", "book_id is required")

    workspace_root = _workspace_root()
    
    # Check if book exists and if user has access
    project = project_store.ensure_project(workspace_root)
    book_ref = next((b for b in project.books if b.book_id == book_id), None)
    
    if not book_ref:
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    if not book_ref.is_public and book_ref.user_id != user_id:
         return _err(403, "FORBIDDEN", "You do not have access to this book")

    active_book_id = _get_active_book_id(workspace_root)
    return _ok({"active_book_id": active_book_id, "book": _book_payload(workspace_root, book_id)})


class TogglePublicRequest(BaseModel):
    is_public: bool


@app.patch("/api/books/{book_id}/public")
def api_toggle_book_public(book_id: str, req: TogglePublicRequest, user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    workspace_root = _workspace_root()
    project = project_store.ensure_project(workspace_root)
    book_ref = next((b for b in project.books if b.book_id == book_id), None)
    
    if not book_ref:
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    if book_ref.user_id != user_id:
        return _err(403, "FORBIDDEN", "Only the owner can toggle public status")

    book_ref.is_public = req.is_public
    project_store.save_project(workspace_root, project)
    
    # Also update BookState
    bs = book_store.load_book(workspace_root, book_id)
    bs.is_public = req.is_public
    book_store.save_book(workspace_root, bs)
    
    return _ok({"book_id": book_id, "is_public": book_ref.is_public})


@app.patch("/api/books/{book_id}")
def api_update_book(book_id: str, req: UpdateBookRequest, user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    workspace_root = _workspace_root()
    project = project_store.ensure_project(workspace_root)
    book_ref = next((b for b in project.books if b.book_id == book_id), None)
    
    if not book_ref:
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    if book_ref.user_id != user_id:
        return _err(403, "FORBIDDEN", "Only the owner can update this book")

    if req.title is not None:
        project_store.update_book_title(workspace_root, project, book_id, req.title)
        # Also update BookState
        bs = book_store.load_book(workspace_root, book_id)
        bs.title = req.title.strip() or "Untitled"
        bs.updated_at = datetime.now(timezone.utc).isoformat()
        book_store.save_book(workspace_root, bs)
    
    return _ok({"book_id": book_id, "title": req.title})


@app.delete("/api/books/{book_id}")
def api_delete_book(book_id: str, user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    workspace_root = _workspace_root()
    project = project_store.ensure_project(workspace_root)
    book_ref = next((b for b in project.books if b.book_id == book_id), None)
    
    if not book_ref:
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    if book_ref.user_id != user_id:
        return _err(403, "FORBIDDEN", "Only the owner can delete this book")

    # 1. Remove from project_store metadata
    project_store.delete_book(workspace_root, project, book_id)
    # 2. Cleanup all associated data
    book_store.delete_book_all_data(workspace_root, book_id)
    
    return _ok({"book_id": book_id, "message": "Book deleted successfully"})


@app.get("/api/books/{book_id}/outline")
def api_get_outline(book_id: str, user_id: str | None = Depends(get_optional_user_id)) -> JSONResponse:
    workspace_root = _workspace_root()
    
    project = project_store.ensure_project(workspace_root)
    book_ref = next((b for b in project.books if b.book_id == book_id), None)
    
    if not book_ref:
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    if not book_ref.is_public and book_ref.user_id != user_id:
         return _err(403, "FORBIDDEN", "You do not have access to this outline")

    outline = book_store.load_outline(workspace_root, book_id)
    return _ok(
        {
            "book_id": book_id,
            "outline_exists": outline is not None,
            "outline_markdown": outline,
        }
    )


@app.post("/api/books/{book_id}/outline")
def api_generate_outline(book_id: str, req: GenerateOutlineRequest | None = None, user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    llm_err = _require_llm()
    if llm_err is not None:
        return llm_err

    workspace_root = _workspace_root()
    if not _book_exists(workspace_root, book_id):
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    bs = book_store.load_book(workspace_root, book_id)
    instruction = (req.instruction if req else None) or ""

    llm = build_llm()
    outline_markdown = make_outline_markdown(
        llm,
        OutlineRequest(
            title=bs.title,
            premise=(bs.premise + ("\n\n" + instruction if instruction.strip() else "")),
            genre=bs.genre,
            target_words=bs.target_words,
        ),
    )
    book_store.save_outline(workspace_root, book_id, outline_markdown)

    return _ok({"book_id": book_id, "outline_markdown": outline_markdown})


@app.get("/api/books/{book_id}/chapters")
def api_list_chapters(book_id: str, user_id: str | None = Depends(get_optional_user_id)) -> JSONResponse:
    workspace_root = _workspace_root()
    
    project = project_store.ensure_project(workspace_root)
    book_ref = next((b for b in project.books if b.book_id == book_id), None)
    
    if not book_ref:
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    if not book_ref.is_public and book_ref.user_id != user_id:
         return _err(403, "FORBIDDEN", "You do not have access to these chapters")

    chapters = book_store.list_chapters(workspace_root, book_id)
    return _ok({"book_id": book_id, "chapters": chapters})


@app.get("/api/books/{book_id}/chapters/{number}")
def api_get_chapter(book_id: str, number: int, user_id: str | None = Depends(get_optional_user_id)) -> JSONResponse:
    workspace_root = _workspace_root()
    
    project = project_store.ensure_project(workspace_root)
    book_ref = next((b for b in project.books if b.book_id == book_id), None)
    
    if not book_ref:
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    if not book_ref.is_public and book_ref.user_id != user_id:
         return _err(403, "FORBIDDEN", "You do not have access to this chapter")

    content = book_store.load_chapter(workspace_root, book_id, number=int(number))
    if content is None:
        return _err(
            404,
            "CHAPTER_NOT_FOUND",
            "Chapter not found",
            {"book_id": book_id, "number": int(number)},
        )

    title = book_store.chapter_title_from_index(workspace_root, book_id, number=int(number)) or f"第{int(number)}章"
    return _ok(
        {
            "book_id": book_id,
            "number": int(number),
            "title": title,
            "content_markdown": content,
        }
    )


@app.post("/api/books/{book_id}/chapters")
def api_generate_chapter(book_id: str, req: GenerateChapterRequest, user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    llm_err = _require_llm()
    if llm_err is not None:
        return llm_err

    workspace_root = _workspace_root()
    if not _book_exists(workspace_root, book_id):
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    outline = book_store.load_outline(workspace_root, book_id)
    if not outline:
        return _err(409, "OUTLINE_MISSING", "Outline is required before writing chapters.", {"book_id": book_id})

    bs = book_store.load_book(workspace_root, book_id)

    number = int(req.number) if req.number is not None else book_store.next_chapter_number(workspace_root, book_id)

    existing = book_store.load_chapter(workspace_root, book_id, number=number)
    if existing is not None and not req.overwrite:
        return _err(
            409,
            "CHAPTER_ALREADY_EXISTS",
            "Chapter already exists (set overwrite=true to regenerate).",
            {"book_id": book_id, "number": number},
        )

    # snippet retrieval
    retrieve_query = (req.retrieve_query or "").strip() or (req.instruction or "").strip() or bs.title
    hits = snippet_store.search_snippets(
        workspace_root,
        query=retrieve_query,
        book_id=book_id,
        limit=int(req.retrieve_limit),
    )
    retrieved_text = "\n".join([f"- {h.text}" for h in hits])

    llm = build_llm()
    content_markdown = write_chapter_markdown(
        llm,
        ChapterRequest(
            title=bs.title,
            chapter_number=number,
            outline_markdown=outline,
            premise=bs.premise,
            genre=bs.genre,
            target_chapter_words=req.target_chapter_words,
            extra_instruction=(req.instruction or "").strip() or f"写第{number}章",
            retrieved_snippets=retrieved_text,
        ),
    )

    title = f"第{number}章"
    book_store.save_chapter(
        workspace_root,
        book_id,
        number=number,
        title=title,
        content_markdown=content_markdown,
    )

    return _ok(
        {
            "book_id": book_id,
            "chapter": {
                "number": number,
                "title": title,
                "content_markdown": content_markdown,
            },
            "retrieved_snippets": [{"snippet_id": h.snippet_id} for h in hits] if hits else [],
        },
        status_code=201,
    )


@app.post("/api/books/{book_id}/chapters/all")
def api_generate_all_chapters(book_id: str, req: GenerateAllChaptersRequest | None = None, user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    llm_err = _require_llm()
    if llm_err is not None:
        return llm_err

    workspace_root = _workspace_root()
    if not _book_exists(workspace_root, book_id):
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})

    outline = book_store.load_outline(workspace_root, book_id)
    if not outline:
        return _err(409, "OUTLINE_MISSING", "Outline is required before writing chapters.", {"book_id": book_id})

    planned_end = (req.end_number if req else None) or _planned_last_chapter_number(outline)
    if planned_end is None:
        return _err(
            409,
            "OUTLINE_CHAPTERS_NOT_FOUND",
            "Could not infer chapter count from outline; please ensure outline contains '第N章' entries.",
            {"book_id": book_id},
        )

    start_number = int((req.start_number if req else None) or 1)
    end_number = int(planned_end)
    if start_number <= 0 or end_number <= 0 or start_number > end_number:
        return _err(
            400,
            "VALIDATION_ERROR",
            "Invalid chapter range.",
            {"start_number": start_number, "end_number": end_number},
        )

    bs = book_store.load_book(workspace_root, book_id)
    overwrite = bool(req.overwrite) if req else False

    generated_numbers: list[int] = []
    skipped_numbers: list[int] = []

    llm = build_llm()

    for number in range(start_number, end_number + 1):
        existing = book_store.load_chapter(workspace_root, book_id, number=number)
        if existing is not None and not overwrite:
            skipped_numbers.append(int(number))
            continue

        instruction = ((req.instruction if req else None) or "").strip()
        extra_instruction = instruction if instruction else f"写第{number}章"
        if instruction:
            extra_instruction = f"{instruction}\n\n写第{number}章"

        retrieve_query = (
            ((req.retrieve_query if req else None) or "").strip()
            or instruction
            or bs.title
        )
        retrieve_limit = int((req.retrieve_limit if req else None) or 5)

        hits = snippet_store.search_snippets(
            workspace_root,
            query=retrieve_query,
            book_id=book_id,
            limit=retrieve_limit,
        )
        retrieved_text = "\n".join([f"- {h.text}" for h in hits])

        try:
            content_markdown = write_chapter_markdown(
                llm,
                ChapterRequest(
                    title=bs.title,
                    chapter_number=number,
                    outline_markdown=outline,
                    premise=bs.premise,
                    genre=bs.genre,
                    target_chapter_words=(req.target_chapter_words if req else None),
                    extra_instruction=extra_instruction,
                    retrieved_snippets=retrieved_text,
                ),
            )
        except Exception as exc:  # noqa: BLE001
            # Preserve already-generated chapters, but return a non-500 error with context.
            return _err(
                502,
                "LLM_CONNECTION_ERROR",
                "LLM connection error during chapter generation.",
                {
                    "book_id": book_id,
                    "chapter_number": int(number),
                    "generated_numbers": generated_numbers,
                    "skipped_numbers": skipped_numbers,
                    "message": str(exc),
                },
            )

        title = f"第{number}章"
        book_store.save_chapter(
            workspace_root,
            book_id,
            number=number,
            title=title,
            content_markdown=content_markdown,
        )
        generated_numbers.append(int(number))

    return _ok(
        {
            "book_id": book_id,
            "start_number": start_number,
            "end_number": end_number,
            "generated_numbers": generated_numbers,
            "skipped_numbers": skipped_numbers,
        },
        status_code=201,
    )


@app.get(
    "/api/books/{book_id}/chapters/all/stream",
    response_class=StreamingResponse,
    response_model=None,
)
def api_generate_all_chapters_stream(
    book_id: str,
    instruction: str | None = None,
    target_chapter_words: int | None = None,
    retrieve_query: str | None = None,
    retrieve_limit: int = 5,
    overwrite: bool = False,
    start_number: int | None = None,
    end_number: int | None = None,
) -> StreamingResponse:
    """Stream chapter generation via SSE.

    This endpoint is designed for the UI to show incremental progress.
    Event types:
      - meta: run configuration
      - chapter_start: {number, title}
      - chapter_token: {number, delta}
      - chapter_end: {number, saved}
      - done: {generated_numbers, skipped_numbers}
      - error: {code, message, details}
    """

    llm_err = _require_llm()
    if llm_err is not None:
        return llm_err  # type: ignore[return-value]

    workspace_root = _workspace_root()
    if not _book_exists(workspace_root, book_id):
        return _err(404, "BOOK_NOT_FOUND", "Book not found", {"book_id": book_id})  # type: ignore[return-value]

    outline = book_store.load_outline(workspace_root, book_id)
    if not outline:
        return _err(409, "OUTLINE_MISSING", "Outline is required before writing chapters.", {"book_id": book_id})  # type: ignore[return-value]

    planned_end = end_number or _planned_last_chapter_number(outline)
    if planned_end is None:
        return _err(
            409,
            "OUTLINE_CHAPTERS_NOT_FOUND",
            "Could not infer chapter count from outline; please ensure outline contains '第N章' entries.",
            {"book_id": book_id},
        )  # type: ignore[return-value]

    start_n = int(start_number or 1)
    end_n = int(planned_end)
    if start_n <= 0 or end_n <= 0 or start_n > end_n:
        return _err(
            400,
            "VALIDATION_ERROR",
            "Invalid chapter range.",
            {"start_number": start_n, "end_number": end_n},
        )  # type: ignore[return-value]

    bs = book_store.load_book(workspace_root, book_id)
    llm = build_llm()

    def event_stream():
        generated_numbers: list[int] = []
        skipped_numbers: list[int] = []

        yield "retry: 1500\n\n"
        yield _sse(
            "meta",
            {
                "book_id": book_id,
                "start_number": start_n,
                "end_number": end_n,
                "overwrite": bool(overwrite),
            },
        )

        for number in range(start_n, end_n + 1):
            existing = book_store.load_chapter(workspace_root, book_id, number=number)
            if existing is not None and not overwrite:
                skipped_numbers.append(int(number))
                yield _sse("chapter_end", {"number": int(number), "saved": False, "skipped": True})
                continue

            inst = (instruction or "").strip()
            extra_instruction = inst if inst else f"写第{number}章"
            if inst:
                extra_instruction = f"{inst}\n\n写第{number}章"

            rq = (retrieve_query or "").strip() or inst or bs.title
            rl = int(retrieve_limit or 5)

            hits = snippet_store.search_snippets(
                workspace_root,
                query=rq,
                book_id=book_id,
                limit=rl,
            )
            retrieved_text = "\n".join([f"- {h.text}" for h in hits])

            title = f"第{number}章"
            yield _sse("chapter_start", {"number": int(number), "title": title})

            content_parts: list[str] = []
            try:
                for delta in stream_chapter_markdown(
                    llm,
                    ChapterRequest(
                        title=bs.title,
                        chapter_number=number,
                        outline_markdown=outline,
                        premise=bs.premise,
                        genre=bs.genre,
                        target_chapter_words=target_chapter_words,
                        extra_instruction=extra_instruction,
                        retrieved_snippets=retrieved_text,
                    ),
                ):
                    content_parts.append(delta)
                    yield _sse("chapter_token", {"number": int(number), "delta": delta})

                content_markdown = "".join(content_parts).strip()
                book_store.save_chapter(
                    workspace_root,
                    book_id,
                    number=number,
                    title=title,
                    content_markdown=content_markdown,
                )
                generated_numbers.append(int(number))
                yield _sse("chapter_end", {"number": int(number), "saved": True})
            except Exception as exc:  # noqa: BLE001
                yield _sse(
                    "error",
                    {
                        "code": "LLM_CONNECTION_ERROR",
                        "message": "LLM connection error during chapter generation.",
                        "details": {
                            "book_id": book_id,
                            "chapter_number": int(number),
                            "generated_numbers": generated_numbers,
                            "skipped_numbers": skipped_numbers,
                            "message": str(exc),
                        },
                    },
                )
                return

        yield _sse(
            "done",
            {"generated_numbers": generated_numbers, "skipped_numbers": skipped_numbers},
        )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@app.post("/api/snippets")
def api_create_snippet(req: CreateSnippetRequest, user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    text = (req.text or "").strip()
    if not text:
        return _err(400, "VALIDATION_ERROR", "text is required")

    workspace_root = _workspace_root()
    project = project_store.ensure_project(workspace_root)

    book_id = req.book_id if req.book_id is not None else project.active_book_id
    if req.book_id is None and project.active_book_id is None:
        return _err(409, "NO_ACTIVE_BOOK", "No active book; provide book_id explicitly.")

    sn = snippet_store.add_snippet(
        workspace_root,
        text=text,
        book_id=book_id,
        title=req.title,
        tags=req.tags,
        source=req.source,
        url=req.url,
    )

    return _ok({"snippet": asdict(sn)}, status_code=201)


@app.get("/api/snippets/search")
def api_search_snippets(q: str, book_id: str | None = None, limit: int = 5, user_id: str = Depends(get_current_user_id)) -> JSONResponse:
    q = (q or "").strip()
    if not q:
        return _err(400, "VALIDATION_ERROR", "q is required")

    workspace_root = _workspace_root()
    project = project_store.ensure_project(workspace_root)

    if book_id is not None and not str(book_id).strip():
        book_id = None

    effective_book_id = book_id if book_id is not None else project.active_book_id
    if book_id is None and project.active_book_id is None:
        return _err(409, "NO_ACTIVE_BOOK", "No active book; provide book_id explicitly.")

    hits = snippet_store.search_snippets(
        workspace_root,
        query=q,
        book_id=effective_book_id,
        limit=int(limit),
    )

    return _ok(
        {
            "q": q,
            "book_id": effective_book_id,
            "limit": int(limit),
            "snippets": [asdict(h) for h in hits],
        }
    )
