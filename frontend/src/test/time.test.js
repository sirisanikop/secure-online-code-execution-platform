import { describe, it, expect } from "vitest";
import { formatIST, parseApiDate } from "../time";

describe("API timestamps are shown in IST", () => {
  it("TC-UI-05a a timestamp without a timezone marker is UTC, so 07:16:59 UTC is 12:46:59 PM IST", () => {
    expect(formatIST("2026-11-20T07:16:59.700189")).toBe("20 Nov 2026, 12:46:59 PM IST");
  });

  it("TC-UI-05b a value with Z or an offset gives the same moment", () => {
    expect(formatIST("2026-11-20T07:16:59Z")).toBe("20 Nov 2026, 12:46:59 PM IST");
    expect(formatIST("2026-11-20T12:46:59+05:30")).toBe("20 Nov 2026, 12:46:59 PM IST");
  });

  it("TC-UI-05c midnight and day rollover are handled (18:30 UTC is 12:00 AM IST the next day)", () => {
    expect(formatIST("2026-11-20T18:30:00")).toBe("21 Nov 2026, 12:00:00 AM IST");
  });

  it("TC-UI-05d empty or invalid values do not crash", () => {
    expect(formatIST(null)).toBe("-");
    expect(formatIST("not a date")).toBe("-");
    expect(parseApiDate("")).toBeNull();
  });
});
