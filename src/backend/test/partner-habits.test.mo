import { test; expect } "mo:test";
import DateUtils "../lib/date-utils";

/// Tests for DateUtils.dayOfWeekAbbrUtc() — the UTC-only day-of-week helper
/// used by partner-habits.computeCurrentStreak().
///
/// INTENTIONAL BEHAVIOR (documented here to lock it in):
/// computeCurrentStreak() walks backward in UTC days (each step is exactly
/// DAY_NS = 86400s), so the day-of-week must be computed against the same UTC
/// day boundaries. A timezone-aware day-of-week would be inconsistent with
/// those UTC boundaries, so dayOfWeekAbbrUtc() deliberately takes NO timezone
/// offset and always computes in UTC.
///
/// Reference: Unix epoch 1970-01-01 00:00:00 UTC was a Thursday.
/// dayOfWeek() maps 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat,
/// so epoch Thursday = index 4 → "thu".

// DAY_NS = 86_400_000_000_000 ns (one day)
let DAY_NS : Int = 86_400_000_000_000;

test("dayOfWeekAbbrUtc: epoch (1970-01-01) is Thursday 'thu'", func() {
  expect.text(DateUtils.dayOfWeekAbbrUtc(0)).equal("thu");
});

test("dayOfWeekAbbrUtc: one day after epoch is Friday 'fri'", func() {
  expect.text(DateUtils.dayOfWeekAbbrUtc(DAY_NS)).equal("fri");
});

test("dayOfWeekAbbrUtc: two days after epoch is Saturday 'sat'", func() {
  expect.text(DateUtils.dayOfWeekAbbrUtc(2 * DAY_NS)).equal("sat");
});

test("dayOfWeekAbbrUtc: three days after epoch wraps to Sunday 'sun' (mod-7)", func() {
  // 4 + 3 = 7, 7 % 7 = 0 → Sunday. This exercises the mod-7 wraparound.
  expect.text(DateUtils.dayOfWeekAbbrUtc(3 * DAY_NS)).equal("sun");
});

test("dayOfWeekAbbrUtc: seven days after epoch returns to Thursday 'thu' (full week)", func() {
  // 4 + 7 = 11, 11 % 7 = 4 → Thursday.
  expect.text(DateUtils.dayOfWeekAbbrUtc(7 * DAY_NS)).equal("thu");
});

test("dayOfWeekAbbrUtc: exact whole-day multiple before epoch is Wednesday 'wed'", func() {
  // -1 day: 4 + (-1) = 3 → Wednesday. This only covers the exact whole-day
  // multiple boundary — a negative timestamp that is NOT an exact multiple of
  // a day truncates toward zero and lands one day off, which is not covered
  // here (real timestamps are always positive).
  expect.text(DateUtils.dayOfWeekAbbrUtc(-DAY_NS)).equal("wed");
});

test("dayOfWeekAbbrUtc: all seven days of the week are produced across a week", func() {
  let expected = ["thu", "fri", "sat", "sun", "mon", "tue", "wed"];
  for (i in expected.keys()) {
    let dayNs : Int = i * DAY_NS;
    expect.text(DateUtils.dayOfWeekAbbrUtc(dayNs)).equal(expected[i]);
  };
});

test("dayOfWeekAbbrUtc agrees with dayOfWeekAbbr at zero timezone offset", func() {
  // At a zero offset, dayOfWeekAbbr(ts, 0) must equal dayOfWeekAbbrUtc(ts).
  let samples = [0, DAY_NS, 3 * DAY_NS, 7 * DAY_NS, -DAY_NS, 100 * DAY_NS];
  for (ts in samples.vals()) {
    expect.text(DateUtils.dayOfWeekAbbrUtc(ts))
      .equal(DateUtils.dayOfWeekAbbr(ts, 0));
  };
});

test("dayOfWeekAbbrUtc ignores timezone (takes no offset parameter)", func() {
  // dayOfWeekAbbrUtc has no offset parameter — it is always UTC. Verify that
  // the UTC result is NOT affected by what a timezone offset would do: for a
  // timestamp near midnight UTC, a positive/negative offset would shift the
  // day, but dayOfWeekAbbrUtc must stay pinned to the UTC day.
  // Epoch + 23h is still Thursday in UTC (23h < 24h).
  let justBeforeMidnight : Int = 23 * 3_600_000_000_000;
  expect.text(DateUtils.dayOfWeekAbbrUtc(justBeforeMidnight)).equal("thu");
  // One hour later (24h) crosses into Friday in UTC.
  expect.text(DateUtils.dayOfWeekAbbrUtc(24 * 3_600_000_000_000)).equal("fri");
});
