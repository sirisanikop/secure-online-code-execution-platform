const path = require("path");
const L = require("./lib");
const { P, H1, H2, H3, B, table, gap, img, makeDoc, save } = L;
const R = require("./reqs");
const res = require("./results");

const DATE = "29-10-2026";
const kids = [];
const add = (...x) => x.flat().forEach((e) => kids.push(e));

// RTM status from executed tests: A = all linked cases passed, P = some passed / some not executed, N = none
function rtmStatus(r) {
  const s = r.tc.map((t) => res.status(t));
  if (s.every((x) => x === "Passed")) return "A";
  if (s.some((x) => x === "Passed")) return "P";
  return "N";
}

add(H1("Software Requirements Specification (SRS)"));
add(P("**Project:** Secure Online Code Execution Platform (CodeBox)"));
add(P("**Version:** 1.1"));
add(P("**Authors:** SE Mini Project Team"));
add(P("**Date:** " + DATE));
add(P("**Status:** Baselined; verification status recorded in the RTM (section 8)"));

add(H2("Revision history"));
add(table(["Version", "Date", "Author", "Change summary", "Approval"], [
  ["1.0", "13-10-2026", "Project Team", "Initial SRS with use-case diagrams and RTM", ""],
  ["1.1", DATE, "Project Team", "Updated after implementation and testing: measured values in acceptance criteria, RTM status from executed tests", ""],
], [1000, 1300, 1700, 4346, 1400], { size: 18 }));
add(H2("Approvals"));
add(table(["Role", "Name", "Signature / Email", "Date"], [["Course Coordinator", "", "", ""], ["Project Guide", "", "", ""], ["Team Lead", "", "", ""]], [2600, 2600, 2900, 1646], { size: 18 }));

add(H2("Table of Contents"));
["1. Introduction", "2. Overall description", "3. External interface requirements", "4. System features (detailed)",
  "5. Non-functional requirements (detailed) and 5.1 Security", "6. Quality attributes & Acceptance tests",
  "7. System models and diagrams", "8. Requirements Traceability Matrix (RTM)"].forEach((t) => add(P(t, { after: 40 })));

add(H2("1. Introduction"));
add(H3("1.1 Purpose"));
add(P("This document is the Software Requirements Specification (SRS) for the Secure Online Code Execution Platform. It defines the functional, non-functional and security requirements, the external interfaces and the verification criteria of a web platform that lets registered users write Python programs and execute them in an isolated environment on the server. It is the reference for the design (SAD), the implementation and the test plan (STP)."));
add(H3("1.2 Scope"));
add(P("**In scope:** user registration and login; submission of Python 3 source code with optional standard input; execution of the code in an isolated child process with enforced time, memory, process and output limits; capture and display of stdout, stderr, exit code and statistics; storage and review of execution history; static and runtime protection of the host from unsafe code; an administrator view of audit events and statistics; a React web interface."));
add(P("**Out of scope:** languages other than Python; interactive (streaming) terminals; code collaboration; installation of third-party packages by users; container/VM-level isolation (documented as future work); payment or quota billing; mobile applications."));
add(H3("1.3 Audience"));
add(P("Developers, QA engineers, project guides and assessment evaluators, and system administrators who deploy the platform."));
add(H3("1.4 Definitions"));
add(table(["Term", "Meaning"], [
  ["API", "Application Programming Interface (REST over HTTP/JSON)"],
  ["Sandbox", "The isolated environment (child process + Job Object + runtime hook) in which user code runs"],
  ["Job Object", "A Windows kernel object that groups processes and enforces limits (memory, process count, CPU time) on them"],
  ["Audit hook", "A CPython (PEP 578) callback that observes and can veto sensitive runtime events such as file opens and socket connects"],
  ["JWT", "JSON Web Token, a signed token carrying the identity of an authenticated user"],
  ["bcrypt", "Adaptive password hashing function with per-password salt"],
  ["SPA", "Single Page Application (the React front end)"],
  ["RBAC", "Role-Based Access Control (user / administrator)"],
  ["RTM", "Requirements Traceability Matrix"],
  ["STRIDE", "Threat model: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege"],
], [2200, 7546], { size: 18 }));

add(H2("2. Overall description"));
add(H3("2.1 Product perspective"));
add(P("The platform is a self-contained three-tier web application: a React SPA in the user's browser, a FastAPI (Python) server that exposes a REST API and orchestrates executions, and an SQLite database. The server launches each submission as a separate, resource-limited child process (the sandbox). The platform does not depend on Docker or any external execution service. Figure 3.1 in the SAD shows the component structure."));
add(H3("2.2 Major product functions (detailed)"));
["Register and authenticate users (JWT)", "Submit Python code and standard input", "Validate code against a security policy before running",
  "Execute code in an isolated process with time / memory / process / output limits", "Capture and return stdout, stderr, exit code, runtime and memory",
  "Classify the outcome (completed, runtime error, timeout, memory limit, output limit, blocked)", "Store and browse the personal execution history",
  "Rate-limit and queue executions to protect the server", "Record security events and give administrators an audit and statistics view"].forEach((t) => add(B(t)));
add(H3("2.3 User roles and characteristics (expanded)"));
add(B("**Learner (registered user):** students or developers with basic Python knowledge who want to try code quickly; expects results in seconds and clear error messages."));
add(B("**Administrator:** operates the platform; reviews audit events and statistics; has no ability to see other users' passwords."));
add(B("**Anonymous visitor:** may only see the login and registration pages."));
add(B("**Malicious actor (threat actor):** a registered user who deliberately submits hostile code; treated as a design assumption for the security requirements."));
add(H3("2.4 Operating environment"));
add(P("Server: Windows 10/11 (64-bit), Python 3.11+, single machine (reference: 4 cores, 8 GB RAM). Client: current Chrome, Edge or Firefox. Build tooling: Node.js 20+ for the React front end. Database: SQLite file on the server."));
add(H3("2.5 Constraints"));
["No Docker or virtual machine is available; isolation must rely on OS process features (Job Objects), a hardened interpreter and CPython audit hooks.",
  "Only Python 3 is supported as the user language.", "Windows-specific APIs (Job Objects) are used; Linux support is out of scope for version 1.0.",
  "Default limits: 5 s execution time, 128 MB memory, 64 KB output per stream, 50 KB source, 16 KB stdin.",
  "A subprocess sandbox without hardware or container isolation cannot offer the guarantees of a VM; residual risks are documented in the SAD."].forEach((t) => add(B(t)));
add(H3("2.6 Assumptions and dependencies"));
["The host runs the platform under a non-administrator Windows account.", "Third-party libraries: FastAPI, SQLAlchemy, PyJWT, bcrypt, React, Vite, CodeMirror.",
  "System time is correct (needed for token expiry and rate limiting)."].forEach((t) => add(B(t)));

add(H2("3. External interface requirements"));
add(H3("3.1 User interfaces"));
add(P("A responsive React single-page application with pages: Login/Register, Editor (code editor, stdin box, Run button, output panel), History (table of previous runs with detail view) and Admin (audit events and statistics, administrators only). Accessibility: keyboard operable controls, labelled form fields, sufficient colour contrast, status conveyed by text as well as colour."));
add(H3("3.2 Hardware interfaces"));
add(P("None specific. The server uses the machine's CPU, memory and disk; the Job Object API of the Windows kernel is used to constrain child processes."));
add(H3("3.3 Software interfaces"));
add(B("**REST API** (JSON over HTTP, Bearer JWT) between the SPA and the FastAPI server; documented via OpenAPI/Swagger at /docs."));
add(B("**Database interface:** SQLAlchemy ORM to SQLite (users, executions, audit_events)."));
add(B("**Operating-system interface:** Win32 Job Object API (kernel32) via ctypes, and process creation for python.exe."));
add(B("**Python interpreter:** the base python.exe of the installation that runs the server, launched with isolated mode (-I) for user code."));
add(H3("3.4 Communications"));
add(B("HTTP/1.1 with JSON bodies; CORS restricted to the configured front-end origin."));
add(B("TLS 1.2+ is required whenever the service is exposed beyond localhost (terminated by a reverse proxy); development runs on localhost without TLS."));
add(B("User code has no network access of any kind."));
add(P("**Coverage check against the template:** this SRS contains " + R.allFR.length + " functional requirements (minimum 15), " + R.NFR.length + " non-functional requirements (minimum 5), " + R.SO.length + " security objectives (2-4) and " + R.SRS_.length + " security requirements (minimum 5).", { italics: true }));

add(H2("4. System features (detailed)"));
add(P("Each requirement below includes acceptance criteria and a reference test case. IDs follow CEP-F-###."));
const W7 = [1000, 2950, 800, 700, 950, 2246, 1100];
const H7 = ["Req ID", "Requirement (shall...)", "Type", "Priority", "Source / Stakeholder", "Acceptance criteria / Test case ref", "Comments / Dependencies"];
const feat = (title, desc, arr) => {
  add(H3(title));
  add(P("Description: " + desc));
  add(table(H7, arr.map((r) => [r.id, r.text, r.type, r.prio, r.src, r.ac + " Test: " + r.tc.join(", "), r.note]), W7, { size: 15 }));
};
feat("4.1 User Registration and Authentication", "Create accounts and authenticate users so that execution and history are tied to an identity.", R.FR.auth);
feat("4.2 Code Submission and Execution", "Accept source code and stdin, run it in the sandbox and return the classified result.", R.FR.exec);
feat("4.3 Resource Limits and Safety Enforcement", "Protect the host from unsafe or abusive programs using static checks, OS limits and runtime hooks.", R.FR.sbx);
feat("4.4 Execution History", "Persist and review past executions, visible only to their owner.", R.FR.his);
feat("4.5 Web Interface", "Provide the browser front end for the above functions.", R.FR.ui);
feat("4.6 Administration and Monitoring", "Give administrators visibility of security events and platform usage.", R.FR.adm);

add(H2("5. Non-functional requirements (detailed)"));
add(P("NFRs below are measurable and tied to test plans. IDs CEP-NF-###."));
add(table(["Req ID", "Requirement", "Category", "Priority", "Acceptance criteria / Measurement"], R.NFR.map((r) => [r.id, r.text, r.cat, r.prio, r.ac]), [1000, 4000, 1300, 800, 2646], { size: 16 }));

add(H2("5.1. Security"));
add(H3("5.1.1 Security Objectives"));
add(table(["ID", "Objective", "Description"], R.SO.map((s) => [s[0], s[1], s[2]]), [800, 2400, 6546], { size: 17 }));
add(H3("5.1.2 Security Requirements"));
add(table(["Req ID", "Requirement (shall...)", "Type", "Priority", "Acceptance criteria / Test case ref"], R.SRS_.map((r) => [r.id, r.text, r.type, r.prio, r.ac]), [1000, 4000, 900, 800, 3046], { size: 16 }));
add(gap());
add(P("The threat analysis (STRIDE), trust boundaries and the layered defence that realise these requirements are in the SAD, section 3.9."));

add(H2("6. Quality attributes & Acceptance tests"));
add(B("**Exit criteria for acceptance:** all High-priority functional and security requirements implemented and verified, no critical NFR failure, every attack test ends in a controlled status, and the RTM shows all test cases passed."));
add(B("**Acceptance test suites:** Authentication (TC-AUTH), Execution (TC-EXE), Sandbox (TC-SBX), History (TC-HIS), User interface (TC-UI), Administration (TC-ADM), Security (TC-SEC), Performance/Reliability (TC-PERF, TC-REL), Usability and maintainability (TC-UX, TC-MNT, TC-OPS)."));
add(B("**Quality attributes:** security (primary), reliability, performance, usability, maintainability, portability."));

add(H2("7. System models and diagrams"));
add(H3("7.1 UML Use-Case diagrams"));
add(P("**Use-case diagram 1 - Learner use cases.** The learner registers, logs in, writes code, supplies input, runs it in the sandbox, views output and manages history. Running code includes policy validation and resource-limit enforcement and may extend to recording an audit event."));
add(img("usecase_user.png", 520, 700, "Figure 7.1 - Use-case diagram: learner interactions"));
add(P("**Use-case diagram 2 - Administration and sandbox subsystem.** The administrator monitors audit events and statistics and configures limits; the sandbox runtime (system actor) terminates runaway processes and cleans temporary files."));
add(img("usecase_admin.png", 520, 620, "Figure 7.2 - Use-case diagram: administration and sandbox runtime"));
add(H3("7.2 Use-case descriptions (key use cases)"));
add(table(["Use case", "Actor", "Main flow", "Alternate / exception flows"], [
  ["UC-01 Register account", "Learner", "1. Open registration page. 2. Enter username and password. 3. System validates and stores bcrypt hash. 4. System confirms.", "Username exists -> 409. Weak password -> 422 with rules."],
  ["UC-02 Log in", "Learner", "1. Enter credentials. 2. System verifies. 3. System returns JWT. 4. UI opens editor.", "Wrong credentials -> 401 generic. 5 failures -> 429 and audit event."],
  ["UC-05 Run code in sandbox", "Learner", "1. Click Run. 2. System authenticates and rate-checks. 3. Code validator accepts. 4. Sandbox runs code under limits. 5. Result is stored and returned. 6. UI shows output.", "Policy violation -> BLOCKED. Limit exceeded -> TIMEOUT / MEMORY_LIMIT / OUTPUT_LIMIT. Queue full -> 503. Rate exceeded -> 429."],
  ["UC-07 View run history", "Learner", "1. Open History. 2. System lists own runs newest first. 3. Learner opens a run to see code and output.", "Foreign id -> 404."],
  ["UC-09 View audit events", "Administrator", "1. Open Admin page. 2. Filter by type/date. 3. Review events.", "Non-admin -> 403."],
], [1900, 1200, 3846, 2800], { size: 16 }));

add(H2("8. Requirements Traceability Matrix (RTM)"));
add(P("Status legend: N = not started, P = partially verified, A = achieved / verified by passing tests. Status is derived from the executed test run of " + DATE + " (see the Test Plan, section 14)."));
const rtmRows = R.ALL.map((r) => [r.id, r.short, (r.sec || "") + " / " + r.ds, r.module, r.tc.join(", "), rtmStatus(r), r.tc.includes("TC-UX-01") ? "TC-UX-01 pending" : ""]);
add(table(["Req ID", "Requirement short", "Section ref / Design Spec", "Module", "Test case(s)", "Status (N/P/A)", "Comments"], rtmRows, [1000, 1600, 1500, 1350, 2296, 700, 1300], { size: 15 }));
const counts = { A: 0, P: 0, N: 0 };
R.ALL.forEach((r) => counts[rtmStatus(r)]++);
add(gap());
add(P(`**RTM summary:** ${counts.A} of ${R.ALL.length} requirements achieved (A), ${counts.P} partially verified (P), ${counts.N} not verified (N).`));
console.log("RTM", counts);

save(makeDoc(kids, "SRS - Secure Online Code Execution Platform v1.1"), path.join(__dirname, "..", "SRS.docx"));
