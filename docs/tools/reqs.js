// Single source of truth for requirement IDs, used by SRS, SAD (traceability) and the Test Plan.
// fields: id, text, type, prio, src, ac, tc (array), note, sec (SRS section), module, ds (design spec), short

const F = (id, text, prio, src, ac, tc, note, sec, module, ds, short) =>
  ({ id, text, type: "Functional", prio, src, ac, tc, note, sec, module, ds, short });

const FR = {
  auth: [
    F("CEP-F-001", "The system shall allow a visitor to register an account with a unique username (3-30 characters) and a password of at least 8 characters containing a letter and a digit.", "High", "Business",
      "AC-F-001: Valid details create the account (201); duplicate or invalid details are rejected (409/422).", ["TC-AUTH-01", "TC-AUTH-06"], "Username compared case-insensitively", "4.1", "AuthModule", "DS-AUTH-01", "Register account"),
    F("CEP-F-002", "The system shall store passwords only as salted bcrypt hashes and shall never return or log a password.", "High", "Security",
      "AC-F-002: Database inspection shows only hashes; API responses and logs contain no password.", ["TC-AUTH-02"], "See CEP-SR-002", "4.1", "AuthModule", "DS-AUTH-01", "Hash passwords"),
    F("CEP-F-003", "The system shall authenticate a user by username and password and issue a signed JWT access token valid for 60 minutes.", "High", "Business",
      "AC-F-003: Correct credentials return 200 and a token; the token is rejected after expiry.", ["TC-AUTH-03"], "Expiry configurable", "4.1", "AuthModule", "DS-AUTH-01", "Login / issue JWT"),
    F("CEP-F-004", "The system shall reject invalid credentials with a generic message and temporarily block a username/IP after 5 consecutive failures within 5 minutes.", "High", "Security",
      "AC-F-004: The 6th attempt within the window returns 429 even with the correct password; a LOGIN_FAILED audit event is recorded.", ["TC-AUTH-04"], "Prevents brute force and user enumeration", "4.1", "AuthModule", "DS-AUTH-02", "Login throttling"),
    F("CEP-F-005", "The system shall require a valid token for all execution, history and admin endpoints and respond 401 otherwise.", "High", "Security",
      "AC-F-005: Requests with missing, malformed, expired or tampered tokens return 401.", ["TC-AUTH-05"], "", "4.1", "AuthModule", "DS-AUTH-01", "Token required"),
  ],
  exec: [
    F("CEP-F-010", "The system shall accept Python 3 source code of at most 50 KB and optional standard input of at most 16 KB for execution.", "High", "Business",
      "AC-F-010: Inputs within limits are accepted; larger inputs return 413 with a clear message.", ["TC-EXE-01", "TC-EXE-10"], "Limits configurable", "4.2", "ExecutionModule", "DS-EXE-01", "Accept code + stdin"),
    F("CEP-F-011", "The system shall execute submitted code in a separate, isolated operating-system process and return its standard output, standard error and exit code.", "High", "Business",
      "AC-F-011: print('hi') returns stdout 'hi', stderr empty, exit code 0.", ["TC-EXE-02"], "Never in the server process", "4.2", "SandboxModule", "DS-SBX-01", "Isolated execution"),
    F("CEP-F-012", "The system shall classify every run with exactly one status: COMPLETED, RUNTIME_ERROR, TIMEOUT, MEMORY_LIMIT, OUTPUT_LIMIT, BLOCKED or INTERNAL_ERROR.", "High", "Business",
      "AC-F-012: Each reference program in the test suite maps to the expected status.", ["TC-EXE-03"], "Status table in SAD 4.1", "4.2", "ExecutionModule", "DS-EXE-01", "Status classification"),
    F("CEP-F-013", "The system shall report the wall-clock runtime (ms) and peak memory (KB) of each run.", "Medium", "Business",
      "AC-F-013: Response contains runtime_ms and peak_mem_kb greater than 0 for completed runs.", ["TC-EXE-04"], "", "4.2", "SandboxModule", "DS-SBX-03", "Runtime / memory stats"),
    F("CEP-F-014", "The system shall supply the submitted stdin to the program and deliver end-of-file once it is consumed.", "Medium", "Business",
      "AC-F-014: A program using input() echoes the supplied lines; reading past the end raises EOFError.", ["TC-EXE-05"], "", "4.2", "SandboxModule", "DS-SBX-03", "stdin support"),
    F("CEP-F-015", "The system shall capture syntax errors and uncaught exceptions and return the Python traceback in stderr with status RUNTIME_ERROR.", "High", "Business",
      "AC-F-015: A program raising ZeroDivisionError returns non-zero exit code and the traceback text.", ["TC-EXE-06"], "Tracebacks must not reveal server paths", "4.2", "SandboxModule", "DS-SBX-03", "Capture errors"),
    F("CEP-F-016", "The system shall run at most 4 executions concurrently and queue up to 20 further requests, returning 503 when the queue is full.", "Medium", "Operations",
      "AC-F-016: With 4 long jobs running, 20 requests are queued and the 25th receives 503.", ["TC-EXE-07"], "Protects host CPU/RAM", "4.2", "ExecutionModule", "DS-EXE-02", "Concurrency + queue"),
    F("CEP-F-017", "The system shall give every run a fresh private working directory that is deleted after the run, so that no state persists between runs.", "High", "Security",
      "AC-F-017: A file name written or listed in run N is absent in run N+1; the directory no longer exists after the run.", ["TC-EXE-08"], "", "4.2", "SandboxModule", "DS-SBX-01", "Fresh workdir per run"),
    F("CEP-F-018", "The system shall limit each user to 10 executions per minute and respond 429 when exceeded.", "Medium", "Operations",
      "AC-F-018: The 11th request within 60 s returns 429 with a Retry-After header.", ["TC-EXE-09"], "Sliding window", "4.2", "RateLimiter", "DS-EXE-01", "Rate limit runs"),
  ],
  sbx: [
    F("CEP-F-020", "The system shall terminate a program that exceeds 5 seconds of execution time and report status TIMEOUT.", "High", "Security",
      "AC-F-020: while True: pass is killed within 5.5 s and reported as TIMEOUT.", ["TC-SBX-01"], "Both wall-clock and CPU limit", "4.3", "SandboxModule", "DS-SBX-01", "Time limit"),
    F("CEP-F-021", "The system shall terminate a program whose memory use exceeds 128 MB and report status MEMORY_LIMIT.", "High", "Security",
      "AC-F-021: Allocating a 500 MB list is killed and reported as MEMORY_LIMIT; the server stays healthy.", ["TC-SBX-02"], "Job Object memory limit", "4.3", "SandboxModule", "DS-SBX-01", "Memory limit"),
    F("CEP-F-022", "The system shall cap captured stdout and stderr at 64 KB each, terminate the program when the cap is exceeded and report status OUTPUT_LIMIT.", "High", "Security",
      "AC-F-022: An infinite print loop is stopped; the response is at most 64 KB per stream.", ["TC-SBX-03"], "", "4.3", "SandboxModule", "DS-SBX-03", "Output cap"),
    F("CEP-F-023", "The system shall prevent user code from creating additional processes (fork bombs, subprocess, os.system).", "High", "Security",
      "AC-F-023: Attempts to spawn processes fail or are blocked; the process count of the job never exceeds 1.", ["TC-SBX-04"], "ActiveProcessLimit = 1 plus audit hook", "4.3", "SandboxModule", "DS-SBX-02", "No child processes"),
    F("CEP-F-024", "The system shall statically analyse submitted code before execution and reject code that imports or uses blocked modules or built-ins, returning status BLOCKED with the reason.", "High", "Security",
      "AC-F-024: 'import socket' and 'eval(...)' return BLOCKED naming the rule; the code is never started.", ["TC-SBX-05"], "Policy list in SAD 4.1", "4.3", "ValidatorModule", "DS-VAL-01", "Static policy check"),
    F("CEP-F-025", "The system shall deny user code any network access and any file access outside its working directory, and any file write.", "High", "Security",
      "AC-F-025: Opening C:\\Windows\\win.ini, any file for writing, or a socket fails with PermissionError.", ["TC-SBX-06"], "Runtime audit hook", "4.3", "SandboxModule", "DS-SBX-02", "File / network denial"),
    F("CEP-F-026", "The system shall terminate the whole process tree and release all resources of a run, including when the platform itself raises an error.", "High", "Reliability",
      "AC-F-026: After 100 mixed runs no python.exe child and no temp directory remains.", ["TC-SBX-07"], "KILL_ON_JOB_CLOSE + finally block", "4.3", "SandboxModule", "DS-SBX-01", "Cleanup"),
  ],
  his: [
    F("CEP-F-030", "The system shall persist every execution (code, stdin, status, output, runtime, timestamp) linked to the submitting user.", "High", "Business",
      "AC-F-030: After a run, the record is retrievable by its id.", ["TC-HIS-01"], "", "4.4", "HistoryModule", "DS-HIS-01", "Persist runs"),
    F("CEP-F-031", "The system shall list a user's own executions newest first with pagination.", "Medium", "Business",
      "AC-F-031: GET /api/executions?limit=5&offset=5 returns the second page in descending time order.", ["TC-HIS-02"], "", "4.4", "HistoryModule", "DS-HIS-01", "List history"),
    F("CEP-F-032", "The system shall return the full detail of an execution only to its owner and respond 404 to any other user.", "High", "Security",
      "AC-F-032: User B requesting user A's execution id receives 404.", ["TC-HIS-03"], "Object-level authorisation", "4.4", "HistoryModule", "DS-HIS-01", "Owner-only detail"),
    F("CEP-F-033", "The system shall allow a user to delete their own execution records.", "Low", "Business",
      "AC-F-033: DELETE returns 204 and subsequent GET returns 404.", ["TC-HIS-04"], "", "4.4", "HistoryModule", "DS-HIS-01", "Delete run"),
  ],
  ui: [
    F("CEP-F-040", "The web interface shall provide a code editor with Python syntax highlighting, a standard-input box and a Run button.", "High", "Business",
      "AC-F-040: The three controls are visible on the editor page and Run submits the code.", ["TC-UI-01"], "", "4.5", "FrontendUI", "DS-UI-01", "Editor + Run"),
    F("CEP-F-041", "The web interface shall display stdout, stderr, status badge, runtime and memory for each run, distinguishing errors visually.", "High", "Business",
      "AC-F-041: After each run the output panel shows all fields; stderr is rendered in an error colour.", ["TC-UI-02"], "", "4.5", "FrontendUI", "DS-UI-01", "Output panel"),
    F("CEP-F-042", "The web interface shall show a progress state while a run is in progress and prevent duplicate submission.", "Medium", "Usability",
      "AC-F-042: The Run button is disabled and a spinner is shown until the response arrives.", ["TC-UI-03"], "", "4.5", "FrontendUI", "DS-UI-01", "Progress state"),
    F("CEP-F-043", "The web interface shall provide registration and login forms with inline validation messages and a history page listing past runs.", "Medium", "Usability",
      "AC-F-043: Invalid input shows a message next to the field; the history page lists runs and opens their detail.", ["TC-UI-04"], "", "4.5", "FrontendUI", "DS-UI-02", "Auth + history UI"),
  ],
  adm: [
    F("CEP-F-050", "The system shall let an administrator view security audit events, filterable by type and date.", "Medium", "Operations",
      "AC-F-050: GET /api/admin/audit-events?type=BLOCKED_CODE returns only matching events.", ["TC-ADM-01"], "", "4.6", "AdminModule", "DS-ADM-01", "View audit events"),
    F("CEP-F-051", "The system shall let an administrator view platform statistics: total runs, runs per status and number of active users.", "Low", "Operations",
      "AC-F-051: The statistics endpoint returns counts consistent with the database.", ["TC-ADM-02"], "", "4.6", "AdminModule", "DS-ADM-01", "Platform statistics"),
    F("CEP-F-052", "The system shall respond 403 to any non-administrator calling an admin endpoint.", "High", "Security",
      "AC-F-052: A normal user's token on /api/admin/* returns 403.", ["TC-ADM-03"], "", "4.6", "AdminModule", "DS-ADM-01", "Admin RBAC"),
  ],
};

const NF = (id, text, cat, prio, ac, tc, ds, module, short) => ({ id, text, cat, prio, ac, tc, ds, module, short, type: "Non-functional", sec: "5" });
const NFR = [
  NF("CEP-NF-001", "A trivial program (e.g. print('hi')) shall return its result within 2 seconds for 90% of requests on the reference machine, excluding queue wait.", "Performance", "High",
    "90th percentile of 30 runs <= 2 s. Test: TC-PERF-01", ["TC-PERF-01"], "DS-SBX-01", "SandboxModule", "Response time"),
  NF("CEP-NF-002", "Sandbox start-up overhead (process creation, job setup, cleanup) shall not exceed 500 ms.", "Performance", "Medium",
    "Mean time of empty-program runs <= 500 ms. Test: TC-PERF-02", ["TC-PERF-02"], "DS-SBX-01", "SandboxModule", "Sandbox overhead"),
  NF("CEP-NF-003", "No program in the attack test-suite (file read/write, network, process spawn, fork bomb, memory bomb, output flood, import tricks) shall compromise the host or the server process.", "Security", "High",
    "100% of attack cases end in a controlled status and the server remains healthy. Test: TC-SEC-01..TC-SEC-10, TC-SBX-*", ["TC-SBX-01", "TC-SBX-04", "TC-SBX-06", "TC-SEC-01"], "DS-SBX-02", "SandboxModule", "Attack resistance"),
  NF("CEP-NF-004", "The server shall remain responsive (health endpoint answers within 1 s) while hostile programs are running, and shall leave no orphan processes after 100 mixed runs.", "Reliability", "High",
    "Health probe latency <= 1 s during load; process count returns to baseline. Test: TC-REL-01", ["TC-REL-01", "TC-SBX-07"], "DS-SBX-01", "SandboxModule", "Resilience"),
  NF("CEP-NF-005", "A first-time user shall be able to register, log in and run a program within 2 minutes without documentation; the UI shall work in current Chrome, Edge and Firefox at 1280x720 or larger.", "Usability", "Medium",
    "Usability walkthrough with 3 users succeeds. Test: TC-UX-01", ["TC-UX-01"], "DS-UI-01", "FrontendUI", "Usability"),
  NF("CEP-NF-006", "The platform shall run on Windows 10/11 with Python 3.11+ and Node.js 20+, install with documented commands only, and expose all limits as environment variables.", "Portability / Maintainability", "Medium",
    "A clean machine follows HOW_TO_RUN.md and reaches a working app. Test: TC-MNT-01", ["TC-MNT-01"], "DS-OPS-01", "Config", "Portability"),
  NF("CEP-NF-007", "All security-relevant events shall be stored with timestamp, user, IP and type, and retained for at least 90 days (configurable).", "Auditability", "Medium",
    "Events for failed login, blocked code and limit breaches are queryable. Test: TC-OPS-01", ["TC-OPS-01"], "DS-AUD-01", "AuditModule", "Audit retention"),
  NF("CEP-NF-008", "A single reference machine (4 cores, 8 GB RAM) shall support 20 concurrent users with 4 simultaneous executions without request failures other than 429/503.", "Scalability", "Medium",
    "Load test of 20 virtual users. Test: TC-PERF-03", ["TC-PERF-03"], "DS-EXE-02", "ExecutionModule", "Capacity"),
];

const SO = [
  ["SO-1", "Host integrity and availability", "Untrusted code must never be able to read, modify or destroy the host system, nor exhaust its CPU, memory, disk or process table so that the platform becomes unavailable."],
  ["SO-2", "Confidentiality and isolation of data", "Credentials, tokens, server secrets and one user's code and results must never be disclosed to another user or to the executing program."],
  ["SO-3", "Accountability and abuse detection", "Security-relevant actions must be attributable to a user and recorded so that abuse (brute force, repeated malicious submissions, flooding) can be detected and investigated."],
];

const SR = (id, text, prio, ac, tc, ds, module, short) => ({ id, text, type: "Security", prio, ac, tc, ds, module, short, sec: "5.1.2" });
const SRS_ = [
  SR("CEP-SR-001", "All user code shall run in a separate OS process, assigned to a Windows Job Object, and never inside the server process.", "High",
    "Process inspection shows execution in a child python.exe inside a job. Test: TC-SEC-01", ["TC-SEC-01"], "DS-SBX-01", "SandboxModule", "Process isolation"),
  SR("CEP-SR-002", "Passwords shall be hashed with bcrypt (cost >= 12 in production) and never logged or returned by any API.", "High",
    "DB dump and logs contain no plaintext password. Test: TC-SEC-02", ["TC-SEC-02", "TC-AUTH-02"], "DS-AUTH-01", "AuthModule", "Password hashing"),
  SR("CEP-SR-003", "Tokens shall be signed (HS256) with a secret supplied via environment, expire after 60 minutes, and be required on every endpoint except register, login, health and limits.", "High",
    "Tampered/expired tokens rejected with 401. Test: TC-SEC-03", ["TC-SEC-03", "TC-AUTH-05"], "DS-AUTH-01", "AuthModule", "Token security"),
  SR("CEP-SR-004", "Access to executions shall be restricted to the owning user (object-level authorisation).", "High",
    "Cross-user access returns 404. Test: TC-SEC-04", ["TC-SEC-04", "TC-HIS-03"], "DS-HIS-01", "HistoryModule", "Object-level auth"),
  SR("CEP-SR-005", "All inputs shall be validated by schema and size; database access shall use the ORM with parameterised queries only.", "High",
    "SQL-injection strings and oversize bodies are rejected or stored inertly. Test: TC-SEC-05", ["TC-SEC-05"], "DS-SEC-01", "All", "Input validation"),
  SR("CEP-SR-006", "The child process environment shall contain only an allow-listed minimal set of variables and no server secrets.", "High",
    "A program printing its environment shows no JWT secret or DB path. Test: TC-SEC-06", ["TC-SEC-06"], "DS-SBX-01", "SandboxModule", "Clean environment"),
  SR("CEP-SR-007", "A runtime audit hook inside the child shall deny network, process-creation, ctypes and out-of-sandbox file events, and any file write.", "High",
    "Each denied event class raises PermissionError. Test: TC-SEC-07", ["TC-SEC-07", "TC-SBX-06"], "DS-SBX-02", "SandboxModule", "Runtime hook"),
  SR("CEP-SR-008", "CORS shall be restricted to the configured front-end origin, and standard security headers shall be sent; production deployments shall terminate TLS 1.2+.", "Medium",
    "Cross-origin call from another origin is blocked. Test: TC-SEC-08", ["TC-SEC-08"], "DS-SEC-01", "FastAPI app", "CORS / headers"),
  SR("CEP-SR-009", "Security events (login failure, blocked code, limit breach, admin access) shall be written to the audit log without storing passwords or tokens.", "Medium",
    "Audit rows exist for each event class and contain no secrets. Test: TC-SEC-09", ["TC-SEC-09", "TC-OPS-01"], "DS-AUD-01", "AuditModule", "Audit logging"),
  SR("CEP-SR-010", "Login and execution endpoints shall be rate limited per user/IP to slow brute force and flooding.", "Medium",
    "Excess requests return 429. Test: TC-SEC-10", ["TC-SEC-10", "TC-AUTH-04", "TC-EXE-09"], "DS-AUTH-02", "RateLimiter", "Rate limiting"),
];

const allFR = Object.values(FR).flat();
const ALL = [...allFR, ...NFR, ...SRS_];

module.exports = { FR, NFR, SO, SRS_, allFR, ALL };
