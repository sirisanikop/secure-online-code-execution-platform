// The API sends UTC timestamps. SQLite drops the timezone marker, so a value can arrive as
// "2026-11-20T07:16:59" (no "Z"). Browsers read a marker-less time as LOCAL time, which shows the UTC clock
// instead of the real one. Treat a marker-less value as UTC, then show it in Indian Standard Time.
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

export function parseApiDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const date = new Date(HAS_ZONE.test(text) ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatIST(value) {
  const date = parseApiDate(value);
  if (!date) return "-";
  const text = date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
  return `${text.replace(/\b(am|pm)\b/, (m) => m.toUpperCase())} IST`;
}
