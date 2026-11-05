from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..deps import client_ip, get_db, require_admin
from ..models import AuditEvent, Execution, User
from ..schemas import AuditList
from ..services import audit

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/audit-events", response_model=AuditList)
def audit_events(request: Request, type: str | None = None, date_from: datetime | None = Query(None, alias="from"),
                 date_to: datetime | None = Query(None, alias="to"), limit: int = Query(50, ge=1, le=200),
                 offset: int = Query(0, ge=0), admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = select(AuditEvent)
    if type:
        q = q.where(AuditEvent.event_type == type)
    if date_from:
        q = q.where(AuditEvent.created_at >= date_from.replace(tzinfo=date_from.tzinfo or timezone.utc))
    if date_to:
        q = q.where(AuditEvent.created_at <= date_to.replace(tzinfo=date_to.tzinfo or timezone.utc))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    items = db.scalars(q.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(limit).offset(offset)).all()
    audit.log(db, audit.ADMIN_ACCESS, admin.id, "audit-events", client_ip(request))
    return AuditList(items=items, total=total)


@router.get("/stats")
def stats(request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    by_status = {s: n for s, n in db.execute(select(Execution.status, func.count()).group_by(Execution.status)).all()}
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    active = db.scalar(select(func.count(func.distinct(Execution.user_id))).where(Execution.created_at >= since)) or 0
    audit.log(db, audit.ADMIN_ACCESS, admin.id, "stats", client_ip(request))
    return {
        "total_runs": sum(by_status.values()),
        "runs_by_status": by_status,
        "total_users": db.scalar(select(func.count()).select_from(User)) or 0,
        "active_users_24h": active,
        "avg_runtime_ms": round(db.scalar(select(func.avg(Execution.runtime_ms))) or 0, 1),
        "queue_waiting": request.app.state.sandbox.waiting,
    }
