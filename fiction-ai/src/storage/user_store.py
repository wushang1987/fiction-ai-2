from __future__ import annotations

import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any
from .mongodb import get_collection

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

@dataclass
class User:
    user_id: str
    email: str
    password_hash: str
    full_name: str
    is_verified: bool = False
    verification_token: str | None = None
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self):
        d = asdict(self)
        # Don't return password hash in dict if used for API responses
        # but for storage we need it.
        return d

def create_user(email: str, password_hash: str, full_name: str) -> User:
    col = get_collection("users")
    user = User(
        user_id=str(uuid.uuid4()),
        email=email.lower().strip(),
        password_hash=password_hash,
        full_name=full_name,
        is_verified=False,
        verification_token=str(uuid.uuid4()),
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    col.insert_one(user.to_dict())
    return user

def get_user_by_email(email: str) -> User | None:
    col = get_collection("users")
    doc = col.find_one({"email": email.lower().strip()})
    if not doc:
        return None
    # Remove _id if it exists
    doc.pop("_id", None)
    return User(**doc)

def get_user_by_id(user_id: str) -> User | None:
    col = get_collection("users")
    doc = col.find_one({"user_id": user_id})
    if not doc:
        return None
    doc.pop("_id", None)
    return User(**doc)

def get_user_by_verification_token(token: str) -> User | None:
    col = get_collection("users")
    doc = col.find_one({"verification_token": token})
    if not doc:
        return None
    doc.pop("_id", None)
    return User(**doc)

def update_user(user: User) -> None:
    col = get_collection("users")
    user.updated_at = _now_iso()
    payload = user.to_dict()
    col.replace_one({"user_id": user.user_id}, payload)

def verify_user(user_id: str) -> bool:
    col = get_collection("users")
    res = col.update_one(
        {"user_id": user_id},
        {"$set": {"is_verified": True, "verification_token": None, "updated_at": _now_iso()}}
    )
    return res.modified_count > 0
