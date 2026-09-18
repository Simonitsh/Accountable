import { test; expect } "mo:test";
import Principal "mo:core/Principal";
import Common "../types/common";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import DateUtils "../lib/date-utils";
import Analytics "../lib/analytics";

/// Builds a minimal CheckIn record. Only `timestamp` and `checkInType` matter
/// for the day-of-week bucketing under test; the rest are fixed placeholders.
func makeCheckIn(id : Nat, ts : Int, checkInType : Common.CheckInType) : CheckInTypes.CheckIn {
  {
    id;
    goalId = 1;
    owner = Principal.fromText("aaaaa-aa");
    checkInType;
    obstacleTemplateId = null;
    timestamp = ts;
    lockInStartedAt = null;
    lockInEndedAt = null;
    executedIfThen = false;
    note = null;
  };
};

// ---------------------------------------------------------------------------
// dayOfWeek() — mod-7 wraparound and timezone offsets
// ---------------------------------------------------------------------------

test("dayOfWeek: Unix epoch (1970-01-01) is Thursday = index 4", func() {
  // 0 ns = 1970-01-01 00:00:00 UTC, a Thursday.
  expect.nat(DateUtils.dayOfWeek(0, 0)).equal(4);
});

test("dayOfWeek: mod-7 wraparound — 1970-01-04 is Sunday = index 0", func() {
  // 3 days after the epoch = 1970-01-04 00:00:00 UTC, a Sunday.
  // (4 + 3) % 7 = 0 — exercises the wraparound past Saturday.
  let ts = 3 * DateUtils.DAY_NS;
  expect.nat(DateUtils.dayOfWeek(ts, 0)).equal(0);
});

test("dayOfWeek: positive offset shifts local weekday forward past midnight", func() {
  // 1970-01-01 23:00 UTC is a Thursday (index 4) in UTC.
  let ts = 23 * 3_600_000_000_000;
  expect.nat(DateUtils.dayOfWeek(ts, 0)).equal(4);
  // With UTC+2 the same instant is 1970-01-02 01:00 local = Friday (index 5).
  expect.nat(DateUtils.dayOfWeek(ts, 120)).equal(5);
});

test("dayOfWeek: negative offset shifts local weekday backward past midnight", func() {
  // 1970-01-04 00:00 UTC is a Sunday (index 0) in UTC.
  let ts = 3 * DateUtils.DAY_NS;
  expect.nat(DateUtils.dayOfWeek(ts, 0)).equal(0);
  // With UTC-1 the same instant is 1970-01-03 23:00 local = Saturday (index 6).
  expect.nat(DateUtils.dayOfWeek(ts, -60)).equal(6);
});

// ---------------------------------------------------------------------------
// computeDayOfWeek() — local-day bucketing (locks in the raw-UTC fix)
// ---------------------------------------------------------------------------

test("computeDayOfWeek: check-in near local midnight with positive offset buckets to local day", func() {
  // 1970-01-01 23:00 UTC = Thursday (index 4) in UTC, but Friday (index 5)
  // locally at UTC+2. The check-in must land on Friday, not Thursday.
  let ts = 23 * 3_600_000_000_000;
  let checkIns = [makeCheckIn(1, ts, #success)];
  let stats = Analytics.computeDayOfWeek(checkIns, 120);

  // Friday (index 5) holds the check-in.
  expect.nat(stats[5].total).equal(1);
  expect.nat(stats[5].successes).equal(1);
  // Thursday (index 4) — the raw UTC day — must be empty.
  expect.nat(stats[4].total).equal(0);
});

test("computeDayOfWeek: check-in near local midnight with negative offset buckets to local day", func() {
  // 1970-01-04 00:00 UTC = Sunday (index 0) in UTC, but Saturday (index 6)
  // locally at UTC-1. The check-in must land on Saturday, not Sunday.
  let ts = 3 * DateUtils.DAY_NS;
  let checkIns = [makeCheckIn(1, ts, #success)];
  let stats = Analytics.computeDayOfWeek(checkIns, -60);

  // Saturday (index 6) holds the check-in.
  expect.nat(stats[6].total).equal(1);
  expect.nat(stats[6].successes).equal(1);
  // Sunday (index 0) — the raw UTC day — must be empty.
  expect.nat(stats[0].total).equal(0);
});

test("computeDayOfWeek: multiple check-ins across the wraparound land on distinct local days", func() {
  // Two check-ins: one Thursday (UTC) that is Friday locally at UTC+2, and
  // one Sunday (UTC) that is Saturday locally at UTC-1. Each must land on its
  // own local weekday with no cross-contamination.
  let tsFriday = 23 * 3_600_000_000_000; // 1970-01-01 23:00 UTC
  let tsSaturday = 3 * DateUtils.DAY_NS; // 1970-01-04 00:00 UTC
  let checkIns = [
    makeCheckIn(1, tsFriday, #success),
    makeCheckIn(2, tsSaturday, #skip),
  ];

  let friday = Analytics.computeDayOfWeek(checkIns, 120);
  expect.nat(friday[5].total).equal(1);
  expect.nat(friday[5].successes).equal(1);
  expect.nat(friday[4].total).equal(0);

  let saturday = Analytics.computeDayOfWeek(checkIns, -60);
  expect.nat(saturday[6].total).equal(1);
  expect.nat(saturday[6].successes).equal(0); // the #skip is not a success
  expect.nat(saturday[0].total).equal(0);
});

// ---------------------------------------------------------------------------
// computeHabitAnalytics() — shown-up days count only genuine successes
// ---------------------------------------------------------------------------

func makeHabit() : GoalTypes.HabitPublic {
  {
    id = 1;
    owner = Principal.fromText("aaaaa-aa");
    goalId = 1;
    wish = "wish";
    wishDescription = "desc";
    outcome = "outcome";
    obstacleTemplateId = null;
    ifThenPlan = "";
    state = #active;
    createdAt = 0;
    updatedAt = 0;
    themeColor = null;
    isLockIn = false;
    startTime = null;
    endTime = null;
    lastEditedAt = null;
    lockInDurationMinutes = 0;
    startTimeMinutes = 0;
    endTimeMinutes = 0;
    scheduledDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    category = #Health;
  };
};

test("computeHabitAnalytics: shown-up days exclude #skip and #missed", func() {
  // One genuine success, one deliberate skip, one forgotten (missed) day.
  let checkIns = [
    makeCheckIn(1, 0, #success),
    makeCheckIn(2, DateUtils.DAY_NS, #skip),
    makeCheckIn(3, 2 * DateUtils.DAY_NS, #missed),
  ];
  let analytics = Analytics.computeHabitAnalytics(makeHabit(), checkIns);
  // Only the #success counts as a shown-up day.
  expect.nat(analytics.shownUpDays).equal(1);
});
