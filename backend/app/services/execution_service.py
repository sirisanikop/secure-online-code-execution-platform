"""Orchestrates one run: size check -> rate limit -> validate -> sandbox -> persist -> audit (DS-EXE-01)."""
from sqlalchemy.orm import Session

from ..config import Settings
from ..errors import AppError
from ..models import Execution, User
from ..sandbox import manager as sbx
from . import audit
from .rate_limiter import RateLimiter
from .validator import validate

_LIMIT_EVENTS = {sbx.TIMEOUT: audit.TIMEOUT, sbx.MEMORY_LIMIT: audit.MEMORY_LIMIT, sbx.OUTPUT_LIMIT: audit.OUTPUT_LIMIT}


class ExecutionService:
    def __init__(self, settings: Settings, sandbox: sbx.SandboxManager, limiter: RateLimiter):
        self.settings = settings
        self.sandbox = sandbox
        self.limiter = limiter
        self.limits = sbx.Limits(settings.exec_timeout_seconds, settings.exec_memory_limit_mb,
                                 settings.exec_output_limit_bytes)

    def execute(self, db: Session, user: User, code: str, stdin: str, ip: str) -> Execution:
        s = self.settings
        if len(code.encode("utf-8")) > s.max_code_bytes:
            raise AppError(413, "CODE_TOO_LARGE", f"Source code exceeds {s.max_code_bytes} bytes")
        if len(stdin.encode("utf-8")) > s.max_stdin_bytes:
            raise AppError(413, "STDIN_TOO_LARGE", f"Standard input exceeds {s.max_stdin_bytes} bytes")
        if not code.strip():
            raise AppError(422, "EMPTY_CODE", "Source code is empty")

        allowed, retry = self.limiter.check(f"run:{user.id}", s.rate_limit_runs_per_min, 60)
        if not allowed:
            audit.log(db, audit.RATE_LIMITED, user.id, "execution rate limit", ip)
            raise AppError(429, "RATE_LIMITED", f"Too many runs. Retry in {retry} s", {"Retry-After": str(retry)})

        verdict = validate(code)
        if not verdict.ok:
            result = sbx.RunResult(sbx.BLOCKED, stderr=f"Blocked by security policy. {verdict.reason}",
                                   blocked_reason=verdict.reason)
            audit.log(db, audit.BLOCKED_CODE, user.id, f"{verdict.rule}: {verdict.reason}", ip)
        else:
            try:
                result = self.sandbox.run(code, stdin, self.limits)
            except sbx.SandboxBusy:
                raise AppError(503, "SERVER_BUSY", "The server is busy, please retry shortly", {"Retry-After": "5"})
            if result.status in _LIMIT_EVENTS:
                audit.log(db, _LIMIT_EVENTS[result.status], user.id, f"runtime_ms={result.runtime_ms}", ip)
            if result.status == sbx.INTERNAL_ERROR:
                # details stay server-side (blocked_reason carries the internal cause); the client sees a generic text
                import logging
                logging.getLogger("codebox").error("sandbox internal error: %s", result.blocked_reason)
                result.blocked_reason = None

        row = Execution(user_id=user.id, code=code, stdin=stdin, status=result.status, stdout=result.stdout,
                        stderr=result.stderr, exit_code=result.exit_code, runtime_ms=result.runtime_ms,
                        peak_mem_kb=result.peak_mem_kb, blocked_reason=(result.blocked_reason or None))
        db.add(row)
        db.commit()
        return row
