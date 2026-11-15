# Sprint 2 - Day 1 (15 Nov 2026) - verification of issues #30 and #44

**Assignee of the issues:** sirisanikop | **Verification run by:** samarthrao2 | **Code verified:** `main` at commit `2a8b8f3`
**Method:** a fresh `git clone` of `main` on Windows 11 / Python 3.11.9 / Node 22.20 / npm 10.9, following `HOW_TO_RUN.md` step by step, then direct checks against a live server on port 8011. Run and report prepared with Claude Code assistance.

## Result

| Issue | Requirement | Test case | Result |
|---|---|---|---|
| #30 | CEP-F-032 Owner-only detail | TC-HIS-03 | PASSED (issue was already closed) |
| #44 | CEP-NF-006 Portability | TC-MNT-01 | PASSED on a fresh clone; see caveat |

## #30 CEP-F-032 - Owner-only detail
- **AC-F-032:** user B requesting user A's execution id receives 404.
- **Test:** `test_TC_HIS_03_other_users_get_404` -> `1 passed`.
- **Live server:** alice runs `print(6*7)` (execution 1, `COMPLETED`, stdout `42`). alice GET -> 200; bob GET -> **404**; bob DELETE -> **404**; bob's list -> `{"items": [], "total": 0}`; alice GET afterwards -> 200 (not deleted); no token -> 401.
- **Code:** `backend/app/routers/executions.py:30-39` (`_owned()` raises 404 for a missing row or a different owner).
- Closed earlier by `sirisanikop` with a CI-based verification; this adds a local and live-server run.

## #44 CEP-NF-006 - Portability
- **AC:** a clean machine follows `HOW_TO_RUN.md` and reaches a working app.
- **Steps followed from a fresh clone:** `python -m venv .venv` and `pip install -r requirements.txt` (exit 0); full backend suite `104 passed` (2 min 38 s); `npm install`, `npm run build`, `npm test` (all exit 0, 8 frontend tests passed); `python run.py` with `JWT_SECRET` set and `PORT=8011` started; `GET /` -> 200 (built UI), `/api/health` -> `{"status": "ok"}`; register, login, run and history worked.
- **Configuration:** `HOST` and `PORT` are read from the environment in `backend/run.py`; limits come from environment variables in `backend/app/config.py`.
- **Caveat (not a pristine machine):** Python and Node were already installed (they are the documented prerequisites), and `npm install` reported "up to date" because the repository tracks `frontend/node_modules`. A walkthrough on a machine with nothing installed was not performed.

## Notes
- No defects found; no code changed.
- Only the checks above were run; the sandbox is Windows-only, so no other operating system was tried.
