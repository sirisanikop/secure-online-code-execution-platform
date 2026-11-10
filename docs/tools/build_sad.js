const path = require("path");
const L = require("./lib");
const { P, H1, H2, H3, B, N, CODE, table, gap, img, makeDoc, save, SUB, Paragraph, TextRun } = L;

const DATE = "29-10-2026";
const kids = [];
const add = (...x) => x.flat().forEach((e) => kids.push(e));

add(new Paragraph({ style: "Title", children: [new TextRun("Software Architecture and Design Specification")] }));
add(P("**Project:** Secure Online Code Execution Platform (CodeBox)"));
add(P("**Version:** 1.1"));
add(P("**Authors:** SE Mini Project Team"));
add(P("**Date:** " + DATE));
add(P("**Status:** Baselined - reflects the implemented system"));

add(H1("Revision History"));
add(table(["Version", "Date", "Author", "Change Summary"], [
  ["1.0", "13-10-2026", "Project Team", "Initial architecture and design"],
  ["1.1", DATE, "Project Team", "Aligned with the implementation: sandbox details, policy lists, measured values, additional ADRs, residual risks found in testing"],
], [1200, 1500, 2000, 5046], { size: 18 }));
add(H1("Approvals"));
add(table(["Role", "Name", "Signature/Date"], [["Project Guide", "", ""], ["Team Lead", "", ""], ["QA Lead", "", ""]], [2800, 3400, 3546], { size: 18 }));

add(H1("1. Introduction"));
add(H3("1.1 Purpose"));
add(P("This document specifies the architecture and design of the Secure Online Code Execution Platform: a web application that lets users write Python programs and run them in an isolated environment with enforced time and resource limits, while protecting the host server from unsafe code."));
add(H3("1.2 Scope"));
add(P("Covers the React front end, the FastAPI back end, the sandbox execution subsystem, the SQLite data store and the security architecture. Excludes container/VM isolation, other programming languages and multi-server deployment (listed under future work)."));
add(H3("1.3 Audience"));
add(P("Developers, QA engineers, security reviewers, project guides and maintenance teams."));
add(H3("1.4 Definitions"));
add(P("API, ADR (architecture decision record), JWT, ORM, Job Object, audit hook, STRIDE, RBAC, SPA, SRS, STP, RTM. See Appendix 5.1 for the glossary."));

add(H1("2. Document Overview"));
add(H3("2.1 How to use this document"));
add(P("Section 3 explains the architecture (components, pattern, technology, risks, security). Section 4 gives the detailed design: data model, sandbox algorithm, sequence diagrams, API definitions, error handling and UX. Requirement IDs (CEP-F-###, CEP-NF-###, CEP-SR-###) refer to the SRS; design-spec IDs (DS-xxx-##) are defined in section 3.8."));
add(H3("2.2 Related Documents"));
add(P("SRS (docs/SRS.docx), Software Test Plan with results (docs/Test_Plan.docx), PROJECT_DETAILS.md, HOW_TO_RUN.md."));

add(H1("3. Architecture"));
add(H3("3.1 Goals & Constraints"));
add(B("**Goals:** (1) never let user code harm the host; (2) deterministic enforcement of time, memory, process and output limits; (3) responsive, simple user experience; (4) easy to install and run on a student's Windows machine; (5) every security-relevant event is auditable."));
add(B("**Constraints:** no Docker/VM; Windows host; Python only; single-machine deployment; SQLite storage; limited project time, so mature libraries are preferred over custom components."));
add(H3("3.2 Stakeholders & Concerns"));
add(table(["Stakeholder", "Concerns"], [
  ["Learners", "Fast feedback, clear errors, privacy of their code and history"],
  ["Administrators / operators", "Host safety, observability, easy configuration, no orphan processes"],
  ["Security reviewers", "Isolation strength, defence in depth, honest statement of residual risk"],
  ["Developers / maintainers", "Modularity, testability, small and understandable code base"],
  ["Evaluators", "Traceability from requirements to design to tests, demonstrable attack resistance"],
], [3000, 6746], { size: 18 }));

add(H2("3.3 Component (UML) Diagram"));
add(P("The system is organised in four tiers. The sandbox tier is isolated from the application tier by an operating-system process boundary."));
add(img("component_diagram.png", 640, 760, "Figure 3.1 - Component diagram"));

add(H2("3.4 Component Descriptions"));
add(table(["Component", "Responsibility", "Key interfaces"], [
  ["React SPA", "Login/registration, code editor (CodeMirror), output panel, history and admin pages; keeps the JWT in sessionStorage", "REST API client (fetch)"],
  ["Auth Router / Auth Service", "Register, login, token issue and verification, login throttling, admin seeding", "POST /api/auth/register, /login, GET /me"],
  ["Execution Router", "Receives submissions, returns results, serves history", "POST/GET/DELETE /api/executions"],
  ["Execution Service", "Orchestrates one run: size check -> rate limit -> validate -> sandbox -> persist -> audit", "execute(db, user, code, stdin, ip)"],
  ["Code Validator", "AST-based static policy check; returns Allowed or Blocked(reason)", "validate(source) -> Verdict"],
  ["Rate Limiter", "In-memory sliding-window counters per user and per username/IP", "check / peek_blocked / record"],
  ["Sandbox Manager", "Bounded worker pool; creates work dir; launches child; enforces wall-clock timeout; collects output; cleans up", "run(source, stdin, limits) -> RunResult"],
  ["Job Object Controller", "Creates a Windows Job Object with memory, process-count, CPU-time, UI-restriction and kill-on-close limits and assigns the child to it", "JobObject(...).assign / terminate / peak_memory_kb"],
  ["Runner Bootstrap", "Script executed inside the child before user code: pre-loads standard modules, installs audit hook and import guard, then runs the user program in a fresh __main__ module", "python -I -S -B -u -X utf8 runner_bootstrap.py main.py"],
  ["Audit Logger", "Writes security events to audit_events and purges events older than the retention window", "log(db, type, user, detail, ip)"],
  ["Admin Router", "Audit events and statistics for administrators", "GET /api/admin/*"],
  ["SQLAlchemy ORM + SQLite", "Persistence of users, executions and audit events with parameterised queries", "Session, models"],
], [2200, 4800, 2746], { size: 16 }));

add(H2("3.5 Chosen Architecture Pattern and Rationale"));
add(P("A **layered monolith** (presentation, application, sandbox, data) with a REST boundary between the SPA and the server was chosen. The server is a single deployable unit, which keeps installation trivial for the project environment, while the sandbox is a separate OS process so that a failure or attack in user code cannot corrupt the server. Microservices and message queues were rejected as unnecessary for a single-machine scale and the project's time budget."));
add(P("Architecture decision records:"));
add(table(["ADR", "Decision", "Alternatives considered", "Rationale"], [
  ["ADR-1", "Isolate by child process + Windows Job Object + hardened interpreter", "Docker; WSL2; RestrictedPython; in-process exec()", "Docker is unavailable by project decision. exec() or RestrictedPython run inside the server and are known to be bypassable. A Job Object gives kernel-enforced limits and tree-kill."],
  ["ADR-2", "Add a CPython audit hook plus import guard inside the child", "AST blocklist only", "Static checks are easy to evade (getattr, string tricks). The audit hook sees the real events (open, socket.connect, subprocess.Popen, ctypes.dlopen...) and cannot be removed by user code. Confirmed by the 40-program attack corpus."],
  ["ADR-3", "Synchronous request/response with a bounded worker pool (4 slots, queue 20)", "Celery/Redis queue; WebSockets", "Runs are at most 5 s so a blocking response is adequate and far simpler; the semaphore gives back-pressure."],
  ["ADR-4", "SQLite via SQLAlchemy", "PostgreSQL, MySQL", "Zero-install, file based; ORM keeps the switch to another DB a configuration change."],
  ["ADR-5", "Stateless JWT bearer tokens", "Server sessions + cookies", "Simple SPA integration, no session store; short expiry limits exposure. Token kept in sessionStorage."],
  ["ADR-6", "React + Vite SPA with CodeMirror 6", "Monaco editor; server-rendered templates", "Required by project decision; CodeMirror is small and fast to load."],
  ["ADR-7", "Deny all file writes and non-sandbox reads in user code", "Allow writes inside temp dir", "A 5-second program can write gigabytes; denying writes removes the disk-exhaustion risk entirely."],
  ["ADR-8", "Start the child with the BASE interpreter, not the virtual-environment launcher", "venv python.exe", "The venv launcher spawns the real interpreter as a second process, which violates ActiveProcessLimit = 1 (found during smoke testing)."],
  ["ADR-9", "Pre-load a small set of standard modules before installing the hook", "Allow every transitive import", "dataclasses -> inspect -> importlib would otherwise hit the import guard; pre-loading keeps common programs working while user imports of blocked modules still fail."],
], [800, 2500, 2300, 4146], { size: 16 }));

add(H2("3.6 Technology Stack & Data Stores"));
add(table(["Layer", "Technology", "Notes"], [
  ["Front end", "React 18, Vite 5, CodeMirror 6 (@uiw/react-codemirror), React Router 6, fetch API", "Plain CSS; no UI framework"],
  ["Back end", "Python 3.11+, FastAPI, Uvicorn, Pydantic v2", "Automatic OpenAPI docs at /docs"],
  ["Security libs", "bcrypt, PyJWT", "bcrypt cost 12 (4 in tests); HS256 tokens"],
  ["Persistence", "SQLAlchemy 2.x ORM, SQLite (WAL mode)", "File: backend/data/codebox.db"],
  ["Sandbox", "subprocess, ctypes (kernel32 Job Object API, ntdll NtResumeProcess), sys.addaudithook", "No third-party dependency; Windows only"],
  ["Testing", "pytest + httpx TestClient + live uvicorn; Vitest + React Testing Library", "103 backend and 8 front-end tests"],
  ["Tooling", "Node.js, npm; diagrams drawn with matplotlib; documents generated with docx-js", ""],
], [1700, 4600, 3446], { size: 17 }));

add(H2("3.7 Risks & Mitigations"));
add(table(["ID", "Risk", "Likelihood / Impact", "Mitigation"], [
  ["R1", "Sandbox escape via a bypass of the audit hook or an allowed native module", "Medium / High", "Layered defence (3.9); deny ctypes and native-extension events; hook binds all builtins it uses; run server under a low-privilege account; document as residual risk; recommend Docker/VM for production."],
  ["R2", "Resource exhaustion (CPU, memory, fork bomb, output flood)", "High / Medium", "Job Object limits, wall-clock timer, output caps, worker pool and queue limit, per-user rate limit. Verified by TC-SBX-01..04 and TC-REL-01."],
  ["R3", "Race between process start and Job assignment", "Low / Medium", "Create the process suspended, assign to the job, then resume (NtResumeProcess)."],
  ["R4", "Orphan processes or temp files after a crash", "Medium / Medium", "KILL_ON_JOB_CLOSE, try/finally cleanup, start-up sweep of the temp root. Verified by TC-SBX-07."],
  ["R5", "Credential theft or brute force", "Medium / High", "bcrypt, throttling, generic errors, short-lived tokens, audit log."],
  ["R6", "Cross-user data leakage", "Low / High", "Owner check on every query; 404 instead of 403 to avoid enumeration."],
  ["R7", "Windows-specific code is hard to test on other machines", "Medium / Low", "All Win32 calls isolated in job_object.py; documented requirement for a Windows host."],
  ["R8", "Time overrun of the project", "Medium / Medium", "Four sequential tasks, requirements prioritised (High items first)."],
], [600, 3400, 1500, 4246], { size: 16 }));

add(H2("3.8 Traceability to Requirements"));
add(P("Design-spec IDs map the requirements to the design elements below. The full requirement-to-design-to-test mapping is the RTM in SRS section 8."));
add(table(["Design spec", "Design element", "Section", "Requirements realised"], [
  ["DS-AUTH-01", "Auth Service: registration, bcrypt, JWT issue/verify", "4.3", "CEP-F-001,002,003,005; CEP-SR-002,003"],
  ["DS-AUTH-02", "Login throttling and rate limiter", "4.1", "CEP-F-004; CEP-SR-010"],
  ["DS-EXE-01", "Execution Service orchestration and status mapping", "4.1, 4.2", "CEP-F-010,012,018"],
  ["DS-EXE-02", "Worker pool and queue", "4.1", "CEP-F-016; CEP-NF-008"],
  ["DS-VAL-01", "AST code validator and policy lists", "4.1", "CEP-F-024"],
  ["DS-SBX-01", "Process launch, Job Object limits, temp dir, cleanup", "4.1", "CEP-F-011,017,020,021,026; CEP-NF-001,002,004; CEP-SR-001,006"],
  ["DS-SBX-02", "Runner bootstrap, audit hook, import guard", "4.1", "CEP-F-023,025; CEP-NF-003; CEP-SR-007"],
  ["DS-SBX-03", "Output capture, caps, stats, stdin", "4.1", "CEP-F-013,014,015,022"],
  ["DS-HIS-01", "Execution persistence and owner-scoped queries", "4.1, 4.3", "CEP-F-030..033; CEP-SR-004"],
  ["DS-UI-01 / 02", "Editor, output, auth and history pages", "4.5", "CEP-F-040..043; CEP-NF-005"],
  ["DS-ADM-01", "Admin router (audit events, statistics, RBAC)", "4.3", "CEP-F-050,051,052"],
  ["DS-SEC-01", "Validation, CORS, headers", "3.9, 4.4", "CEP-SR-005,008"],
  ["DS-AUD-01", "Audit logger", "4.1", "CEP-NF-007; CEP-SR-009"],
  ["DS-DATA-01", "Data model (users, executions, audit_events)", "4.1", "CEP-F-030; CEP-NF-007"],
  ["DS-OPS-01", "Configuration through environment variables", "4.1", "CEP-NF-006"],
], [1500, 4000, 1200, 3046], { size: 16 }));

add(H2("3.9 Security Architecture"));
add(SUB("Trust boundaries"));
add(B("**Boundary A:** Internet/browser -> API. Everything arriving is untrusted; validated and authenticated."));
add(B("**Boundary B:** server process -> sandbox child process. User code and everything it prints is untrusted."));
add(B("**Boundary C:** sandbox child -> host OS. Crossed only through the limited operations the audit hook and Job Object allow."));
add(SUB("Defence in depth"));
add(img("defence_layers.png", 600, 520, "Figure 3.2 - Six defence layers"));
add(SUB("Threat modelling (STRIDE)"));
add(table(["Threat", "Example in this system", "Mitigation"], [
  ["Spoofing", "Forged or stolen token; credential stuffing", "HS256 signed short-lived JWT, bcrypt, login throttling, generic error messages"],
  ["Tampering", "Code modifies server files or other users' data; altered request bodies", "No file writes or out-of-sandbox reads in the child; schema validation; ORM parameterised queries; owner checks"],
  ["Repudiation", "User denies submitting malicious code", "audit_events with user, IP, type, time; executions store the exact code"],
  ["Information disclosure", "Program reads server secrets, env vars, DB file, other users' code; verbose errors leak paths", "Clean child environment, audit-hook read restriction, owner-scoped queries, sanitised tracebacks and error bodies"],
  ["Denial of service", "while True, memory bomb, fork bomb, output flood, request flood", "Wall-clock + CPU limit, Job memory limit, ActiveProcessLimit 1, 64 KB output caps, worker pool + queue limit, per-user rate limit"],
  ["Elevation of privilege", "Sandbox escape; normal user calls admin API", "Layered sandbox; runs under non-admin account; is_admin RBAC check against the database (token claim not trusted) returning 403; no shell or ctypes in child"],
], [1700, 3600, 4446], { size: 16 }));
add(SUB("Residual risks (stated honestly)"));
add(B("A subprocess sandbox shares the host kernel. A vulnerability in CPython, an allowed standard-library C extension, or the Windows kernel could allow escape; containers or VMs are stronger and are the recommended production upgrade."));
add(B("Audit hooks are a policy mechanism inside the interpreter, not a kernel boundary; the combination with the Job Object and static checks is what provides defence in depth. The hook binds every builtin it needs as a local, and the gc and importlib modules are blocked, to prevent user code from reaching or patching it."));
add(B("**Console devices:** open('CON') uses CPython's console I/O class, which raises no audit event, so the hook cannot veto it. It only reaches the child's own hidden console (CREATE_NO_WINDOW), never the server's, and a blocked read ends at the time limit. Discovered by the attack corpus (STP defect 6)."));
add(B("Reads of the Python installation directory are required for imports and are therefore permitted (read-only)."));
add(B("**Compatibility cost of the policy:** modules that need blocked capabilities do not work inside the sandbox (unittest, zipfile, tarfile, timeit, getpass, asyncio, shutil, tempfile, sqlite3, pickle, socket-based modules). Setting environment variables (os.environ[...] = ...) is denied."));
add(B("The platform must not be run under an administrator account; this is documented in HOW_TO_RUN.md. No independent penetration test has been performed."));

add(H1("4. Design"));
add(H2("4.1 Design Overview"));
add(H3("4.1.1 Module / package structure"));
add(CODE(
`backend/
  run.py                 start the server (uvicorn, app factory)
  app/
    main.py              FastAPI app factory, CORS, error handlers, SPA hosting
    config.py            Settings from environment (limits, secrets)
    database.py          Engine (SQLite WAL), session factory
    models.py            User, Execution, AuditEvent (SQLAlchemy)
    schemas.py           Pydantic request/response models and validation rules
    security.py          bcrypt hashing, JWT encode/decode
    deps.py              get_db, get_current_user, require_admin
    errors.py            AppError + uniform error body
    create_admin.py      CLI to create/promote an administrator
    routers/             auth.py  executions.py  admin.py  meta.py
    services/            auth_service.py  execution_service.py
                         validator.py  rate_limiter.py  audit.py
    sandbox/             manager.py  job_object.py  runner_bootstrap.py
  tests/                 pytest suite (103 tests) incl. live-server tests
frontend/
  src/                   api.js  AuthContext.jsx  App.jsx
                         pages/ (Auth, Editor, History, Admin)  components/  test/
docs/                    SRS, SAD, Test Plan, diagrams, tools (document generators)`));
add(gap());
add(H3("4.1.2 Data model"));
add(img("er_diagram.png", 620, 420, "Figure 4.1 - Entity-relationship diagram"));
add(table(["Table", "Notes"], [
  ["users", "username unique, stored lower-case (case-insensitive), password_hash (bcrypt), is_admin flag, created_at"],
  ["executions", "Owner user_id (FK, cascade delete), code, stdin, status, stdout, stderr (each at most 64 KB), exit_code, runtime_ms, peak_mem_kb, blocked_reason, created_at; index on (user_id, created_at)"],
  ["audit_events", "event_type (LOGIN_FAILED, LOGIN_THROTTLED, BLOCKED_CODE, TIMEOUT, MEMORY_LIMIT, OUTPUT_LIMIT, RATE_LIMITED, ADMIN_ACCESS), nullable user_id, detail, ip_address, created_at"],
], [1800, 7946], { size: 17 }));
add(gap());
add(H3("4.1.3 Execution status model"));
add(table(["Status", "Meaning", "Determined by"], [
  ["COMPLETED", "Exit code 0 within all limits", "Exit code, no limit flag"],
  ["RUNTIME_ERROR", "Non-zero exit code or uncaught exception (including syntax error and PermissionError from the hook)", "Exit code != 0 and not killed by a limit"],
  ["TIMEOUT", "Exceeded 5 s wall-clock or CPU time", "Watchdog timer (wait timeout) or Job CPU-limit backstop (limit + 1 s)"],
  ["MEMORY_LIMIT", "Exceeded 128 MB", "Allocation fails under the Job memory limit -> MemoryError (or peak >= 90% of limit)"],
  ["OUTPUT_LIMIT", "stdout or stderr exceeded 64 KB", "Reader thread counter; process tree killed"],
  ["BLOCKED", "Rejected by static policy; never started", "Code Validator verdict"],
  ["INTERNAL_ERROR", "Platform failure (could not start child, etc.)", "Exception in Sandbox Manager; details logged, generic message returned"],
], [1700, 4600, 3446], { size: 17 }));
add(gap());
add(H3("4.1.4 Configuration (environment variables, defaults)"));
add(table(["Variable", "Default", "Purpose"], [
  ["EXEC_TIMEOUT_SECONDS", "5", "Wall-clock limit per run (CPU backstop = +1 s)"],
  ["EXEC_MEMORY_LIMIT_MB", "128", "Job Object process memory limit"],
  ["EXEC_OUTPUT_LIMIT_BYTES", "65536", "Per-stream output cap"],
  ["MAX_CODE_BYTES / MAX_STDIN_BYTES", "51200 / 16384", "Input size caps"],
  ["MAX_CONCURRENT_RUNS / MAX_QUEUE_LENGTH", "4 / 20", "Worker pool and queue"],
  ["RATE_LIMIT_RUNS_PER_MIN", "10", "Per-user execution rate"],
  ["LOGIN_MAX_FAILURES / LOGIN_LOCK_MINUTES", "5 / 5", "Brute-force throttling"],
  ["JWT_SECRET, JWT_EXPIRE_MINUTES", "(random if unset) / 60", "Token signing and lifetime"],
  ["BCRYPT_ROUNDS", "12", "Password hash cost"],
  ["ADMIN_USERNAME / ADMIN_PASSWORD", "(unset)", "Seeds or promotes an administrator at start-up"],
  ["FRONTEND_ORIGIN, DATABASE_URL, SANDBOX_ROOT, AUDIT_RETENTION_DAYS", "http://localhost:5173, sqlite file, backend/data/sandbox_tmp, 90", "CORS, storage, work area, audit retention"],
], [3600, 2200, 3946], { size: 17 }));
add(gap());
add(H3("4.1.5 Sandbox design (core of the system)"));
add(P("Algorithm for one execution, performed by the Sandbox Manager after the Code Validator has accepted the source:"));
[
  "Acquire a worker slot from a bounded semaphore (4); if 20 requests are already waiting (or the wait exceeds 60 s), fail fast with 503.",
  "Create a private temporary directory; write main.py (user code). Nothing else is copied in; stdin is streamed through a pipe.",
  "Build a minimal environment: SystemRoot, TEMP and TMP set to the work dir, PYTHONDONTWRITEBYTECODE; no server variables.",
  "Create a Job Object with: ProcessMemoryLimit = 128 MB, ActiveProcessLimit = 1, PerProcessUserTimeLimit = timeout + 1 s (backstop), KILL_ON_JOB_CLOSE, DIE_ON_UNHANDLED_EXCEPTION, and all UI restrictions (clipboard, desktop, handles...).",
  "Start the base python.exe with -I -S -B -u -X utf8 runner_bootstrap.py <main.py>, cwd = work dir, piped stdin/stdout/stderr, no inherited handles, flags CREATE_SUSPENDED | CREATE_NO_WINDOW; assign it to the Job Object, then resume it (NtResumeProcess).",
  "Inside the child, the bootstrap (a) reads and compiles the program, (b) pre-loads a few standard modules, (c) pops blocked modules from sys.modules, (d) installs the audit hook / import guard, (e) executes the program in a fresh __main__ module and prints sanitised tracebacks.",
  "Two reader threads drain stdout and stderr, counting bytes; when a stream passes 64 KB the process tree is killed and the status becomes OUTPUT_LIMIT. The main thread waits at most 5 s and then terminates the job (TIMEOUT).",
  "On exit, read the job accounting (peak memory) and map exit code and flags to a status (4.1.3); output is normalised to LF and server paths are scrubbed from stderr.",
  "In a finally block: terminate the job, close pipes and handles, delete the temp directory, release the worker slot. Return RunResult.",
].forEach((t) => add(N(t)));
add(gap());
add(SUB("Static policy (Code Validator, DS-VAL-01)"));
add(table(["Rule class", "Blocked items (default policy)"], [
  ["Imports", "subprocess, socket, ssl, http, urllib, ftplib, smtplib, poplib, imaplib, telnetlib, xmlrpc, socketserver, requests, ctypes, cffi, multiprocessing, signal, shutil, tempfile, glob, sqlite3, pickle, marshal, shelve, dbm, importlib, runpy, code, codeop, pty, fcntl, mmap, resource, webbrowser, builtins, gc, _winapi, msvcrt, winreg, winsound, pdb, bdb, trace, cProfile, profile, asyncio, ensurepip, venv; relative imports"],
  ["Built-in names", "eval, exec, compile, open, __import__, breakpoint, globals, vars, __builtins__, __loader__, __spec__"],
  ["Attribute access", "__subclasses__, __globals__, __builtins__, __code__, __bases__, __mro__, __closure__, __loader__, f_globals, f_locals, f_builtins, f_back, gi_frame, gi_code, cr_frame, cr_code, ag_frame, tb_frame; getattr/setattr/delattr/hasattr with a constant string beginning '__'"],
  ["Unanalysable source", "ast.parse failing with RecursionError / MemoryError / ValueError is BLOCKED; plain SyntaxError is passed through so Python reports it normally"],
], [2200, 7546], { size: 16 }));
add(gap());
add(SUB("Runtime policy (audit hook and import guard, DS-SBX-02)"));
add(table(["Audit event / action", "Decision"], [
  ["open (read) of the work dir or the Python installation directories", "Allow (read-only)"],
  ["open of any other path; any write / append / create / exclusive mode or flag; Windows device names (CON, NUL, COMn...) and alternate data streams in paths that do raise an event", "Deny - PermissionError"],
  ["socket.*, ssl, http, urllib and similar prefixes", "Deny"],
  ["subprocess.Popen, os.system, os.exec*, os.spawn*, os.posix_spawn, os.fork, os.startfile, _winapi.*", "Deny"],
  ["ctypes.* (dlopen, dlsym, cdata, string_at...), msvcrt.*, winreg.*, mmap.*, multiprocessing.*", "Deny"],
  ["os.remove, rename, replace, mkdir, rmdir, chmod, chown, link, symlink, truncate, utime, putenv, unsetenv, kill, chdir, add_dll_directory", "Deny"],
  ["os.listdir / os.scandir outside the allowed roots", "Deny"],
  ["import of a blocked module (guard on the 'import' event), code.__new__, sys.settrace, sys.setprofile", "Deny"],
  ["Everything else (math, string, list, dict, time, random, collections, itertools, json, re, datetime, dataclasses, threading, queue, ...)", "Allow"],
], [5800, 3946], { size: 16 }));
add(gap());

add(H2("4.2 UML Sequence Diagrams"));
add(P("Three flows specific to the platform are shown: authentication, code execution (the core flow including policy and limit handling) and history management."));
add(img("seq_auth.png", 560, 700, "Figure 4.2 - Sequence: registration and login"));
add(img("seq_execute.png", 640, 800, "Figure 4.3 - Sequence: code execution"));
add(img("seq_history.png", 560, 560, "Figure 4.4 - Sequence: history list and delete"));

add(H2("4.3 API Design"));
add(P("All endpoints are under /api, exchange JSON and are documented by OpenAPI at /docs. Authenticated endpoints expect the header Authorization: Bearer <token>."));
add(table(["Method", "Path", "Auth", "Purpose", "Success"], [
  ["POST", "/api/auth/register", "None", "Create account", "201"],
  ["POST", "/api/auth/login", "None", "Obtain JWT", "200"],
  ["GET", "/api/auth/me", "User", "Current user profile", "200"],
  ["POST", "/api/executions", "User", "Run code", "200"],
  ["GET", "/api/executions", "User", "List own runs (limit, offset)", "200"],
  ["GET", "/api/executions/{id}", "User", "Run detail (owner only)", "200"],
  ["DELETE", "/api/executions/{id}", "User", "Delete run (owner only)", "204"],
  ["GET", "/api/limits", "None", "Published limits for the UI", "200"],
  ["GET", "/api/health", "None", "Liveness probe", "200"],
  ["GET", "/api/admin/audit-events", "Admin", "Audit events (type, from, to, limit, offset)", "200"],
  ["GET", "/api/admin/stats", "Admin", "Totals per status, users, active users, queue", "200"],
], [900, 2700, 900, 3946, 1300], { size: 17 }));
add(gap());
add(H3("Component interface 1: Auth Router"));
add(CODE(
`POST /api/auth/register
  Request : { "username": "alice", "password": "Passw0rd!" }
  Response: 201 { "id": 7, "username": "alice", "is_admin": false }
  Errors  : 409 Username already taken
            422 Validation error (length / strength rules)

POST /api/auth/login
  Request : { "username": "alice", "password": "Passw0rd!" }
  Response: 200 { "access_token": "<jwt>", "token_type": "bearer", "expires_in": 3600 }
  Errors  : 401 Invalid credentials          (generic, no user enumeration)
            429 Too many failed attempts     (Retry-After header)`));
add(gap());
add(H3("Component interface 2: Execution Router"));
add(CODE(
`POST /api/executions        (Authorization: Bearer <jwt>)
  Request : { "code": "print(input())", "stdin": "hello\\n" }
  Response: 200 {
              "id": 128, "status": "COMPLETED",
              "stdout": "hello\\n", "stderr": "", "exit_code": 0,
              "runtime_ms": 156, "peak_mem_kb": 9120,
              "blocked_reason": null, "created_at": "2026-10-29T10:15:02Z"
            }
  Errors  : 401 Missing/invalid token
            413 Code or stdin too large
            422 Validation error
            429 Rate limit exceeded           (Retry-After header)
            503 Server busy, queue full

  Note: a program that times out, is blocked or errors is still a 200
        response; the outcome is carried in "status".

GET /api/executions?limit=20&offset=0
  Response: 200 { "items": [ { "id", "status", "runtime_ms", "created_at", "code_preview" } ], "total": 57 }`));
add(gap());
add(H3("Component interface 3: Sandbox Manager (internal Python interface)"));
add(CODE(
`class SandboxManager:
    def run(self, source: str, stdin: str, limits: Limits) -> RunResult: ...   # raises SandboxBusy when the queue is full

@dataclass
class Limits:  timeout_s: float; memory_mb: int; output_bytes: int

@dataclass
class RunResult:
    status: str               # COMPLETED | RUNTIME_ERROR | TIMEOUT | MEMORY_LIMIT | OUTPUT_LIMIT | BLOCKED | INTERNAL_ERROR
    stdout: str; stderr: str; exit_code: int | None
    runtime_ms: int; peak_mem_kb: int | None; blocked_reason: str | None`));
add(gap());

add(H2("4.4 Error Handling, Logging & Monitoring"));
add(B("**Uniform error body:** { \"error\": { \"code\": \"RATE_LIMITED\", \"message\": \"Too many runs, retry in 12 s\" } } with the proper HTTP status; stack traces are never returned."));
add(B("**Status code policy:** 422 validation, 401 authentication, 403 authorisation, 404 not found or not owner, 409 conflict, 413 too large, 429 throttled, 503 busy, 500 unexpected (generic message, details in server log)."));
add(B("**Sanitised tracebacks:** the runner filters its own frames and the manager scrubs the work-directory and runner paths from stderr; server paths never appear (TC-EXE-06)."));
add(B("**Logging:** application log via the standard logging module; no passwords, tokens or full source code in logs. Security events go to audit_events."));
add(B("**Monitoring:** /api/health; /api/admin/stats gives total runs, per-status counts, average runtime, active users and queue length; the admin audit view lists bursts of BLOCKED_CODE or LOGIN_FAILED."));
add(B("**Start-up sweep:** on boot the server deletes stale sandbox temp directories, seeds the administrator and purges audit events older than the retention window."));

add(H2("4.5 UX Design"));
add(P("Primary screen (Editor page):"));
add(CODE(
`+----------------------------------------------------------------------+
| CodeBox        [Editor] [History] [Admin*]            alice  [Logout] |
+----------------------------------------------------------------------+
| main.py                         Limits: 5 s | 128 MB | 64 KB output   |
| +------------------------------------------+ +---------------------+ |
| | 1  name = input("Name? ")                | | Standard input      | |
| | 2  print("Hello,", name)                 | | Ada                 | |
| |                                          | +---------------------+ |
| +------------------------------------------+                         |
| [ Run ]   Ctrl+Enter   (spinner while running)                       |
+----------------------------------------------------------------------+
| [Completed]  Runtime: 156 ms  Memory: 9.1 MB  Exit code: 0           |
| Output                                                               |
|   Name? Hello, Ada                                                   |
| Errors (red, only if present)                                        |
+----------------------------------------------------------------------+`));
add(gap());
["Status shown as a coloured badge with text (green completed, amber limit exceeded, red error/blocked) so colour is never the only signal.",
  "Inline validation on forms; the Run button is disabled while a run is in progress.",
  "Blocked code shows the rule and line that was violated.",
  "Ctrl+Enter runs the code; all controls are reachable by keyboard; ARIA labels on editor, stdin and output; results are announced through an aria-live region.",
  "History page: table (time, status, runtime, preview) with View, Delete and 'Load into editor'."].forEach((t) => add(B(t)));

add(H2("4.6 Open Issues & Next Steps"));
["Resolved: the memory limit was measured; a bare Python process commits about 10-13 MB, so the 128 MB limit leaves ample room.",
  "Resolved: reading the Python installation directory remains allowed (read-only) because imports need it; documented as residual risk.",
  "Open: usability walkthrough with three human participants (TC-UX-01) has not been performed.",
  "Open: independent penetration test before exposing the service to untrusted users.",
  "Future work: Docker/gVisor or Windows Sandbox backend behind the same SandboxManager interface; more languages; asynchronous queue with streaming output; per-user quotas; CAPTCHA on registration; make rate-limiter state shared across multiple server processes."].forEach((t) => add(B(t)));

add(H1("5. Appendices"));
add(H3("5.1 Glossary"));
add(P("**ADR** architecture decision record; **ORM** object-relational mapper; **JWT** JSON Web Token; **Job Object** Windows kernel object enforcing limits on a group of processes; **Audit hook** CPython callback for sensitive runtime events (PEP 578); **STRIDE** threat categories; **RBAC** role-based access control; **SPA** single-page application; **Fork bomb** program that spawns processes exponentially."));
add(H3("5.2 References"));
["IEEE 42010 (architecture description)", "OWASP Top 10 and OWASP ASVS", "NIST SP 800-160 (systems security engineering)", "PEP 578 - Python Runtime Audit Hooks",
  "Microsoft Docs - Job Objects, JOBOBJECT_EXTENDED_LIMIT_INFORMATION", "FastAPI, SQLAlchemy, React, Vite documentation"].forEach((t) => add(B(t)));
add(H3("5.3 Tools"));
add(P("Python, FastAPI/Uvicorn, pytest, Node.js/Vite/Vitest, SQLite, Swagger UI (built into FastAPI), matplotlib for the diagrams, docx-js for generating these documents (docs/tools)."));

save(makeDoc(kids, "SAD - Secure Online Code Execution Platform v1.1"), path.join(__dirname, "..", "SAD.docx"));
