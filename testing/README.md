# Testing

Everything needed to test CodeBox. The test code itself lives next to the code it tests; this folder is the entry point and adds a runner, sample programs and manual tests.

| Where | What |
|---|---|
| `testing/run_all.ps1` | one command that runs all automated tests and writes `testing/results/` |
| `testing/run_samples.py` | runs 18 sample programs through the real sandbox and checks each against its expected status |
| `testing/sample_programs/` | the sample programs (safe, erroring, resource-abusing and hostile); first lines say `# EXPECT: STATUS` |
| `testing/manual/` | manual test procedures (usability test TC-UX-01) |
| `backend/tests/` | pytest suite, 103 tests (auth, execution, sandbox attack corpus, history/admin, security, live server) |
| `frontend/src/test/ui.test.jsx` | Vitest + React Testing Library, 8 tests |

## Run

Set the project up first (HOW_TO_RUN.md section 2), then from PowerShell:

```powershell
.\testing\run_all.ps1            # everything, about 3 minutes
.\testing\run_all.ps1 -Quick     # skips the slow sandbox and live-server tests (about 1 minute)
```

Individual parts:

```powershell
backend\.venv\Scripts\python.exe testing\run_samples.py          # sample programs only (about 15 s)
cd backend; .\.venv\Scripts\python.exe -m pytest tests -q        # back end only
cd frontend; npm test                                            # front end only
```

If PowerShell refuses to run the script, allow it for this session: `Set-ExecutionPolicy -Scope Process Bypass`.

## What the suites cover

| Area | Test-case ids | File |
|---|---|---|
| Authentication | TC-AUTH-01..06 | `backend/tests/test_auth.py` |
| Execution, statuses, queue, rate limit | TC-EXE-01..10 | `test_execution.py` |
| Limits, static policy, 40 runtime attacks, cleanup | TC-SBX-01..07 | `test_sandbox.py` |
| History and administration | TC-HIS-01..04, TC-ADM-01..03 | `test_history_admin.py` |
| Platform security, audit | TC-SEC-01..10, TC-OPS-01 | `test_security.py` |
| Performance, reliability | TC-PERF-01..03, TC-REL-01 | `test_live_server.py` |
| User interface | TC-UI-01..04 | `frontend/src/test/ui.test.jsx` |
| Usability (manual) | TC-UX-01 | `testing/manual/TC-UX-01_usability_checklist.md` |
| Clean installation (manual) | TC-MNT-01 | HOW_TO_RUN.md |

Test names embed these ids, so results map straight to the traceability matrix in `docs/SRS.docx` and the plan in `docs/Test_Plan.docx`.

## Adding a sample program

Create `testing/sample_programs/NN_name.py` starting with `# EXPECT: <STATUS>` (one of COMPLETED, RUNTIME_ERROR, TIMEOUT, MEMORY_LIMIT, OUTPUT_LIMIT, BLOCKED) and optionally `# STDIN: text`. `run_samples.py` picks it up automatically.

## Notes
- Tests start real sandboxed processes (infinite loops, memory bombs), so a few take 5+ seconds each; this is expected.
- The suite creates throw-away databases and temp folders and cleans them up; it never touches `backend/data/codebox.db`.
- Windows only (the sandbox uses Job Objects).
