import { describe, expect, it } from "vitest";
import { equitySession } from "../src/tools/calendar.js";

const at = (iso: string) => equitySession(new Date(iso));

describe("equitySession", () => {
  it("regular hours on a normal weekday (EDT)", () => {
    const s = at("2026-09-23T14:00:00Z");
    expect(s.phase).toBe("regular");
    expect(s.nowNewYork).toBe("2026-09-23 10:00 ET");
    expect(s.nextClose).toBe("2026-09-23T20:00:00.000Z");
    expect(s.nextOpen).toBe("2026-09-24T13:30:00.000Z");
  });

  it("overnight before the open", () => {
    const s = at("2026-09-23T04:40:00Z");
    expect(s.phase).toBe("closed");
    expect(s.reason).toBe("overnight");
    expect(s.nextOpen).toBe("2026-09-23T13:30:00.000Z");
  });

  it("pre-market and after-hours", () => {
    expect(at("2026-09-23T12:00:00Z").phase).toBe("pre_market");
    expect(at("2026-09-23T21:00:00Z").phase).toBe("post_market");
  });

  it("weekend rolls to Monday", () => {
    const s = at("2026-09-26T15:00:00Z");
    expect(s.reason).toBe("weekend");
    expect(s.nextOpen).toBe("2026-09-28T13:30:00.000Z");
  });

  it("Thanksgiving is closed; the next day closes early (EST)", () => {
    const s = at("2026-11-26T15:00:00Z");
    expect(s.phase).toBe("closed");
    expect(s.reason).toBe("holiday: Thanksgiving Day");
    expect(s.nextOpen).toBe("2026-11-27T14:30:00.000Z");
    expect(s.nextClose).toBe("2026-11-27T18:00:00.000Z");
    expect(s.earlyClose).toBe(true);
  });

  it("early-close day: regular until 13:00 ET, then after-hours", () => {
    expect(at("2026-11-27T17:30:00Z").phase).toBe("regular");
    expect(at("2026-11-27T19:00:00Z").phase).toBe("post_market");
  });

  it("handles the DST switch", () => {
    expect(at("2026-11-02T14:30:00Z").phase).toBe("regular"); // 09:30 EST
    expect(at("2026-11-02T13:45:00Z").phase).toBe("pre_market"); // 08:45 EST
  });

  it("Christmas Eve after-hours rolls past Christmas and the weekend", () => {
    const s = at("2026-12-24T19:00:00Z");
    expect(s.phase).toBe("post_market");
    expect(s.nextOpen).toBe("2026-12-28T14:30:00.000Z");
  });
});
