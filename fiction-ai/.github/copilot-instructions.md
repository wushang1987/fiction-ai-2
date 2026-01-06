# Copilot instructions (fiction-ai)

## Big picture
- Python 3.11 app with **two entrypoints**:
  - CLI: `src/app.py` → `Orchestrator.handle_turn()` in `src/orchestrator.py`
  - HTTP API: `src/http_api.py` (FastAPI) for the React UI (sibling folder `../fiction-ai-ui`)
- LLM calls are only used for **outline** + **chapter** generation (`src/writing/planner.py`, `src/writing/writer.py`). Everything else (book switching, snippet save/search) is local.

## Storage model (local, file-based)
- All persistent data lives under `.fiction_ai/` (see `src/storage/paths.py`).
- Project index: `.fiction_ai/project.json` (managed by `src/storage/project_store.py`).
- Book state per book id:
  - `.fiction_ai/books/<book_id>/book.json`
  - `.fiction_ai/books/<book_id>/outline.md`
  - `.fiction_ai/books/<book_id>/chapters/0001.md` + `.fiction_ai/books/<book_id>/chapters/index.json`
  - `.fiction_ai/books/<book_id>/sessions/chat.jsonl` (append-only)
- Snippets: `.fiction_ai/snippets/snippets.db` (+ `snippets.jsonl`) via `src/storage/snippet_store.py`.
  - Search uses SQLite; prefers `LIKE` for CJK substring queries and tries FTS5 when available.

## HTTP API contract (keep stable)
- Responses are always wrapped:
  - Success: `{ "ok": true, "data": ... }`
  - Error: `{ "ok": false, "error": { "code", "message", "details"? } }`
  - Helpers live in `src/http_api.py`: `_ok()` / `_err()`
- The UI client (`../fiction-ai-ui/src/api/client.ts`) assumes this envelope; if you add/modify endpoints, update UI types and `fictionApi` accordingly.
- Backend server chooses a **stable workspace root** (`_workspace_root()` resolves repo root) so storage doesn’t depend on the current working directory.

## Intent parsing (CLI)
- CLI interprets Chinese natural-language commands using simple heuristics in `src/interaction/intent.py` (regex + keyword matching).
- `src/orchestrator.py` is the “brain”: routes intents, manages active book, calls writing/snippet/storage modules.

## Developer workflows (Windows-friendly)
- Backend setup/run (repo folder `fiction-ai/`):
  - `uv sync`
  - CLI: `uv run python src/app.py`
  - API: `uv run uvicorn src.http_api:app --host 127.0.0.1 --port 8000`
- Frontend (sibling folder `fiction-ai-ui/`):
  - `npm install`
  - `npm run dev` (Vite at `http://localhost:5173`, proxies `/api` → `http://127.0.0.1:8000` via `vite.config.ts`)

## LLM configuration
- Uses LangChain `ChatOpenAI` with an OpenAI-compatible endpoint (see `src/llm/client.py`).
- Env vars (loaded via `python-dotenv`):
  - `OPENAI_API_KEY` (required for generation)
  - `OPENAI_BASE_URL` (default `https://api.deepseek.com/v1`)
  - `APP_MODEL` (default `deepseek-chat`)

## Conventions to follow when editing
- Prefer adding behavior in the existing layers:
  - API behavior in `src/http_api.py` → storage in `src/storage/*` → generation prompts in `src/writing/*`.
- Keep both run modes working where present (some files use `try/except ImportError` to support `python -m` vs direct script runs).
