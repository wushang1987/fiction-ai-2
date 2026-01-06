from __future__ import annotations

import os

from langchain_openai import ChatOpenAI


def has_llm_config() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def build_llm() -> ChatOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Missing OPENAI_API_KEY. Create a .env file (see README.md) and set OPENAI_API_KEY."
        )

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.deepseek.com/v1")
    model = os.getenv("APP_MODEL", "deepseek-chat")

    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url,
        temperature=0.7,
    )
