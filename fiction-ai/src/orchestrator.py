from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

try:
    from .interaction.intent import Intent, parse_intent
    from .llm.client import build_llm, has_llm_config
    from .storage import book_store, project_store, snippet_store
except ImportError:  # pragma: no cover
    from interaction.intent import Intent, parse_intent
    from llm.client import build_llm, has_llm_config
    from storage import book_store, project_store, snippet_store


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class TurnResult:
    text: str


class Orchestrator:
    def __init__(self, workspace_root: Path) -> None:
        self.workspace_root = workspace_root

    def handle_turn(self, user_sentence: str) -> TurnResult:
        load_dotenv()
        project = project_store.ensure_project(self.workspace_root)

        intent = parse_intent(user_sentence)

        # book reference auto-detect: if sentence mentions 《title》, switch if unique
        title_ref = _extract_title_ref(user_sentence)
        if title_ref:
            hits = project_store.find_books(project, title_ref)
            if len(hits) == 1:
                project_store.set_active_book(self.workspace_root, project, hits[0].book_id)
                project.active_book_id = hits[0].book_id

        if intent.kind == "list_books":
            return TurnResult(text=project_store.list_books_text(project))

        if intent.kind == "switch_book":
            title = str(intent.args.get("title") or "").strip()
            hits = project_store.find_books(project, title)
            if not hits:
                return TurnResult(text=f"没有找到名为《{title}》的小说。你可以先创建一本，或说‘我有哪些小说’。")
            if len(hits) > 1:
                candidates = "\n".join([f"- {b.title} (id={b.book_id[:8]})" for b in hits])
                return TurnResult(text=f"我找到了多本可能的小说，请你再说清楚要继续哪一本：\n{candidates}")

            project_store.set_active_book(self.workspace_root, project, hits[0].book_id)
            return TurnResult(text=f"已切换到《{hits[0].title}》。你想先生成大纲，还是直接写下一章？")

        # Snippets
        if intent.kind == "save_snippet":
            if not project.active_book_id:
                return TurnResult(text="你还没有激活任何小说。你可以先说：‘写一个3000字的校园爱情小说’。")
            text = str(intent.args.get("text") or "").strip()
            if not text:
                return TurnResult(text="要保存的片段内容为空。你可以说：‘保存参考：……’")

            sn = snippet_store.add_snippet(
                self.workspace_root,
                text=text,
                book_id=project.active_book_id,
            )
            return TurnResult(text=f"已保存参考片段（id={sn.snippet_id[:8]}）。")

        if intent.kind == "search_snippets":
            if not project.active_book_id:
                return TurnResult(text="你还没有激活任何小说。你可以先说：‘写一个3000字的校园爱情小说’。")
            query = str(intent.args.get("query") or "").strip()
            if not query:
                return TurnResult(text="搜索关键词为空。你可以说：‘搜索参考片段：雨后的味道’。")

            hits = snippet_store.search_snippets(
                self.workspace_root, query=query, book_id=project.active_book_id, limit=5
            )
            if not hits:
                return TurnResult(text="没有搜到相关参考片段。")

            lines = ["我找到这些参考片段："]
            for h in hits:
                excerpt = _shorten(h.text, 120)
                lines.append(f"- {excerpt} (id={h.snippet_id[:8]})")
            return TurnResult(text="\n".join(lines))

        # Writing intents require an active book; may create one from prompt.
        if intent.kind == "start_book_from_prompt":
            prompt = str(intent.args.get("prompt") or "").strip()
            genre = str(intent.args.get("genre") or "").strip()
            target_min = intent.args.get("target_min_words")
            target_max = intent.args.get("target_max_words")
            target_words = None
            if isinstance(target_min, int) and isinstance(target_max, int):
                target_words = int((target_min + target_max) / 2)

            # Create a new book and make it active.
            title_guess = _guess_title_from_prompt(prompt)
            book_ref = project_store.create_book(self.workspace_root, project, title=title_guess)

            # persist book state
            bs = book_store.create_book_state(
                book_id=book_ref.book_id,
                title=book_ref.title,
                slug=book_ref.slug,
                premise=prompt,
                genre=genre,
                target_words=target_words,
            )
            book_store.save_book(self.workspace_root, bs)

            if not has_llm_config():
                return TurnResult(
                    text=(
                        f"已创建新小说《{book_ref.title}》，并设为当前小说。\n"
                        "但当前未配置 OPENAI_API_KEY，无法生成大纲/正文。\n"
                        "请在 .env 设置 OPENAI_API_KEY 后再试一次（比如：‘给这本书生成大纲’）。"
                    )
                )

            llm = build_llm()
            from .writing.planner import OutlineRequest, make_outline_markdown

            outline_md = make_outline_markdown(
                llm,
                OutlineRequest(
                    title=bs.title,
                    premise=bs.premise,
                    genre=bs.genre,
                    target_words=bs.target_words,
                ),
            )
            book_store.save_outline(self.workspace_root, bs.book_id, outline_md)

            book_store.append_chat_log(
                self.workspace_root,
                bs.book_id,
                {
                    "ts": _now_iso(),
                    "user": prompt,
                    "intent": intent.kind,
                    "saved": ["outline.md"],
                },
            )

            return TurnResult(
                text=(
                    f"已创建新小说《{bs.title}》，并生成大纲（已保存）。\n\n{outline_md}\n\n"
                    "你可以接着说：‘写下一章’ 或 ‘写第1章，重点写男女主第一次正面冲突’。"
                )
            )

        if intent.kind == "make_outline":
            if not project.active_book_id:
                return TurnResult(text="你还没有激活任何小说。你可以先说：‘写一个3000字的校园爱情小说’。")
            if not has_llm_config():
                return TurnResult(text="当前未配置 OPENAI_API_KEY，无法生成大纲。")

            bs = book_store.load_book(self.workspace_root, project.active_book_id)
            llm = build_llm()
            from .writing.planner import OutlineRequest, make_outline_markdown

            outline_md = make_outline_markdown(
                llm,
                OutlineRequest(
                    title=bs.title,
                    premise=bs.premise,
                    genre=bs.genre,
                    target_words=bs.target_words,
                ),
            )
            book_store.save_outline(self.workspace_root, bs.book_id, outline_md)
            book_store.append_chat_log(
                self.workspace_root,
                bs.book_id,
                {"ts": _now_iso(), "user": user_sentence, "intent": intent.kind, "saved": ["outline.md"]},
            )
            return TurnResult(text=f"已生成/更新大纲（已保存）。\n\n{outline_md}")

        if intent.kind in {"write_chapter", "write_next_chapter"}:
            if not project.active_book_id:
                return TurnResult(text="你还没有激活任何小说。你可以先说：‘写一个3000字的校园爱情小说’。")
            if not has_llm_config():
                return TurnResult(text="当前未配置 OPENAI_API_KEY，无法生成正文。")

            bs = book_store.load_book(self.workspace_root, project.active_book_id)
            outline_md = book_store.load_outline(self.workspace_root, bs.book_id)
            if not outline_md:
                return TurnResult(text="这本书还没有大纲。你可以先说：‘给这本书生成大纲’。")

            if intent.kind == "write_chapter":
                number = int(intent.args.get("number") or 1)
            else:
                number = book_store.next_chapter_number(self.workspace_root, bs.book_id)

            # retrieve snippets (keyword)
            hits = snippet_store.search_snippets(
                self.workspace_root, query=_guess_retrieval_query(user_sentence), book_id=bs.book_id, limit=5
            )
            retrieved_text = "\n".join([f"- {h.text}" for h in hits])

            llm = build_llm()
            from .writing.writer import ChapterRequest, write_chapter_markdown

            chapter_md = write_chapter_markdown(
                llm,
                ChapterRequest(
                    title=bs.title,
                    chapter_number=number,
                    outline_markdown=outline_md,
                    premise=bs.premise,
                    genre=bs.genre,
                    target_chapter_words=None,
                    extra_instruction=str(intent.args.get("request") or user_sentence),
                    retrieved_snippets=retrieved_text,
                ),
            )

            chapter_title = f"第{number}章"
            book_store.save_chapter(
                self.workspace_root,
                bs.book_id,
                number=number,
                title=chapter_title,
                content_markdown=chapter_md,
            )

            book_store.append_chat_log(
                self.workspace_root,
                bs.book_id,
                {
                    "ts": _now_iso(),
                    "user": user_sentence,
                    "intent": intent.kind,
                    "saved": [f"chapters/{number:04d}.md"],
                    "retrieved_snippet_ids": [h.snippet_id for h in hits],
                },
            )

            return TurnResult(text=chapter_md)

        if intent.kind == "chat":
            # minimal friendly guidance, no LLM needed
            if not project.active_book_id:
                return TurnResult(text="你可以先说：‘写一个3000字的校园爱情小说’。")
            return TurnResult(text="我可以帮你生成大纲、写章节、保存/检索参考片段。你想现在做哪一个？")

        return TurnResult(text="我没理解你的意思。你可以说：‘写一个3000字的校园爱情小说’ 或 ‘保存参考：……’。")


def _extract_title_ref(text: str) -> str | None:
    m = re.search(r"《([^》]{1,80})》", text)
    if m:
        return m.group(1).strip() or None
    return None


def _shorten(text: str, max_len: int) -> str:
    t = " ".join(text.split())
    return t if len(t) <= max_len else t[: max_len - 1] + "…"


def _guess_title_from_prompt(prompt: str) -> str:
    # Very simple: try to find a genre-ish token; otherwise fallback.
    for g in ["校园", "爱情", "悬疑", "科幻", "奇幻", "武侠", "历史", "都市", "推理", "治愈"]:
        if g in prompt:
            return f"{g}小说"
    return "未命名小说"


def _guess_retrieval_query(user_sentence: str) -> str:
    # Extract a handful of keywords for snippet search; keep it simple.
    text = re.sub(r"[，。！？,.!?:：]", " ", user_sentence)
    parts = [p.strip() for p in text.split() if len(p.strip()) >= 2]
    return " ".join(parts[:6]) or user_sentence
