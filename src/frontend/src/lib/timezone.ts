/**
 * Shared timezone helpers.
 *
 * The app stores two timezone facts on the user's profile:
 *  - `timezone`: the IANA zone name (e.g. "America/New_York"), used to render
 *    calendar days and Lock-In windows in the user's own zone.
 *  - `timezoneOffsetMinutes`: the current UTC offset in minutes east of UTC
 *    (e.g. -300 for New York in winter, +330 for Kolkata), used by the backend
 *    to bucket check-ins into the correct local day.
 *
 * Both values drift as the user travels or as daylight saving shifts, so every
 * surface that needs them reads them through these helpers instead of
 * re-deriving the offset inline.
 */

/**
 * Reads the device's IANA timezone name, e.g. "America/New_York".
 * Returns an empty string when the runtime cannot resolve one.
 */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/**
 * Returns the device's current UTC offset in minutes east of UTC.
 * `Date.prototype.getTimezoneOffset()` returns minutes WEST of UTC (positive
 * for zones behind UTC), so the sign is flipped to match the backend's
 * "minutes east of UTC" convention.
 */
export function getCurrentTimezoneOffsetMinutes(): number {
  // `-0` is a valid but surprising result for UTC; normalize it to `0` so
  // equality checks and BigInt conversion behave predictably.
  return -new Date().getTimezoneOffset() || 0;
}
