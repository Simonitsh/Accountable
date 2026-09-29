import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentTimezoneOffsetMinutes, getDeviceTimezone } from "./timezone";

describe("getDeviceTimezone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the IANA zone reported by Intl", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: "America/New_York" }),
        }) as unknown as Intl.DateTimeFormat,
    );
    expect(getDeviceTimezone()).toBe("America/New_York");
  });

  it("returns an empty string when Intl cannot resolve a zone", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: undefined }),
        }) as unknown as Intl.DateTimeFormat,
    );
    expect(getDeviceTimezone()).toBe("");
  });

  it("returns an empty string when Intl throws", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("unsupported");
    });
    expect(getDeviceTimezone()).toBe("");
  });
});

describe("getCurrentTimezoneOffsetMinutes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flips the sign of getTimezoneOffset to minutes east of UTC", () => {
    // getTimezoneOffset returns minutes WEST of UTC: New York winter = 300.
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(300);
    expect(getCurrentTimezoneOffsetMinutes()).toBe(-300);
  });

  it("returns a positive offset for zones east of UTC", () => {
    // Kolkata is UTC+5:30 → getTimezoneOffset returns -330.
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-330);
    expect(getCurrentTimezoneOffsetMinutes()).toBe(330);
  });

  it("returns 0 for UTC", () => {
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(0);
    expect(getCurrentTimezoneOffsetMinutes()).toBe(0);
  });
});
