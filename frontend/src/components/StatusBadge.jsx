const META = {
  COMPLETED: { cls: "ok", label: "Completed" },
  RUNTIME_ERROR: { cls: "err", label: "Runtime error" },
  TIMEOUT: { cls: "warn", label: "Time limit exceeded" },
  MEMORY_LIMIT: { cls: "warn", label: "Memory limit exceeded" },
  OUTPUT_LIMIT: { cls: "warn", label: "Output limit exceeded" },
  BLOCKED: { cls: "err", label: "Blocked by policy" },
  INTERNAL_ERROR: { cls: "err", label: "Internal error" },
};

// Status is conveyed by text as well as colour (accessibility).
export default function StatusBadge({ status }) {
  const m = META[status] || { cls: "err", label: status };
  return <span className={`badge ${m.cls}`} data-testid="status-badge">{m.label}</span>;
}
