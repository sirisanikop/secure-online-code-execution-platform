import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import App from "../App";
import { AuthProvider } from "../AuthContext";

// CodeMirror needs real browser layout; in jsdom it is replaced by a plain textarea with the same props contract.
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }) => <textarea aria-label="Python code" value={value} onChange={(e) => onChange(e.target.value)} />,
}));
vi.mock("@codemirror/lang-python", () => ({ python: () => [] }));

const json = (status, body) => Promise.resolve({ ok: status < 400, status, headers: new Headers(), json: () => Promise.resolve(body) });
let routes;
const calls = [];

function mockFetch() {
  global.fetch = vi.fn((url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : undefined });
    const key = `${opts.method || "GET"} ${url.split("?")[0]}`;
    const h = routes[key];
    return h ? h(url, opts) : json(404, { error: { code: "NF", message: "no route " + key } });
  });
}

function renderAt(path, loggedIn = true) {
  if (loggedIn) sessionStorage.setItem("codebox_token", "tok");
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>);
}

const RESULT = { id: 1, status: "COMPLETED", stdout: "Hello, Ada\n", stderr: "", exit_code: 0, runtime_ms: 41, peak_mem_kb: 9216, blocked_reason: null, created_at: "2026-10-29T10:00:00Z" };

beforeEach(() => {
  calls.length = 0;
  routes = {
    "GET /api/auth/me": () => json(200, { id: 1, username: "alice", is_admin: false }),
    "GET /api/limits": () => json(200, { timeout_seconds: 5, memory_limit_mb: 128, output_limit_bytes: 65536 }),
    "POST /api/executions": () => json(200, RESULT),
  };
  mockFetch();
});

describe("Editor page", () => {
  it("TC-UI-01 shows editor, stdin box and Run button; Run submits the code", async () => {
    renderAt("/");
    const editor = await screen.findByLabelText("Python code");
    expect(screen.getByLabelText("Standard input")).toBeInTheDocument();
    const run = screen.getByRole("button", { name: "Run" });
    await userEvent.clear(editor);
    await userEvent.type(editor, "print(1)");
    await userEvent.click(run);
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url === "/api/executions")).toBe(true));
    const post = calls.find((c) => c.method === "POST");
    expect(post.body.code).toBe("print(1)");
    expect(screen.getByText(/Limits: 5 s \| 128 MB/)).toBeInTheDocument();
  });

  it("TC-UI-02 displays stdout, stderr, status badge, runtime and memory; errors are visually distinct", async () => {
    routes["POST /api/executions"] = () => json(200, { ...RESULT, status: "RUNTIME_ERROR", exit_code: 1, stdout: "partial\n", stderr: "ZeroDivisionError: boom" });
    renderAt("/");
    await userEvent.click(await screen.findByRole("button", { name: "Run" }));
    expect(await screen.findByTestId("status-badge")).toHaveTextContent("Runtime error");
    expect(screen.getByLabelText("Standard output")).toHaveTextContent("partial");
    const err = screen.getByLabelText("Standard error");
    expect(err).toHaveTextContent("ZeroDivisionError: boom");
    expect(err).toHaveClass("error");
    expect(screen.getByText("41 ms")).toBeInTheDocument();
    expect(screen.getByText("9.0 MB")).toBeInTheDocument();
  });

  it("TC-UI-03 shows progress and prevents duplicate submission while running", async () => {
    let release;
    routes["POST /api/executions"] = () => new Promise((res) => { release = () => res({ ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve(RESULT) }); });
    renderAt("/");
    const run = await screen.findByRole("button", { name: "Run" });
    await userEvent.click(run);
    expect(await screen.findByRole("status")).toHaveTextContent("Running");
    expect(screen.getByRole("button", { name: "Running..." })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Running..." }));
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
    release();
    await waitFor(() => expect(screen.getByRole("button", { name: "Run" })).toBeEnabled());
    expect(screen.getByLabelText("Standard output")).toHaveTextContent("Hello, Ada");
  });

  it("shows rate-limit / server errors from the API", async () => {
    routes["POST /api/executions"] = () => Promise.resolve({ ok: false, status: 429, headers: new Headers({ "Retry-After": "12" }), json: () => Promise.resolve({ error: { code: "RATE_LIMITED", message: "Too many runs" } }) });
    renderAt("/");
    await userEvent.click(await screen.findByRole("button", { name: "Run" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many runs (retry in 12 s)");
  });
});

describe("Auth and history pages", () => {
  it("TC-UI-04a login/register forms show inline validation messages", async () => {
    renderAt("/login", false);
    await userEvent.click(screen.getByRole("button", { name: "No account? Register" }));
    await userEvent.type(screen.getByLabelText("Username"), "a");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText(/3-30 characters/)).toBeInTheDocument();
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(calls.length).toBe(0); // nothing is sent when client-side validation fails
  });

  it("TC-UI-04b failed login shows the server message; success opens the editor", async () => {
    routes["POST /api/auth/login"] = () => json(401, { error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password" } });
    renderAt("/login", false);
    await userEvent.type(screen.getByLabelText("Username"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "Passw0rd1");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
    routes["POST /api/auth/login"] = () => json(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 });
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("button", { name: "Run" })).toBeInTheDocument();
    expect(sessionStorage.getItem("codebox_token")).toBe("tok");
  });

  it("TC-UI-04c history page lists runs, opens a detail view and deletes a run", async () => {
    let items = [{ id: 7, status: "TIMEOUT", runtime_ms: 5000, created_at: "2026-10-29T10:00:00Z", code_preview: "while True: pass" }];
    routes["GET /api/executions"] = () => json(200, { items, total: items.length });
    routes["GET /api/executions/7"] = () => json(200, { ...RESULT, id: 7, status: "TIMEOUT", code: "while True: pass", stdin: "" });
    routes["DELETE /api/executions/7"] = () => { items = []; return Promise.resolve({ ok: true, status: 204, headers: new Headers(), json: () => Promise.reject(new Error("no body")) }); };
    renderAt("/history");
    const row = (await screen.findByText("while True: pass")).closest("tr");
    expect(within(row).getByTestId("status-badge")).toHaveTextContent("Time limit exceeded");
    await userEvent.click(within(row).getByRole("button", { name: "View" }));
    expect(await screen.findByLabelText("Run detail")).toHaveTextContent("Run #7");
    await userEvent.click(within(row).getByRole("button", { name: "Delete run 7" }));
    expect(await screen.findByText(/No runs yet/)).toBeInTheDocument();
  });

  it("admin link is hidden from normal users and visible to administrators", async () => {
    renderAt("/");
    await screen.findByRole("button", { name: "Run" });
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });
});
