# Fiction AI (Python, uv)

## Setup

- Create a `.env` file (copy from `.env.example`) and fill in your key + model.
- Install deps with `uv`.

```powershell
uv sync
```

## Run

```powershell
uv run python src/app.py
```

```powershell
# 推荐：不依赖当前工作目录，保证能找到模块
uv run uvicorn http_api:app --app-dir src --host 127.0.0.1 --port 8000

# 也可以：在项目根目录运行
# uv run uvicorn src.http_api:app --host 127.0.0.1 --port 8000
```

Type `exit` to quit.

## Usage (one natural-language sentence each turn)

This tool persists everything under `.fiction_ai/` (single project, multiple books).

Examples you can type in the CLI:

- Create a new book from a prompt:
  - `写一个3000字的校园爱情小说`
- Generate/update outline for the current active book:
  - `给这本书生成大纲`
- Write chapters:
  - `写下一章`
  - `写第2章，重点写男女主的误会加深`
- Save reference snippets (stored & searchable later):
  - `保存参考：雨后的空气有淡淡的铁锈味`
- Search snippets (keyword search, no embeddings):
  - `搜索参考片段：铁锈味`
- Manage multiple books in one project:
  - `我有哪些小说`
  - `继续《校园小说》`

## Environment variables

- `OPENAI_API_KEY`: your DeepSeek API key
- `OPENAI_BASE_URL`: `https://api.deepseek.com/v1`
- `APP_MODEL`: model name (e.g. `deepseek-chat`)

If `OPENAI_API_KEY` is missing, the CLI can still save/search snippets, but cannot generate outlines/chapters.
