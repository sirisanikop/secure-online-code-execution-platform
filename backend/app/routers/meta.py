from fastapi import APIRouter, Request

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/limits")
def limits(request: Request):
    s = request.app.state.settings
    return {
        "timeout_seconds": s.exec_timeout_seconds,
        "memory_limit_mb": s.exec_memory_limit_mb,
        "output_limit_bytes": s.exec_output_limit_bytes,
        "max_code_bytes": s.max_code_bytes,
        "max_stdin_bytes": s.max_stdin_bytes,
        "rate_limit_runs_per_min": s.rate_limit_runs_per_min,
    }
