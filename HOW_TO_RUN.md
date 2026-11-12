# How to Run CodeBox

CodeBox is a sandboxed online Python code-execution platform built with a FastAPI back end and a React (Vite) front end.

## 1. Prerequisites

- **Operating System:** Windows 10 or Windows 11 (required because the execution sandbox enforces resource and process limits using Windows Job Objects).
- **Python:** 3.11 or newer (`python --version`).
- **Node.js & npm:** Node.js 20 or newer (`node -v`, `npm -v`).
- **Shell:** Windows PowerShell 5.1 or PowerShell 7+.

## 2. Project Setup

Run all commands below from the repository root (`secure-online-code-execution-platform`).

### 2.1 Back End Setup

Create the virtual environment inside `backend\.venv` and install the Python dependencies:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
```

> **Note:** Both `testing\run_all.ps1` and `testing\README.md` expect the virtual environment at `backend\.venv\Scripts\python.exe`.

### 2.2 Front End Setup

Install Node dependencies and build the static bundle (which the back end serves automatically when present):

```powershell
cd frontend
npm install
npm run build
cd ..
```

## 3. Running the Application

### Option A: Single-Command Run (Recommended)

Once `frontend\dist` has been built (Section 2.2), the FastAPI server serves both the `/api/*` endpoints and the React UI on a single port:

```powershell
cd backend
$env:JWT_SECRET = "replace-with-a-long-random-secret-at-least-32-chars"
.\.venv\Scripts\python.exe run.py
```

- Web UI: `http://127.0.0.1:8000`
- OpenAPI / Swagger UI: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`

> If `JWT_SECRET` is not set, a random secret is generated on startup and existing JWT tokens become invalid after a server restart.

### Option B: Development Mode (Hot Reload)

Run the back end in one PowerShell window:

```powershell
cd backend
$env:JWT_SECRET = "dev-secret-at-least-32-characters-long"
.\.venv\Scripts\python.exe run.py
```

Run the Vite dev server in a second PowerShell window:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to `http://127.0.0.1:8000`.

### Creating an Administrator Account

You can create or promote an administrator either via CLI or environment variables:

- **CLI** (from `backend\`):
  ```powershell
  .\.venv\Scripts\python.exe -m app.create_admin <username> <password>
  ```
- **Environment variables** (checked on server startup): set `ADMIN_USERNAME` and `ADMIN_PASSWORD` before running `run.py`.

Password rules: 8–72 bytes, containing at least one letter and one digit. Username rules: 3–30 characters (`A–Z`, `a–z`, `0–9`, `_`).

## 4. Configuration (Environment Variables)

All runtime limits, authentication settings, and paths are configurable via environment variables (`backend/app/config.py` and `backend/run.py`):

| Variable | Default | Description |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind address for `backend/run.py` |
| `PORT` | `8000` | Listen port for `backend/run.py` |
| `JWT_SECRET` | Random on startup | HS256 signing secret (set a persistent 32+ char secret in production) |
| `JWT_EXPIRE_MINUTES` | `60` | Access token lifetime in minutes |
| `BCRYPT_ROUNDS` | `12` | bcrypt work factor for password hashing |
| `LOGIN_MAX_FAILURES` | `5` | Consecutive failed logins before throttling (`429`) |
| `LOGIN_LOCK_MINUTES` | `5` | Login lockout window in minutes |
| `ADMIN_USERNAME` | `""` | Optional admin account created/promoted on startup |
| `ADMIN_PASSWORD` | `""` | Password for `ADMIN_USERNAME` |
| `EXEC_TIMEOUT_SECONDS` | `5` | Max wall-clock execution time per run (seconds) |
| `EXEC_MEMORY_LIMIT_MB` | `128` | Max memory per sandboxed process (MB) |
| `EXEC_OUTPUT_LIMIT_BYTES` | `65536` | Max stdout/stderr bytes per stream |
| `MAX_CODE_BYTES` | `51200` | Max submitted source size (50 KB) |
| `MAX_STDIN_BYTES` | `16384` | Max submitted stdin size (16 KB) |
| `MAX_CONCURRENT_RUNS` | `4` | Max simultaneous sandbox executions |
| `MAX_QUEUE_LENGTH` | `20` | Max queued requests before returning `503` |
| `RATE_LIMIT_RUNS_PER_MIN` | `10` | Per-user execution requests allowed per minute |
| `SANDBOX_ROOT` | `backend/data/sandbox_tmp` | Parent directory for per-run temporary directories |
| `SANDBOX_PYTHON` | `""` | Override Python interpreter path used for child runs |
| `DATABASE_URL` | `sqlite:///.../backend/data/codebox.db` | SQLAlchemy database URL |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for the front end |
| `AUDIT_RETENTION_DAYS` | `90` | Days to retain audit events before startup purge |

## 5. Running the Test Suite

After completing Section 2, run the full automated verification suite from the repository root:

```powershell
.\testing\run_all.ps1
```

Other options:

```powershell
.\testing\run_all.ps1 -Quick                           # Skip slow sandbox attack and live-server tests
backend\.venv\Scripts\python.exe testing\run_samples.py # Run the 18 sample programs through the sandbox
cd backend; .\.venv\Scripts\python.exe -m pytest tests -v # Run all backend tests directly
cd frontend; npm test                                  # Run frontend Vitest suite directly
```

Test reports (`junit.xml`, `vitest.json`, `summary.txt`) are written to `testing\results\`.

## 6. Troubleshooting

- **PowerShell blocks `.ps1` scripts:** Run `Set-ExecutionPolicy -Scope Process Bypass` in the current PowerShell session before running `.\testing\run_all.ps1`.
- **Sandbox fails to start child Python (`INTERNAL_ERROR`):** The sandbox requires the base CPython interpreter (`sys._base_executable`) rather than a venv launcher shim so `ActiveProcessLimit = 1` is respected. If Python is installed in a non-standard location, set `SANDBOX_PYTHON` to the base `python.exe` path.
- **API runs on `http://127.0.0.1:8000` without UI:** Ensure `npm run build` was run in `frontend\` so `frontend\dist\` exists.
- **Port `8000` already in use:** Set `$env:PORT = "8001"` before running `run.py` (and update `frontend\vite.config.js` proxy if using dev mode).

