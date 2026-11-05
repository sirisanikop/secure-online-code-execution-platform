from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..deps import client_ip, get_current_user, get_db
from ..errors import AppError
from ..models import Execution, User
from ..schemas import ExecuteIn, ExecutionDetail, ExecutionList, ExecutionOut, ExecutionSummary

router = APIRouter(prefix="/api/executions", tags=["executions"])


@router.post("", response_model=ExecutionOut)
def run_code(body: ExecuteIn, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Blocking by design (ADR-3): a run lasts at most a few seconds. Outcome is carried in `status`."""
    return request.app.state.executions.execute(db, user, body.code, body.stdin, client_ip(request))


@router.get("", response_model=ExecutionList)
def list_runs(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
              user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).select_from(Execution).where(Execution.user_id == user.id)) or 0
    rows = db.scalars(select(Execution).where(Execution.user_id == user.id)
                      .order_by(Execution.created_at.desc(), Execution.id.desc()).limit(limit).offset(offset)).all()
    items = [ExecutionSummary(id=r.id, status=r.status, runtime_ms=r.runtime_ms, created_at=r.created_at,
                              code_preview=r.code[:80]) for r in rows]
    return ExecutionList(items=items, total=total)


def _owned(db: Session, user: User, exec_id: int) -> Execution:
    row = db.get(Execution, exec_id)
    if row is None or row.user_id != user.id:
        raise AppError(404, "NOT_FOUND", "Execution not found")  # same answer for "missing" and "not yours"
    return row


@router.get("/{exec_id}", response_model=ExecutionDetail)
def get_run(exec_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _owned(db, user, exec_id)


@router.delete("/{exec_id}", status_code=204)
def delete_run(exec_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, user, exec_id))
    db.commit()
    return Response(status_code=204)
