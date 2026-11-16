# Sprint 2 - Day 5 report: sirisanikop

**Scope:** #32, #33, #34 (frontend editor, output panel, progress state), plus the status of #64.
**Evidence base:** the passing "Frontend tests" job on `main` at 04b4aa2, a clean `npm ci` and `npm test` on Ubuntu: https://github.com/sirisanikop/secure-online-code-execution-platform/actions/runs/43904593893
**Not run locally:** the committed `frontend/node_modules` contains Windows-only binaries (rollup's native build), so Vitest cannot start on Linux. This is one more reason for #64.

## Result

| Issue | Requirement | Test case | Result |
|---|---|---|---|
| #32 | CEP-F-040 Editor + Run | TC-UI-01 | PASSED |
| #33 | CEP-F-041 Output panel | TC-UI-02 | PASSED |
| #34 | CEP-F-042 Progress state | TC-UI-03 | PASSED |
| #64 | DEL-08 Stop tracking node_modules and frontend/dist | n/a | **Open: branch refreshed on latest `main`, waiting for team OK** |

## #32 CEP-F-040 - Editor + Run
- **Requirement:** a code editor with Python syntax highlighting, a standard-input box and a Run button. The UI is Python-only; there is no language selector, and the requirement does not ask for one.
- **Code:** `frontend/src/pages/EditorPage.jsx:45-48` (CodeMirror with `python()`), `:49-52` (stdin textarea), `:55` (Run button), `:28` (`api.run(code, stdin)`).
- **Test:** `TC-UI-01`, `frontend/src/test/ui.test.jsx:45-57`.

## #33 CEP-F-041 - Output panel
- **Requirement:** stdout, stderr, status badge, runtime and memory for each run, with errors visually distinct (the panel also shows the exit code).
- **Code:** `frontend/src/components/OutputPanel.jsx:14-17,20,21`; `frontend/src/styles.css:38` (`.out.error`).
- **Test:** `TC-UI-02`, `frontend/src/test/ui.test.jsx:59-70`.

## #34 CEP-F-042 - Progress state
- **Requirement:** a progress state while a run is in progress, and no duplicate submission.
- **Code:** `frontend/src/pages/EditorPage.jsx:16,23-24,55`; `frontend/src/components/OutputPanel.jsx:4-6`.
- **Test:** `TC-UI-03`, `frontend/src/test/ui.test.jsx:72-85` (only one POST is sent when the disabled button is clicked again).

## #64 DEL-08
Branch `sprint-2-untrack-build-artifacts` is one commit on top of the latest `main`: it adds a `.gitignore` (the file was empty) and untracks 5,532 `frontend/node_modules` files and 3 `frontend/dist` files. Local copies are not deleted. The issue requires team confirmation, so the PR should not be merged until everyone agrees. After the merge each teammate runs `npm install` and `npm run build` once (see HOW_TO_RUN.md section 2.2), and the Windows walkthrough (#44) should be repeated once.
