import Time "mo:core/Time";
import Text "mo:core/Text";

module {
  /// Parse "HH:MM" to total minutes from midnight.
  public func parseMinutes(t : Text) : ?Int {
    let parts = t.split(#char ':');
    var hText : ?Text = null;
    var mText : ?Text = null;
    var idx = 0;
    for (part in parts) {
      if (idx == 0) { hText := ?part }
      else if (idx == 1) { mText := ?part };
      idx += 1;
    };
    switch (hText, mText) {
      case (?hs, ?ms) {
        switch (textToInt(hs), textToInt(ms)) {
          case (?h, ?m) {
            if (h >= 0 and h < 24 and m >= 0 and m < 60) ?(h * 60 + m)
            else null
          };
          case _ null;
        }
      };
      case _ null;
    }
  };

  /// Parse a decimal text (no sign) to Int.
  func textToInt(t : Text) : ?Int {
    var result : Int = 0;
    var hasDigit = false;
    for (c in t.chars()) {
      let d : Int = switch c {
        case '0' 0; case '1' 1; case '2' 2; case '3' 3; case '4' 4;
        case '5' 5; case '6' 6; case '7' 7; case '8' 8; case '9' 9;
        case _ { return null };
      };
      result := result * 10 + d;
      hasDigit := true;
    };
    if (hasDigit) ?result else null
  };

  /// Calculate UTC minute-of-day when the reminder email should fire.
  /// tzOffsetMins: positive = east of UTC (e.g. UTC+2 = +120).
  public func calcReminderUtcMinuteOfDay(
    timeStr : ?Text,
    reminderOffset : ?Int,
    tzOffsetMins : Int,
  ) : ?Int {
    switch timeStr {
      case null null;
      case (?t) {
        switch (parseMinutes(t)) {
          case null null;
          case (?mins) {
            let offset = switch reminderOffset { case null 0; case (?o) o };
            var utcMins = mins + offset - tzOffsetMins;
            utcMins := ((utcMins % 1440) + 1440) % 1440;
            ?utcMins
          };
        }
      };
    }
  };

  /// Returns true if current UTC time (whole minutes) matches targetUtcMinute.
  public func isNow(targetUtcMinute : Int) : Bool {
    let nowNs : Int = Time.now();
    let dayNs : Int = 24 * 60 * 60 * 1_000_000_000;
    let minuteNs : Int = 60 * 1_000_000_000;
    let currentDayMinute : Int = (nowNs % dayNs) / minuteNs;
    currentDayMinute == targetUtcMinute
  };
};
