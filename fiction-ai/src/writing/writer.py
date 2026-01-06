from __future__ import annotations

from dataclasses import dataclass
import json
import random
import time
from typing import Iterable, Iterator

from langchain_core.messages import HumanMessage, SystemMessage


def _is_transient_llm_error(exc: Exception) -> bool:
    try:
        import httpx  # type: ignore

        if isinstance(exc, httpx.HTTPError):
            return True
    except Exception:
        pass

    try:
        import openai  # type: ignore

        if isinstance(exc, getattr(openai, "APIConnectionError", ())):
            return True
        if isinstance(exc, getattr(openai, "APITimeoutError", ())):
            return True
        if isinstance(exc, getattr(openai, "RateLimitError", ())):
            return True
    except Exception:
        pass

    msg = str(exc).lower()
    return any(
        s in msg
        for s in [
            "connection error",
            "incomplete chunked read",
            "peer closed connection",
            "timeout",
            "temporarily unavailable",
        ]
    )


def _retry_delay_seconds(attempt_index: int) -> float:
    base = 0.8
    jitter = random.uniform(0.0, 0.25)
    return min(8.0, base * (2**attempt_index) + jitter)


def _build_messages(req: "ChapterRequest") -> list:
    sys = SystemMessage(
        content=(
            "你是一个小说写作助手。你将根据大纲与参考素材写出章节正文。\n"
            "要求：\n"
            "- 输出 Markdown\n"
            "- 只输出本章正文，不要解释过程\n"
            "- 语言自然、画面感强、对话推动情节\n"
            "- 避免重复上一章内容（如果不知道上一章，就直接从本章目标写起）\n"
        )
    )

    user_prompt = (
        f"书名：{req.title}\n"
        f"题材/关键词：{req.genre or '（未指定）'}\n"
        f"章节：第{req.chapter_number}章\n"
        f"本章目标字数：{req.target_chapter_words or '（未指定）'}\n\n"
        "【全书大纲】\n"
        f"{req.outline_markdown}\n\n"
        "【参考片段（可选）】\n"
        f"{req.retrieved_snippets or '（无）'}\n\n"
        "【用户追加要求】\n"
        f"{req.extra_instruction or '（无）'}\n"
    )

    return [sys, HumanMessage(content=user_prompt)]


@dataclass
class ChapterRequest:
    title: str
    chapter_number: int
    outline_markdown: str
    premise: str
    genre: str
    target_chapter_words: int | None
    extra_instruction: str
    retrieved_snippets: str


def write_chapter_markdown(llm, req: ChapterRequest) -> str:
    messages = _build_messages(req)
    last_exc: Exception | None = None

    for attempt in range(3):
        try:
            resp = llm.invoke(messages)
            text = getattr(resp, "content", "")
            return str(text).strip()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if not _is_transient_llm_error(exc) or attempt >= 2:
                raise
            time.sleep(_retry_delay_seconds(attempt))

    raise last_exc or RuntimeError("LLM call failed")


def stream_chapter_markdown(llm, req: ChapterRequest) -> Iterator[str]:
    """Stream chapter markdown as incremental text chunks.

    Best-effort retry: only retries if the stream fails before any chunk is received.
    """

    messages = _build_messages(req)
    last_exc: Exception | None = None

    for attempt in range(3):
        saw_any = False
        try:
            for chunk in llm.stream(messages):
                saw_any = True
                delta = getattr(chunk, "content", "")
                if delta:
                    yield str(delta)
            return
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if saw_any:
                raise
            if not _is_transient_llm_error(exc) or attempt >= 2:
                raise
            time.sleep(_retry_delay_seconds(attempt))

    raise last_exc or RuntimeError("LLM stream failed")
