# Back end - CodeBox sandboxed code execution API

FastAPI service that runs user-submitted Python in an isolated child process (Windows Job Object limits + runtime audit hook),
with JWT authentication, execution history, rate limiting and an audit log.

**Requires Windows 10/11 and Python 3.11+** (the sandbox uses Windows Job Objects).

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:JWT_SECRET = "a-long-random-string-of-32-or-more-characters"
.\.venv\Scripts\python.exe run.py          # API on http://127.0.0.1:8000, docs at /docs
.\.venv\Scripts\python.exe -m pytest tests -q   # 103 tests, about 2.5 minutes
```

Limits (env vars): `EXEC_TIMEOUT_SECONDS=5`, `EXEC_MEMORY_LIMIT_MB=128`, `EXEC_OUTPUT_LIMIT_BYTES=65536`, `MAX_CONCURRENT_RUNS=4`,
`RATE_LIMIT_RUNS_PER_MIN=10`. See `app/config.py` for all settings.

Layout: `app/routers` (HTTP), `app/services` (auth, execution, validator, rate limiter, audit),
`app/sandbox` (manager, job object, runner bootstrap), `tests/` (pytest).

Note: the repository's Ubuntu CI does not collect `backend/tests` (see `backend/conftest.py`); run them on Windows.
