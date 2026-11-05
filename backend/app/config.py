"""Application settings, read from environment variables (see SAD 4.1.4)."""
import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


def _float(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


@dataclass
class Settings:
    # --- sandbox limits ---
    exec_timeout_seconds: float = field(default_factory=lambda: _float("EXEC_TIMEOUT_SECONDS", 5))
    exec_memory_limit_mb: int = field(default_factory=lambda: _int("EXEC_MEMORY_LIMIT_MB", 128))
    exec_output_limit_bytes: int = field(default_factory=lambda: _int("EXEC_OUTPUT_LIMIT_BYTES", 65536))
    max_code_bytes: int = field(default_factory=lambda: _int("MAX_CODE_BYTES", 51200))
    max_stdin_bytes: int = field(default_factory=lambda: _int("MAX_STDIN_BYTES", 16384))
    max_concurrent_runs: int = field(default_factory=lambda: _int("MAX_CONCURRENT_RUNS", 4))
    max_queue_length: int = field(default_factory=lambda: _int("MAX_QUEUE_LENGTH", 20))
    rate_limit_runs_per_min: int = field(default_factory=lambda: _int("RATE_LIMIT_RUNS_PER_MIN", 10))
    sandbox_root: str = field(default_factory=lambda: os.environ.get("SANDBOX_ROOT", str(BASE_DIR / "data" / "sandbox_tmp")))
    sandbox_python: str = field(default_factory=lambda: os.environ.get("SANDBOX_PYTHON", ""))

    # --- auth ---
    jwt_secret: str = field(default_factory=lambda: os.environ.get("JWT_SECRET") or secrets.token_urlsafe(48))
    jwt_expire_minutes: int = field(default_factory=lambda: _int("JWT_EXPIRE_MINUTES", 60))
    bcrypt_rounds: int = field(default_factory=lambda: _int("BCRYPT_ROUNDS", 12))
    login_max_failures: int = field(default_factory=lambda: _int("LOGIN_MAX_FAILURES", 5))
    login_lock_minutes: int = field(default_factory=lambda: _int("LOGIN_LOCK_MINUTES", 5))
    admin_username: str = field(default_factory=lambda: os.environ.get("ADMIN_USERNAME", ""))
    admin_password: str = field(default_factory=lambda: os.environ.get("ADMIN_PASSWORD", ""))

    # --- platform ---
    database_url: str = field(default_factory=lambda: os.environ.get("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'data' / 'codebox.db').as_posix()}"))
    frontend_origin: str = field(default_factory=lambda: os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173"))
    audit_retention_days: int = field(default_factory=lambda: _int("AUDIT_RETENTION_DAYS", 90))
    jwt_secret_from_env: bool = field(default_factory=lambda: bool(os.environ.get("JWT_SECRET")))
