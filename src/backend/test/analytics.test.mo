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
    followUpDeclined = false;
    tzOffsetMinutes = null;
    note = null;
  };
};

/// Builds a CheckIn with an explicit recorded timezone offset.
func makeCheckInTz(id : Nat, ts : Int, checkInType : Common.CheckInType, tzOffsetMinutes : ?Int) : CheckInTypes.CheckIn {
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
    followUpDeclined = false;
    tzOffsetMinutes;
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
    obstacleTemplateIds = [1];
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

/// Builds a minimal Goal storage record for computeCategoryBreakdown, which
/// takes the shared `Goal` type (not the `HabitPublic` projection). Only
/// `id` and `category` matter for category attribution.
func makeGoal(id : Nat, category : GoalTypes.GoalCategory) : GoalTypes.Goal {
  {
    id;
    owner = Principal.fromText("aaaaa-aa");
    var goalId = ?1;
    var wish = "wish";
    var wishDescription = "desc";
    outcome = "outcome";
    obstacleTemplateIds = [1];
    var ifThenPlan = "";
    var state = #active;
    createdAt = 0;
    var updatedAt = 0;
    var themeColor = null;
    var isLockIn = false;
    var startTime = null;
    var endTime = null;
    var lastEditedAt = null;
    var lockInDurationMinutes = 0;
    var startTimeMinutes = 0;
    var endTimeMinutes = 0;
    var scheduledDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    var category;
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

// ---------------------------------------------------------------------------
// computeHabitAnalytics() — predicted obstacles are per-habit, never pooled
// ---------------------------------------------------------------------------

test("computeHabitAnalytics: predicted obstacles are the habit's own only", func() {
  let habit = makeHabit(); // obstacleTemplateIds = [1]
  let analytics = Analytics.computeHabitAnalytics(habit, []);

  // Exactly the habit's own prediction, with count 1 — not a cross-habit pool.
  expect.nat(analytics.predictedObstacles.size()).equal(1);
  expect.nat(analytics.predictedObstacles[0].count).equal(1);
  expect.nat(analytics.predictedObstacles[0].obstacleTemplateId ?? 0).equal(1);
});

test("computeHabitAnalytics: a habit with no predictions reports an empty list", func() {
  let habit = { makeHabit() with obstacleTemplateIds = [] };
  let analytics = Analytics.computeHabitAnalytics(habit, []);
  expect.nat(analytics.predictedObstacles.size()).equal(0);
});

// ---------------------------------------------------------------------------
// Lock-In counting — #inProgress is never counted in any total or rate
// ---------------------------------------------------------------------------

test("Lock-In day: #inProgress + #success counts total 1, successes 1, rate 1.0", func() {
  // A Lock-In session writes an #inProgress at start and a separate #success
  // at checkout. Only the terminal #success may count.
  let checkIns = [
    makeCheckIn(1, 0, #inProgress),
    makeCheckIn(2, DateUtils.DAY_NS, #success),
  ];

  // Overall if-then effectiveness.
  let ifThen = Analytics.computeIfThenEffectiveness(checkIns);
  expect.nat(ifThen.notUsedPlan.total).equal(1);
  expect.nat(ifThen.notUsedPlan.successes).equal(1);
  expect.bool(ifThen.notUsedPlan.rate == 1.0).isTrue();

  // Day-of-week.
  let dow = Analytics.computeDayOfWeek(checkIns, 0);
  var dowTotal : Nat = 0;
  var dowSuccess : Nat = 0;
  for (s in dow.values()) {
    dowTotal += s.total;
    dowSuccess += s.successes;
  };
  expect.nat(dowTotal).equal(1);
  expect.nat(dowSuccess).equal(1);

  // Category breakdown.
  let habit = makeGoal(1, #Health); // category = #Health
  let cats = Analytics.computeCategoryBreakdown([habit], checkIns);
  let health = cats[0]; // #Health is first in the category list
  expect.nat(health.total).equal(1);
  expect.nat(health.successes).equal(1);
  expect.bool(health.rate == 1.0).isTrue();
});

test("Lock-In missedCheckOut: #inProgress + #missedCheckOut counts total 1, successes 0", func() {
  let checkIns = [
    makeCheckIn(1, 0, #inProgress),
    makeCheckIn(2, DateUtils.DAY_NS, #missedCheckOut),
  ];

  let ifThen = Analytics.computeIfThenEffectiveness(checkIns);
  expect.nat(ifThen.notUsedPlan.total).equal(1);
  expect.nat(ifThen.notUsedPlan.successes).equal(0);
  expect.bool(ifThen.notUsedPlan.rate == 0.0).isTrue();

  let dow = Analytics.computeDayOfWeek(checkIns, 0);
  var dowTotal : Nat = 0;
  for (s in dow.values()) { dowTotal += s.total };
  expect.nat(dowTotal).equal(1);

  let habit = makeGoal(1, #Health);
  let cats = Analytics.computeCategoryBreakdown([habit], checkIns);
  expect.nat(cats[0].total).equal(1);
  expect.nat(cats[0].successes).equal(0);
});

test("an #inProgress-only day contributes nothing to any total", func() {
  let checkIns = [makeCheckIn(1, 0, #inProgress)];
  let ifThen = Analytics.computeIfThenEffectiveness(checkIns);
  expect.nat(ifThen.usedPlan.total).equal(0);
  expect.nat(ifThen.notUsedPlan.total).equal(0);

  let dow = Analytics.computeDayOfWeek(checkIns, 0);
  var dowTotal : Nat = 0;
  for (s in dow.values()) { dowTotal += s.total };
  expect.nat(dowTotal).equal(0);

  let cats = Analytics.computeCategoryBreakdown([makeGoal(1, #Health)], checkIns);
  expect.nat(cats[0].total).equal(0);
});

// ---------------------------------------------------------------------------
// computeDayOfWeek() — per-check-in recorded offset, with fallback
// ---------------------------------------------------------------------------

test("computeDayOfWeek: a check-in's own tzOffsetMinutes wins over the fallback", func() {
  // 1970-01-01 23:30 UTC. With +120 it is 1970-01-02 01:30 local = Friday (5).
  // With -300 it is 1970-01-01 18:30 local = Thursday (4).
  let ts = 23 * 3_600_000_000_000 + 30 * 60_000_000_000;

  let nextDay = Analytics.computeDayOfWeek([makeCheckInTz(1, ts, #success, ?120)], 0);
  expect.nat(nextDay[5].total).equal(1);
  expect.nat(nextDay[5].successes).equal(1);
  expect.nat(nextDay[4].total).equal(0);

  let sameDay = Analytics.computeDayOfWeek([makeCheckInTz(1, ts, #success, ?(-300))], 0);
  expect.nat(sameDay[4].total).equal(1);
  expect.nat(sameDay[4].successes).equal(1);
  expect.nat(sameDay[5].total).equal(0);
});

test("computeDayOfWeek: a legacy check-in (null offset) uses the fallback argument", func() {
  // 1970-01-01 23:30 UTC with fallback +120 → Friday (5).
  let ts = 23 * 3_600_000_000_000 + 30 * 60_000_000_000;
  let stats = Analytics.computeDayOfWeek([makeCheckInTz(1, ts, #success, null)], 120);
  expect.nat(stats[5].total).equal(1);
  expect.nat(stats[5].successes).equal(1);
  expect.nat(stats[4].total).equal(0);
});
