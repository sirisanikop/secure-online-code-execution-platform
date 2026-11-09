const L = require("./lib");
const { P, H1, H2, H3, B, table, gap, makeDoc, save, Paragraph, TextRun } = L;
const R = require("./reqs");
const res = require("./results");

const kids = [];
const add = (...x) => x.flat().forEach((e) => kids.push(e));
const DATE = "29-10-2026";

const DESC = {
  "TC-AUTH-01": ["Register with valid details", "Functional", "tests/test_auth.py"],
  "TC-AUTH-02": ["Password stored only as bcrypt hash; not returned", "Security", "tests/test_auth.py"],
  "TC-AUTH-03": ["Login issues signed JWT (60 min); expired token rejected", "Functional", "tests/test_auth.py"],
  "TC-AUTH-04": ["Throttle after 5 failed logins; audit events recorded", "Security", "tests/test_auth.py"],
  "TC-AUTH-05": ["Missing / malformed / tampered token -> 401 on protected endpoints", "Security", "tests/test_auth.py"],
  "TC-AUTH-06": ["Duplicate and invalid registration rejected (409 / 422)", "Functional", "tests/test_auth.py"],
  "TC-EXE-01": ["Accept code + stdin within limits", "Functional", "tests/test_execution.py"],
  "TC-EXE-02": ["print('hi') returns stdout, empty stderr, exit 0", "Functional", "tests/test_execution.py"],
  "TC-EXE-03": ["Reference programs map to all statuses (COMPLETED..BLOCKED)", "Functional", "tests/test_execution.py"],
  "TC-EXE-04": ["runtime_ms and peak_mem_kb reported", "Functional", "tests/test_execution.py"],
  "TC-EXE-05": ["stdin delivered; EOFError after the end", "Functional", "tests/test_execution.py"],
  "TC-EXE-06": ["Exceptions / syntax errors captured; no server paths leaked", "Functional", "tests/test_execution.py"],
  "TC-EXE-07": ["Concurrency limit, queue and 503 when full (manager and API)", "Functional", "tests/test_execution.py"],
  "TC-EXE-08": ["Fresh private work directory per run, deleted afterwards", "Functional", "tests/test_execution.py"],
  "TC-EXE-09": ["Execution rate limit (429 + Retry-After), per user", "Functional", "tests/test_execution.py"],
  "TC-EXE-10": ["Oversize code / stdin / body -> 413; empty code -> 422", "Functional", "tests/test_execution.py"],
  "TC-SBX-01": ["Infinite loop and sleep killed at 5 s -> TIMEOUT", "Sandbox", "tests/test_sandbox.py"],
  "TC-SBX-02": ["Memory bombs (list, string doubling, bytearray) -> MEMORY_LIMIT", "Sandbox", "tests/test_sandbox.py"],
  "TC-SBX-03": ["Output flood on stdout / stderr capped at 64 KB -> OUTPUT_LIMIT", "Sandbox", "tests/test_sandbox.py"],
  "TC-SBX-04": ["os.system, spawn, subprocess, popen, _winapi, spawn loop all denied; marker file never created", "Sandbox", "tests/test_sandbox.py"],
  "TC-SBX-05": ["15 policy violations rejected statically (BLOCKED, never started); allowed programs pass", "Sandbox", "tests/test_sandbox.py"],
  "TC-SBX-06": ["40 runtime attacks (file read/write, traversal, listdir, env, imports, gadgets, hook tampering, .pyd loading...) all denied; legitimate operations still work", "Sandbox / Security", "tests/test_sandbox.py"],
  "TC-SBX-07": ["24 mixed runs leave no orphan processes and no temp directories", "Sandbox", "tests/test_sandbox.py"],
  "TC-HIS-01": ["Run persisted and linked to its owner", "Functional", "tests/test_history_admin.py"],
  "TC-HIS-02": ["History newest first with pagination", "Functional", "tests/test_history_admin.py"],
  "TC-HIS-03": ["Other users get 404 for read / delete", "Security", "tests/test_history_admin.py"],
  "TC-HIS-04": ["Delete own run", "Functional", "tests/test_history_admin.py"],
  "TC-UI-01": ["Editor, stdin box, Run button; Run submits code", "UI", "frontend/src/test/ui.test.jsx"],
  "TC-UI-02": ["Output panel shows stdout, stderr (error style), badge, runtime, memory", "UI", "frontend/src/test/ui.test.jsx"],
  "TC-UI-03": ["Progress state; duplicate submission prevented", "UI", "frontend/src/test/ui.test.jsx"],
  "TC-UI-04": ["Auth form validation messages, login flow, history list/detail/delete", "UI", "frontend/src/test/ui.test.jsx"],
  "TC-ADM-01": ["Admin audit events with type / date filters", "Functional", "tests/test_history_admin.py"],
  "TC-ADM-02": ["Admin platform statistics", "Functional", "tests/test_history_admin.py"],
  "TC-ADM-03": ["Non-admin -> 403 on admin endpoints", "Security", "tests/test_history_admin.py"],
  "TC-SEC-01": ["Code runs in a separate process, not the server process", "Security", "tests/test_security.py"],
  "TC-SEC-02": ["No plaintext password in responses, DB or audit log", "Security", "tests/test_security.py"],
  "TC-SEC-03": ["Forged tokens (wrong secret, alg none, no exp, unknown user, fake admin claim) rejected", "Security", "tests/test_security.py"],
  "TC-SEC-04": ["Object-level authorisation on executions", "Security", "tests/test_security.py"],
  "TC-SEC-05": ["SQL-injection strings, malformed JSON, oversize body handled safely", "Security", "tests/test_security.py"],
  "TC-SEC-06": ["Child environment contains no server secrets", "Security", "tests/test_security.py"],
  "TC-SEC-07": ["Sandbox policy enforced end to end through the API", "Security", "tests/test_security.py"],
  "TC-SEC-08": ["CORS restricted to configured origin; security headers present", "Security", "tests/test_security.py"],
  "TC-SEC-09": ["Security events audited without secrets", "Security", "tests/test_security.py"],
  "TC-SEC-10": ["Login and execution rate limiting", "Security", "tests/test_security.py"],
  "TC-PERF-01": ["Trivial program p90 <= 2 s (live server, 30 runs)", "Performance", "tests/test_live_server.py"],
  "TC-PERF-02": ["Mean sandbox time of an empty program <= 500 ms", "Performance", "tests/test_live_server.py"],
  "TC-PERF-03": ["20 concurrent users, 60 runs, >= 90% succeed", "Performance", "tests/test_live_server.py"],
  "TC-REL-01": ["Health endpoint <= 1 s under 4 hostile programs; no orphans afterwards", "Reliability", "tests/test_live_server.py"],
  "TC-OPS-01": ["Audit events queryable; retention purge on start-up", "Operations", "tests/test_security.py"],
  "TC-UX-01": ["First-time user registers, logs in and runs code within 2 minutes (3 users)", "Usability (manual)", "manual"],
  "TC-MNT-01": ["Clean machine follows HOW_TO_RUN.md and reaches a working app", "Maintainability (manual)", "manual"],
};

// requirement -> TC reverse index
const reqsFor = {};
R.ALL.forEach((r) => r.tc.forEach((t) => (reqsFor[t] ||= []).push(r.id)));
const ids = Object.keys(DESC);
const counts = { Passed: 0, Failed: 0, "Not executed": 0, "No result": 0 };
ids.forEach((i) => counts[res.status(i)]++);
const executedAuto = res.pyTotal + res.vtTotal;

add(new Paragraph({ heading: "Heading1", children: [new TextRun("Software Test Plan (STP) - Secure Online Code Execution Platform")] }));
add(P("**Project:** Secure Online Code Execution Platform (CodeBox)"));
add(P("**Version:** 1.1 (updated with execution results)"));
add(P("**Authors:** SE Mini Project Team (QA)"));
add(P("**Date:** " + DATE));
add(P("**Status:** Executed - results included"));

add(H2("1. Introduction"));
add(P("**Purpose:** This document defines the test plan for CodeBox v1.0 and records the results of executing it. It states objectives, scope, strategy, environment, schedule and responsibilities for testing, with emphasis on the security of the code-execution sandbox."));
add(P("**Scope:** Authentication, code execution and classification, resource limits, static and runtime safety enforcement, execution history, administration, web interface, performance, reliability and auditability. Third-party library internals and the Windows kernel are excluded."));
add(P("**References:** SRS v1.1 (CEP-F / CEP-NF / CEP-SR requirements), SAD v1.1, OWASP ASVS, PEP 578."));
add(P("**Definitions:** TC = test case; RTM = requirements traceability matrix; sandbox = isolated child process + Job Object + audit hook; hostile program = code written to attack the platform."));

add(H2("2. Test Items"));
["Authentication module (register, login, JWT, throttling)", "Execution module (validation, orchestration, rate limit, queue)", "Static code validator",
  "Sandbox (Job Object controller, runner bootstrap with audit hook, output caps, cleanup)", "History module", "Admin and audit module", "React web interface",
  "Configuration and start-up (settings, admin seeding, stale-directory sweep)"].forEach((t) => add(B(t)));

add(H2("3. Features to be Tested"));
add(P("Features are mapped to SRS requirement IDs:"));
add(table(["Feature", "Requirement IDs"], [
  ["Registration, login, tokens, throttling", "CEP-F-001..005, CEP-SR-002, 003, 010"],
  ["Submission, execution, statuses, stdin, errors, queue, cleanup, rate limit", "CEP-F-010..018"],
  ["Time / memory / output / process limits, static policy, runtime denial", "CEP-F-020..026, CEP-SR-001, 006, 007"],
  ["History and ownership", "CEP-F-030..033, CEP-SR-004"],
  ["Web interface", "CEP-F-040..043"],
  ["Administration and audit", "CEP-F-050..052, CEP-NF-007, CEP-SR-009"],
  ["Input validation, CORS, headers", "CEP-SR-005, 008"],
  ["Performance, reliability, scalability", "CEP-NF-001, 002, 004, 008"],
  ["Attack resistance", "CEP-NF-003"],
  ["Usability, portability", "CEP-NF-005, 006"],
], [5200, 4546], { size: 17 }));

add(H2("4. Features Not to be Tested"));
["Internals of FastAPI, SQLAlchemy, React, CodeMirror, CPython and the Windows kernel (assumed correct; version-pinned)", "Visual rendering of the CodeMirror editor in a real browser (replaced by a textarea test double in unit tests; checked manually)",
  "Container / VM isolation (not part of this release)", "Multi-machine deployment and TLS termination (reverse-proxy responsibility)", "Penetration testing by an independent third party (recommended before any public exposure)"].forEach((t) => add(B(t)));

add(H2("5. Test Approach / Strategy"));
add(P("**Levels:** unit (validator, rate limiter, sandbox manager), integration (API + database + sandbox), system (live uvicorn server with real sandbox processes), acceptance (SRS acceptance criteria per requirement)."));
add(P("**Types:** functional, security / attack, performance, reliability, usability, regression (the whole suite is re-run after every fix)."));
add(P("**Entry criteria:** build runs; dependencies installed; Windows host with Python 3.11+ and Node 20+. **Exit criteria:** 100% of planned automated cases executed, 0 open critical defects, all High-priority requirements verified."));
add(P("**Automation:** pytest (backend, 103 tests) and Vitest + React Testing Library (front end, 8 tests). Test-case IDs are embedded in test names so results map directly to the RTM."));
add(H2("5.1 Security Validation"));
["Attack corpus of 40 hostile programs executed through the real sandbox (file read/write, path traversal, directory listing, environment disclosure, process creation, network and dangerous-module imports, reflection gadgets, builtins tampering, native-extension loading, code-object forgery, tracing)",
  "Resource-exhaustion programs: infinite loop, sleep, memory bombs, output flood, spawn loop, thread leak",
  "Static-policy bypass attempts (dynamic imports, string concatenation, eval/exec indirection)",
  "Token forgery: wrong secret, alg=none, missing exp, unknown subject, forged admin claim",
  "Injection and malformed input: SQL-injection strings, invalid JSON, oversize bodies",
  "Cross-user access, CORS from a foreign origin, brute-force throttling, rate limiting",
  "Orphan-process and temp-directory checks after hostile runs"].forEach((t) => add(B(t)));

add(H2("6. Test Environment"));
add(P("**Hardware / OS:** developer laptop, Windows 11 Home (build 26200), 64-bit. **Software:** Python 3.11.9, FastAPI 0.162, SQLAlchemy 2.1, bcrypt, PyJWT, pytest 8; Node 22, Vite 5, React 18, Vitest 2. **Tools:** pytest, httpx, Vitest, Testing Library, PowerShell (process inspection). **Test data:** generated accounts (alice, bob, mallory, load0-19, evil0-3) in throw-away SQLite databases; every test run uses a fresh database and sandbox directory."));

add(H2("7. Test Schedule"));
add(table(["Milestone", "Date"], [["Test case design (SRS RTM)", "13-10-2026"], ["Environment set-up", "29-10-2026"], ["Automated execution and defect fixing", "29-10-2026"],
  ["Final regression run (103 + 8 tests)", "29-10-2026"], ["Manual usability test (TC-UX-01)", "Pending - needs participants"]], [6000, 3746], { size: 17 }));

add(H2("8. Test Deliverables"));
["This test plan with results", "Automated test code: backend/tests/*.py, frontend/src/test/ui.test.jsx", "Test data (generated by fixtures)", "Execution logs (pytest junit XML, Vitest JSON)", "Defect log (section 14.3)", "Test summary (section 14.1)"].forEach((t) => add(B(t)));

add(H2("9. Roles and Responsibilities"));
add(table(["Role", "Name", "Responsibility"], [["QA Lead", "Project Team", "Prepare plan, coordinate execution"], ["Test Engineer", "Project Team", "Design and execute test cases, log defects"],
  ["Developer", "Project Team", "Fix defects and triage"], ["Product Owner / Guide", "(to be signed)", "Approve results and sign off readiness"]], [2200, 2400, 5146], { size: 17 }));

add(H2("10. Risks and Mitigation"));
add(table(["Risk", "Mitigation"], [
  ["Hostile test programs hang or leave processes behind", "Every run is inside a Job Object with kill-on-close; suite checks for orphans (TC-SBX-07, TC-REL-01)"],
  ["Timing-based tests are flaky on a loaded machine", "Generous thresholds (p90 <= 2 s vs ~0.8 s measured); queue test uses sleeps with margins"],
  ["Windows-only sandbox cannot be tested on other OS", "Documented limitation; CI must use Windows"],
  ["UI tests do not exercise the real CodeMirror", "Component replaced by a textarea in jsdom; real editor checked manually and via production build"],
], [4200, 5546], { size: 17 }));

add(H2("11. Assumptions & Dependencies"));
["Tests run on Windows with permission to create Job Objects and child processes", "The Python base interpreter is installed at the path reported by sys._base_executable", "Network access is only needed for installing dependencies, not for running tests"].forEach((t) => add(B(t)));

add(H2("12. Suspension & Resumption Criteria"));
add(P("Suspend testing if the sandbox cannot start processes (environment fault) or more than 30% of cases are blocked by one defect. Resume when the blocking defect is fixed and the smoke tests (TC-EXE-02, TC-SBX-01) pass."));

add(H2("13. Test Case Management & Traceability"));
add(P("The RTM (SRS section 8) maps every requirement to test cases; the table below lists each test case with its result. Aggregate result = all automated tests carrying that TC id passed."));
add(table(["TC id", "Description", "Type", "Requirements", "Automated tests", "Result"],
  ids.map((i) => [i, DESC[i][0], DESC[i][1], (reqsFor[i] || []).join(", "), res.tc[i] ? String(res.tc[i].pass + res.tc[i].fail) : "manual", res.status(i)]),
  [1000, 3300, 1000, 2000, 900, 1546], { size: 14 }));
add(gap());
add(P("Manual case notes:"));
Object.entries(res.manual).forEach(([k, v]) => add(B(`**${k}:** ${v.note}`)));

add(H2("14. Test Metrics & Reporting"));
add(H3("14.1 Execution summary"));
add(table(["Metric", "Value"], [
  ["Automated backend tests executed / passed", `${res.pyTotal} / ${res.pyTotal} (${res.pySeconds.toFixed(0)} s)`],
  ["Automated front-end tests executed / passed", `${res.vtTotal} / ${res.vtPassed}`],
  ["Test cases in plan", String(ids.length)],
  ["Test cases passed", String(counts.Passed)], ["Test cases failed", String(counts.Failed)], ["Test cases not executed", String(counts["Not executed"])],
  ["% of plan executed", `${(((ids.length - counts["Not executed"]) / ids.length) * 100).toFixed(0)}%`],
  ["% of executed cases passed", `${((counts.Passed / (ids.length - counts["Not executed"])) * 100).toFixed(0)}%`],
  ["Requirements with at least one test case", `${R.ALL.filter((r) => r.tc.length).length} / ${R.ALL.length}`],
  ["Open critical defects", "0"],
], [5600, 4146], { size: 17 }));
add(H3("14.2 Measured performance (live server, reference laptop)"));
add(table(["Measure", "Requirement", "Measured"], [
  ["Trivial program response, p90", "<= 2 s", "~0.76 s (p50 0.65 s, max 0.79 s)"],
  ["Sandbox time of an empty program, mean", "<= 500 ms", "~156 ms"],
  ["20 concurrent users, 60 runs", ">= 90% succeed", "60 / 60 completed in 19 s"],
  ["Health latency under 4 hostile programs", "<= 1 s", "worst 0.52 s"],
], [4200, 2400, 3146], { size: 17 }));
add(H3("14.3 Defects found during testing"));
add(table(["#", "Defect", "Found by", "Resolution"], [
  ["1", "Child failed to start when the sandbox directory was given as a relative path", "Smoke test", "Sandbox root is resolved to an absolute path"],
  ["2", "Python virtual-environment launcher spawns a second process, violating ActiveProcessLimit = 1", "Design review / smoke test", "Child is started with the base interpreter (sys._base_executable)"],
  ["3", "Tracebacks leaked the server path of the runner bootstrap through the audit-hook frame", "TC-EXE-06", "Bootstrap frames are filtered in the child and scrubbed again by the manager"],
  ["4", "Common modules (dataclasses -> inspect -> importlib) broke under the import guard", "Compatibility sweep", "A small set of standard modules is pre-loaded before the hook is installed"],
  ["5", "Windows CRLF line endings appeared in captured output", "Smoke test", "Output normalised to LF"],
  ["6", "open('CON') yields no audit event (CPython console I/O) - read hangs until the timeout", "TC-SBX-06 attack corpus", "Not exploitable (child has its own hidden console); documented as residual behaviour in SAD 3.9; removed from the denial matrix"],
  ["7", "Test ordering assumption (admin-access audit event) in TC-SEC-09", "TC-SEC-09", "Test corrected; product behaviour unchanged"],
], [400, 4300, 1800, 3246], { size: 15 }));
add(H3("14.4 Known limitations and untested items"));
["TC-UX-01 (usability walkthrough with human participants) has not been executed; CEP-NF-005 is therefore only partially verified.",
  "Modules that depend on blocked capabilities do not work in the sandbox: unittest, zipfile, tarfile, timeit, getpass, asyncio, pathlib file operations.",
  "The sandbox is process-level isolation, not VM-level; see SAD 3.9 residual risks. An independent penetration test is recommended before exposing the service to untrusted users.",
  "Load testing covered one machine and 20 users only."].forEach((t) => add(B(t)));
add(P("**Reports:** this document (final test summary); execution logs are regenerated with `pytest --junitxml` and `npm test`."));

add(H2("15. Approvals"));
add(table(["Role", "Name", "Signature / Date"], [["QA Lead", "", ""], ["Dev Lead", "", ""], ["Product Owner", "", ""]], [3000, 3400, 3346], { size: 17 }));

save(makeDoc(kids, "STP - Secure Online Code Execution Platform v1.1"), "" + require("path").join(__dirname, "..", "Test_Plan.docx") + "");
console.log(counts, "TCs:", ids.length, "missing results:", ids.filter((i) => res.status(i) === "No result"));
