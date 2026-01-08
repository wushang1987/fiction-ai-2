import json
import os
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB = os.getenv("MONGO_DB", "fiction_ai")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]

workspace_root = Path(".")
fiction_ai_dir = workspace_root / ".fiction_ai"

def migrate_project():
    project_file = fiction_ai_dir / "project.json"
    if project_file.exists():
        print("Migrating project.json...")
        data = json.loads(project_file.read_text(encoding="utf-8"))
        db.project.replace_one({"project_id": data["project_id"]}, data, upsert=True)

def migrate_books():
    books_dir = fiction_ai_dir / "books"
    if books_dir.exists():
        for book_id_dir in books_dir.iterdir():
            if not book_id_dir.is_dir():
                continue
            
            book_id = book_id_dir.name
            print(f"Migrating book {book_id}...")
            
            # book.json
            book_file = book_id_dir / "book.json"
            if book_file.exists():
                data = json.loads(book_file.read_text(encoding="utf-8"))
                db.books.replace_one({"book_id": book_id}, data, upsert=True)
            
            # outline.md
            outline_file = book_id_dir / "outline.md"
            if outline_file.exists():
                db.outlines.replace_one(
                    {"book_id": book_id},
                    {"book_id": book_id, "outline_markdown": outline_file.read_text(encoding="utf-8")},
                    upsert=True
                )
            
            # chapters
            chapters_dir = book_id_dir / "chapters"
            if chapters_dir.exists():
                index_file = chapters_dir / "index.json"
                if index_file.exists():
                    index_data = json.loads(index_file.read_text(encoding="utf-8"))
                    for chapter_meta in index_data:
                        num = chapter_meta["number"]
                        chapter_file = chapters_dir / f"{num:04d}.md"
                        if chapter_file.exists():
                            content = chapter_file.read_text(encoding="utf-8")
                            db.chapters.replace_one(
                                {"book_id": book_id, "number": num},
                                {
                                    "book_id": book_id,
                                    "number": num,
                                    "title": chapter_meta["title"],
                                    "content_markdown": content,
                                    "updated_at": chapter_meta.get("updated_at")
                                },
                                upsert=True
                            )
            
            # chat logs
            chat_log_file = book_id_dir / "sessions" / "chat.jsonl"
            if chat_log_file.exists():
                with chat_log_file.open("r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            record = json.loads(line)
                            record["book_id"] = book_id
                            db.chat_logs.insert_one(record)

def migrate_snippets():
    snippets_jsonl = fiction_ai_dir / "snippets" / "snippets.jsonl"
    if snippets_jsonl.exists():
        print("Migrating snippets.jsonl...")
        with snippets_jsonl.open("r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    record = json.loads(line)
                    db.snippets.replace_one({"snippet_id": record["snippet_id"]}, record, upsert=True)

if __name__ == "__main__":
    migrate_project()
    migrate_books()
    migrate_snippets()
    print("Migration complete!")
