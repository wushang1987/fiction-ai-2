from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

try:
    # When running as module: `python -m src.app`
    from .llm.client import has_llm_config
    from .orchestrator import Orchestrator
except ImportError:  # pragma: no cover
    # When running as script: `python src/app.py`
    from llm.client import has_llm_config
    from orchestrator import Orchestrator


def main() -> None:
    load_dotenv()

    orchestrator = Orchestrator(workspace_root=Path.cwd())

    llm_status = "已配置" if has_llm_config() else "未配置"
    print("Fiction AI (CLI). Type 'exit' to quit.")
    print(f"LLM: {llm_status} | 数据目录: .fiction_ai/")
    if not has_llm_config():
        print("提示：未设置 OPENAI_API_KEY 时，仍可保存/检索参考片段，但无法生成大纲/正文。")
    while True:
        user_input = input("> ").strip()
        if not user_input:
            continue
        if user_input.lower() in {"exit", "quit"}:
            break

        result = orchestrator.handle_turn(user_input)
        print(result.text)


if __name__ == "__main__":
    main()
