"""Password hashing (bcrypt) and JWT helpers (DS-AUTH-01)."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt


def hash_password(password: str, rounds: int) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=rounds)).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


def create_token(user_id: int, username: str, is_admin: bool, secret: str, expire_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "username": username, "adm": bool(is_admin),
               "iat": now, "exp": now + timedelta(minutes=expire_minutes)}
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_token(token: str, secret: str) -> dict:
    """Raises jwt.PyJWTError on any problem (bad signature, expired, malformed)."""
    return jwt.decode(token, secret, algorithms=["HS256"], options={"require": ["exp", "sub"]})
