from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Intent:
    kind: str
    args: dict[str, object]


_WORDS_RE = re.compile(r"(?P<n>\d{2,7})\s*字")
_RANGE_RE = re.compile(r"(?P<min>\d{2,7})\s*[-~到]\s*(?P<max>\d{2,7})\s*字")
_CHAPTER_RE = re.compile(r"第\s*(?P<n>\d{1,4})\s*章")
_TITLE_BRACKETS_RE = re.compile(r"《(?P<title>[^》]{1,80})》")


def parse_intent(user_sentence: str) -> Intent:
    text = user_sentence.strip()

    if not text:
        return Intent(kind="noop", args={})

    if any(k in text for k in ["我有哪些", "有哪些小说", "列出", "显示所有", "我的书"]):
        return Intent(kind="list_books", args={})

    if any(k in text for k in ["保存", "记住", "收录"]):
        if any(k in text for k in ["参考", "片段", "笔记", "资料", "素材", "设定", "灵感"]):
            snippet_text = _extract_after_colon(text) or text
            return Intent(kind="save_snippet", args={"text": snippet_text})

    if any(k in text for k in ["搜索", "查找", "检索", "找找"]):
        if any(k in text for k in ["片段", "笔记", "资料", "参考", "素材", "设定"]):
            query = _extract_query(text)
            return Intent(kind="search_snippets", args={"query": query})

    if any(k in text for k in ["切换", "换到", "继续"]):
        title = _extract_book_title(text)
        if title:
            return Intent(kind="switch_book", args={"title": title})

    if any(k in text for k in ["新建", "创建", "开一本", "写一本新的", "开始一本新的"]):
        title = _extract_book_title(text)
        if title:
            return Intent(kind="create_book", args={"title": title, "premise": text})
        return Intent(kind="create_book", args={"title": "", "premise": text})

    if any(k in text for k in ["大纲", "提纲", "梗概", "故事线"]):
        return Intent(kind="make_outline", args={"request": text})

    m_ch = _CHAPTER_RE.search(text)
    if m_ch:
        return Intent(kind="write_chapter", args={"number": int(m_ch.group("n")), "request": text})

    if any(k in text for k in ["下一章", "继续写", "接着写", "写下去", "下一节", "下一段"]):
        return Intent(kind="write_next_chapter", args={"request": text})

    if any(k in text for k in ["写", "创作", "写一个", "写一篇", "写一部"]):
        target_min, target_max = _extract_word_range(text)
        genre = _extract_genre_hint(text)
        return Intent(
            kind="start_book_from_prompt",
            args={
                "prompt": text,
                "target_min_words": target_min,
                "target_max_words": target_max,
                "genre": genre,
            },
        )

    return Intent(kind="chat", args={"text": text})


def _extract_after_colon(text: str) -> str | None:
    for sep in [":", "："]:
        if sep in text:
            return text.split(sep, 1)[1].strip() or None
    return None


def _extract_word_range(text: str) -> tuple[int | None, int | None]:
    m_range = _RANGE_RE.search(text)
    if m_range:
        return int(m_range.group("min")), int(m_range.group("max"))
    m = _WORDS_RE.search(text)
    if m:
        n = int(m.group("n"))
        # treat exact as a loose range +/- 10%
        return int(n * 0.9), int(n * 1.1)
    return None, None


def _extract_book_title(text: str) -> str | None:
    m = _TITLE_BRACKETS_RE.search(text)
    if m:
        return m.group("title").strip() or None

    # Try patterns like “叫XXX” “名为XXX” “标题是XXX”
    for pat in [r"叫\s*(?P<t>[^，。！？,.!?:：]{1,50})", r"名为\s*(?P<t>[^，。！？,.!?:：]{1,50})", r"标题是\s*(?P<t>[^，。！？,.!?:：]{1,50})"]:
        mm = re.search(pat, text)
        if mm:
            return mm.group("t").strip() or None

    return None


def _extract_query(text: str) -> str:
    for k in ["搜索", "查找", "检索", "找找"]:
        if k in text:
            q = text.split(k, 1)[1].strip()
            # If the user uses a colon, take the part after it.
            for sep in [":", "："]:
                if sep in q:
                    q = q.split(sep, 1)[1].strip()
                    break

            # Remove common prefixes like “参考片段/资料/笔记/...”.
            q = re.sub(
                r"^(一下|一下子|关于|有关|参考片段|片段|参考|资料|笔记|素材|设定)\s*", "", q
            ).strip()
            q = q.lstrip(":：-— ").strip()

            # If still empty, fall back to original text.
            return q or text
    return text


def _extract_genre_hint(text: str) -> str:
    for g in ["校园", "爱情", "悬疑", "科幻", "奇幻", "武侠", "历史", "都市", "推理", "恐怖", "治愈"]:
        if g in text:
            return g
    return ""
