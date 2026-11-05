"""Audit logger (DS-AUD-01). Never stores passwords, tokens or full source code."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models import AuditEvent

LOGIN_FAILED = "LOGIN_FAILED"
LOGIN_THROTTLED = "LOGIN_THROTTLED"
BLOCKED_CODE = "BLOCKED_CODE"
TIMEOUT = "TIMEOUT"
MEMORY_LIMIT = "MEMORY_LIMIT"
OUTPUT_LIMIT = "OUTPUT_LIMIT"
RATE_LIMITED = "RATE_LIMITED"
ADMIN_ACCESS = "ADMIN_ACCESS"
EVENT_TYPES = [LOGIN_FAILED, LOGIN_THROTTLED, BLOCKED_CODE, TIMEOUT, MEMORY_LIMIT, OUTPUT_LIMIT, RATE_LIMITED, ADMIN_ACCESS]


def log(db: Session, event_type: str, user_id: int | None = None, detail: str = "", ip: str = "") -> None:
    db.add(AuditEvent(event_type=event_type, user_id=user_id, detail=detail[:500], ip_address=ip[:64]))
    db.commit()


def purge_old(db: Session, retention_days: int) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    res = db.execute(delete(AuditEvent).where(AuditEvent.created_at < cutoff))
    db.commit()
    return res.rowcount or 0
