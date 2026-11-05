"""FastAPI application factory (SAD 4.1.1)."""
import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

from .config import Settings
from .database import Base, make_engine, make_session_factory
from .errors import AppError, error_body
from .routers import admin, auth, executions, meta
from .sandbox.manager import SandboxManager
from .services import audit, auth_service
from .services.execution_service import ExecutionService
from .services.rate_limiter import RateLimiter

log = logging.getLogger("codebox")
MAX_BODY_BYTES = 1_000_000  # transport-level cap; configurable 50 KB / 16 KB limits are enforced in the service
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="CodeBox - Secure Online Code Execution Platform", version="1.0.0")

    engine = make_engine(settings.database_url)
    Base.metadata.create_all(engine)
    session_factory = make_session_factory(engine)
    limiter = RateLimiter()
    sandbox = SandboxManager(settings.sandbox_root, settings.max_concurrent_runs, settings.max_queue_length,
                             settings.sandbox_python)
    swept = sandbox.sweep_stale()
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.limiter = limiter
    app.state.sandbox = sandbox
    app.state.executions = ExecutionService(settings, sandbox, limiter)

    with session_factory() as db:
        auth_service.ensure_admin(db, settings)
        audit.purge_old(db, settings.audit_retention_days)
    if swept:
        log.warning("removed %d stale sandbox directories from a previous run", swept)
    if not settings.jwt_secret_from_env:
        log.warning("JWT_SECRET not set: using a random secret; tokens become invalid after a restart")

    app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=False,
                       allow_methods=["GET", "POST", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

    @app.middleware("http")
    async def guard(request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > MAX_BODY_BYTES:
            return JSONResponse(error_body("PAYLOAD_TOO_LARGE", "Request body too large"), status_code=413)
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "no-referrer"
        if request.url.path.startswith("/api"):
            resp.headers["Cache-Control"] = "no-store"
        return resp

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(error_body(exc.code, exc.message), status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        msgs = []
        for e in exc.errors():
            loc = ".".join(str(p) for p in e.get("loc", []) if p not in ("body", "query"))
            msg = str(e.get("msg", "invalid")).removeprefix("Value error, ")
            msgs.append(f"{loc}: {msg}" if loc else msg)
        return JSONResponse(error_body("VALIDATION_ERROR", "; ".join(msgs)), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        return JSONResponse(error_body("HTTP_" + str(exc.status_code), str(exc.detail)), status_code=exc.status_code,
                            headers=getattr(exc, "headers", None))

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):
        log.exception("unhandled error", exc_info=exc)
        return JSONResponse(error_body("INTERNAL_ERROR", "An unexpected error occurred"), status_code=500)

    for r in (meta.router, auth.router, executions.router, admin.router):
        app.include_router(r)

    if FRONTEND_DIST.is_dir():  # `npm run build` output is served by the same process (single-command run)
        index = FRONTEND_DIST / "index.html"
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            if path.startswith("api/"):
                raise StarletteHTTPException(404, "Not found")
            candidate = (FRONTEND_DIST / path).resolve()
            if path and candidate.is_file() and FRONTEND_DIST.resolve() in candidate.parents:
                return FileResponse(candidate)
            return FileResponse(index)

    return app

