from __future__ import annotations

from dataclasses import dataclass

from langchain_core.messages import HumanMessage, SystemMessage


@dataclass
class OutlineRequest:
    title: str
    premise: str
    genre: str
    target_words: int | None


def make_outline_markdown(llm, req: OutlineRequest) -> str:
    sys = SystemMessage(
        content=(
            "你是一个职业小说策划编辑。你的任务是给小说做可执行的大纲。\n"
            "要求：\n"
            "- 输出为 Markdown\n"
            "- 包含：一句话梗概、主要人物(3-6)、核心冲突、三幕结构、章节列表(8-14章，每章一句要点)\n"
            "- 避免空话，尽量具体，可直接拿来写正文\n"
        )
    )

    user_prompt = (
        f"书名：{req.title or '（未定）'}\n"
        f"题材/关键词：{req.genre or '（未指定）'}\n"
        f"目标总字数：{req.target_words or '（未指定）'}\n"
        f"创作需求：{req.premise}\n"
    )

    resp = llm.invoke([sys, HumanMessage(content=user_prompt)])
    text = getattr(resp, "content", "")
    return str(text).strip()


def stream_outline_markdown(llm, req: OutlineRequest):
    sys = SystemMessage(
        content=(
            "你是一个职业小说策划编辑。你的任务是给小说做可执行的大纲。\n"
            "要求：\n"
            "- 输出为 Markdown\n"
            "- 包含：一句话梗概、主要人物(3-6)、核心冲突、三幕结构、章节列表(8-14章，每章一句要点)\n"
            "- 避免空话，尽量具体，可直接拿来写正文\n"
        )
    )

    user_prompt = (
        f"书名：{req.title or '（未定）'}\n"
        f"题材/关键词：{req.genre or '（未指定）'}\n"
        f"目标总字数：{req.target_words or '（未指定）'}\n"
        f"创作需求：{req.premise}\n"
    )

    for chunk in llm.stream([sys, HumanMessage(content=user_prompt)]):
        text = getattr(chunk, "content", "")
        if text:
            yield text

