# Deviations Note (SRS / SAD / Test Plan vs. Delivered)

This note records honest deviations between the planned documentation (`docs/SRS.docx`, `docs/SAD.docx`, `docs/Test_Plan.docx`) and what was delivered on `main` (assignment sheet 2i).

## 1. Process & Delivery Cadence
- **4 large PRs instead of incremental feature PRs:** After the initial CI setup (PR #1), the platform was merged across 4 large pull requests on 5–9 Nov (PR #2 backend, PR #3 frontend UI, PR #4 testing suite and sample programs, PR #5 SRS/SAD/Test Plan docs) rather than one small PR per requirement/issue.
- **Missing `HOW_TO_RUN.md`:** `CEP-NF-006`, `TC-MNT-01`, `testing/README.md`, and `testing/run_all.ps1` referenced `HOW_TO_RUN.md`, which was missing from `main` after PR #2–#5 merged (tracked and added separately under Sprint 1 issue `#61`).

## 2. CI & Test Execution
- **Backend tests skipped on Ubuntu CI:** `.github/workflows/tests.yml` runs `python -m pytest -v` on `ubuntu-latest` with only root `requirements.txt` (`pytest`) installed. `backend/conftest.py` skips collecting `backend/tests` when `os.name != "nt"` or backend dependencies are absent because the sandbox relies on Windows Job Objects. Consequently, the full backend + sandbox suite must be executed on Windows (PR #6 tracks extending CI to Windows and frontend).
- **`TC-UX-01` not executed:** The manual usability walkthrough (`CEP-NF-005` / `TC-UX-01` — 3 first-time participants registering, logging in, and running code within 2 minutes) has not been executed (`docs/tools/results.js`, `Test_Plan.docx` §14.4).

## 3. Technical & Scope Deviations
- **CodeMirror test double in unit tests:** `frontend/src/test/ui.test.jsx` replaces CodeMirror with a `<textarea>` test double in `jsdom` rather than running headless browser tests (`Test_Plan.docx` §4, §10).
- **Process-level vs. VM/container isolation:** Execution isolation uses Windows Job Objects, a restricted environment, static AST validation, and a PEP 578 audit hook rather than containers/VMs (`Test_Plan.docx` §4, §14.4).
- **Console device `open('CON')`:** Opening `CON` does not emit a Python audit event and blocks on the child's hidden console until the Job Object/wall-clock timeout fires; documented as residual behavior (`Test_Plan.docx` §14.3).
- **Restricted stdlib modules:** Modules requiring blocked capabilities (`unittest`, `zipfile`, `tarfile`, `timeit`, `getpass`, `asyncio`, `pathlib` file I/O) are unavailable to user submissions (`Test_Plan.docx` §14.4).
- **Single-machine load scope:** `TC-PERF-03` validated 20 concurrent users on a single developer machine only (`Test_Plan.docx` §14.4).

