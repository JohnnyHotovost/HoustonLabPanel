import json
import secrets
from datetime import datetime, timezone
from pathlib import Path

from argon2 import PasswordHasher
from sqlalchemy import select

from database import SessionLocal
from models import User


OUT_PATH = Path("/app/.data/design-reference/test-users.json")
PREFIX = "TEST_VISUAL_"
hasher = PasswordHasher()


def strong_password() -> str:
    return f"Tv!{secrets.token_urlsafe(12)}A9"


def unique_email(suffix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"test_visual_{suffix}_{stamp}@example.com"


def ensure_user(db, *, role: str, name: str, email: str, password: str):
    existing = db.scalar(select(User).where(User.email == email.lower()))
    if existing:
        raise RuntimeError("Refusing to overwrite an existing user during visual QA")

    user = User(
        email=email.lower(),
        name=name,
        password_hash=hasher.hash(password),
        role=role,
        active=True,
        language="en",
        preferences={},
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.id


def main():
    member_password = strong_password()
    viewer_password = strong_password()
    member_email = unique_email("member")
    viewer_email = unique_email("viewer")

    with SessionLocal() as db:
        member_id = ensure_user(
            db,
            role="MEMBER",
            name=f"{PREFIX}Member",
            email=member_email,
            password=member_password,
        )
        viewer_id = ensure_user(
            db,
            role="VIEWER",
            name=f"{PREFIX}Viewer",
            email=viewer_email,
            password=viewer_password,
        )

    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "member": {
            "id": member_id,
            "name": f"{PREFIX}Member",
            "email": member_email,
            "password": member_password,
        },
        "viewer": {
            "id": viewer_id,
            "name": f"{PREFIX}Viewer",
            "email": viewer_email,
            "password": viewer_password,
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("Created two temporary visual-QA users; credentials stored in the ignored private artifact.")


if __name__ == "__main__":
    main()
