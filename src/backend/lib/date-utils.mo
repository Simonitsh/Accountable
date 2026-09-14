import Int "mo:core/Int";
import Common "../types/common";

/// Shared date/timezone utilities used across the backend's domain modules.
///
/// All functions are pure and stateless, so they can be unit-tested directly.
/// They are `public` within this internal lib module — this does NOT change
/// the canister's public API (only main.mo's public functions are exposed).
module {
  // 86400 seconds in nanoseconds
  public let DAY_NS : Int = 86_400_000_000_000;

  /// Returns true iff two nanosecond timestamps fall on the same calendar day
  /// for the given timezone offset (in minutes). Day boundary is computed via
  /// DAY_NS (86400s in ns).
  public func sameDay(a : Common.Timestamp, b : Common.Timestamp, timezoneOffsetMinutes : Int) : Bool {
    let offsetNs = timezoneOffsetMinutes * 60 * 1_000_000_000;
    ((a + offsetNs) / DAY_NS) == ((b + offsetNs) / DAY_NS);
  };

  /// Day-of-week index (0 = Sunday ... 6 = Saturday) for a nanosecond
  /// timestamp, adjusted for the user's timezone offset in minutes.
  /// Unix epoch (1970-01-01) was a Thursday = index 4.
  public func dayOfWeek(ts : Common.Timestamp, timezoneOffsetMinutes : Int) : Nat {
    let offsetNs = timezoneOffsetMinutes * 60 * 1_000_000_000;
    let localTs = ts + offsetNs;
    let daysSinceEpoch = localTs / DAY_NS;
    let raw = (4 + daysSinceEpoch) % 7;
    let idx = if (raw < 0) { raw + 7 } else { raw };
    idx.toNat();
  };

  /// Derives the day-of-week abbreviation ("mon".."sun") from a nanosecond
  /// timestamp, adjusted for the user's timezone offset in minutes.
  /// Unix epoch (1970-01-01) was a Thursday (index 4).
  /// Days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  public func dayOfWeekAbbr(timestampNs : Int, timezoneOffsetMinutes : Int) : Text {
    let idx = dayOfWeek(timestampNs, timezoneOffsetMinutes);
    switch (idx) {
      case 0 "sun";
      case 1 "mon";
      case 2 "tue";
      case 3 "wed";
      case 4 "thu";
      case 5 "fri";
      case 6 "sat";
      case _ "mon"; // unreachable
    };
  };

  /// Derives the day-of-week abbreviation ("mon".."sun") from a nanosecond
  /// timestamp in UTC (no timezone offset applied). Used for partner streaks,
  /// which are computed in UTC by design.
  public func dayOfWeekAbbrUtc(timestampNs : Int) : Text {
    dayOfWeekAbbr(timestampNs, 0);
  };

  /// Returns true iff the given day-of-week abbreviation ("mon".."sun") is in scheduledDays.
  public func isScheduledDay(dayAbbr : Text, scheduledDays : [Text]) : Bool {
    scheduledDays.find(func(d) { d == dayAbbr }) != null;
  };
};
