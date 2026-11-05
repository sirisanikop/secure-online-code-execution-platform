"""Registration, login, throttling (DS-AUTH-01, DS-AUTH-02)."""
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import Settings
from ..errors import AppError
from ..models import User
from ..security import create_token, hash_password, verify_password
from . import audit
from .rate_limiter import RateLimiter

_DUMMY_HASH: str | None = None


def _dummy_hash(rounds: int) -> str:
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password("dummy-password-1", rounds)
    return _DUMMY_HASH


def register(db: Session, settings: Settings, username: str, password: str, is_admin: bool = False) -> User:
    key = username.lower()
    if db.scalar(select(User).where(User.username == key)):
        raise AppError(409, "USERNAME_TAKEN", "That username is already taken")
    user = User(username=key, password_hash=hash_password(password, settings.bcrypt_rounds), is_admin=is_admin)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "USERNAME_TAKEN", "That username is already taken")
    return user


def login(db: Session, settings: Settings, limiter: RateLimiter, username: str, password: str, ip: str) -> tuple[str, User]:
    key = username.lower()
    window = settings.login_lock_minutes * 60
    throttle_key = f"login:{key}:{ip}"
    blocked, retry = limiter.peek_blocked(throttle_key, settings.login_max_failures, window)
    if blocked:
        audit.log(db, audit.LOGIN_THROTTLED, None, f"username={key[:30]}", ip)
        raise AppError(429, "TOO_MANY_ATTEMPTS", f"Too many failed attempts. Try again in {retry} s",
                       {"Retry-After": str(retry)})
    user = db.scalar(select(User).where(User.username == key))
    ok = verify_password(password, user.password_hash if user else _dummy_hash(settings.bcrypt_rounds))
    if not user or not ok:
        limiter.record(throttle_key)
        audit.log(db, audit.LOGIN_FAILED, user.id if user else None, f"username={key[:30]}", ip)
        raise AppError(401, "INVALID_CREDENTIALS", "Invalid username or password")
    limiter.reset(throttle_key)
    token = create_token(user.id, user.username, user.is_admin, settings.jwt_secret, settings.jwt_expire_minutes)
    return token, user


def ensure_admin(db: Session, settings: Settings) -> None:
    """Create/promote the administrator configured through ADMIN_USERNAME / ADMIN_PASSWORD."""
    if not (settings.admin_username and settings.admin_password):
        return
    key = settings.admin_username.lower()
    user = db.scalar(select(User).where(User.username == key))
    if user is None:
        register(db, settings, key, settings.admin_password, is_admin=True)
    elif not user.is_admin:
        user.is_admin = True
        db.commit()
