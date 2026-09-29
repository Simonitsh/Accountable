import { test; expect } "mo:test";
import Principal "mo:core/Principal";
import Common "../types/common";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import AnalyticsTypes "../types/analytics";
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

// ---------------------------------------------------------------------------
// If-then effectiveness — #missed and #inProgress excluded from both buckets
// ---------------------------------------------------------------------------

/// Builds a check-in with an explicit `executedIfThen` answer.
func makeCheckInIfThen(id : Nat, ts : Int, checkInType : Common.CheckInType, executedIfThen : Bool) : CheckInTypes.CheckIn {
  {
    id;
    goalId = 1;
    owner = Principal.fromText("aaaaa-aa");
    checkInType;
    obstacleTemplateId = null;
    timestamp = ts;
    lockInStartedAt = null;
    lockInEndedAt = null;
    executedIfThen;
    followUpDeclined = false;
    tzOffsetMinutes = null;
    note = null;
  };
};

test("if-then: #missed is excluded from both buckets", func() {
  // A success where the plan was used, plus an auto-filled #missed day that
  // must not land in the "not used" bucket.
  let checkIns = [
    makeCheckInIfThen(1, 0, #success, true),
    makeCheckInIfThen(2, DateUtils.DAY_NS, #missed, false),
  ];
  let ifThen = Analytics.computeIfThenEffectiveness(checkIns);
  expect.nat(ifThen.usedPlan.total).equal(1);
  expect.nat(ifThen.usedPlan.successes).equal(1);
  expect.nat(ifThen.notUsedPlan.total).equal(0);
  expect.nat(ifThen.notUsedPlan.successes).equal(0);
});

test("if-then: #inProgress is excluded from both buckets", func() {
  let checkIns = [
    makeCheckInIfThen(1, 0, #inProgress, true),
    makeCheckInIfThen(2, DateUtils.DAY_NS, #success, false),
  ];
  let ifThen = Analytics.computeIfThenEffectiveness(checkIns);
  expect.nat(ifThen.usedPlan.total).equal(0);
  expect.nat(ifThen.notUsedPlan.total).equal(1);
  expect.nat(ifThen.notUsedPlan.successes).equal(1);
});

test("if-then: a skip with executedIfThen = true counts on the used side", func() {
  let checkIns = [makeCheckInIfThen(1, 0, #skip, true)];
  let ifThen = Analytics.computeIfThenEffectiveness(checkIns);
  expect.nat(ifThen.usedPlan.total).equal(1);
  expect.nat(ifThen.usedPlan.successes).equal(0);
  expect.nat(ifThen.notUsedPlan.total).equal(0);
});

test("if-then: #missedCheckIn and #missedCheckOut stay in the buckets", func() {
  let checkIns = [
    makeCheckInIfThen(1, 0, #missedCheckIn, true),
    makeCheckInIfThen(2, DateUtils.DAY_NS, #missedCheckOut, false),
  ];
  let ifThen = Analytics.computeIfThenEffectiveness(checkIns);
  expect.nat(ifThen.usedPlan.total).equal(1);
  expect.nat(ifThen.notUsedPlan.total).equal(1);
});

test("computeHabitAnalytics: a habit with no if-then plan reports zeros for both buckets", func() {
  // makeHabit() has ifThenPlan = "".
  let checkIns = [
    makeCheckInIfThen(1, 0, #success, true),
    makeCheckInIfThen(2, DateUtils.DAY_NS, #success, false),
  ];
  let analytics = Analytics.computeHabitAnalytics(makeHabit(), checkIns);
  expect.nat(analytics.ifThenEffectiveness.usedPlan.total).equal(0);
  expect.nat(analytics.ifThenEffectiveness.notUsedPlan.total).equal(0);
});

test("computeHabitAnalytics: a habit WITH a plan reports its real split", func() {
  let habit = { makeHabit() with ifThenPlan = "After coffee, I will run" };
  let checkIns = [
    makeCheckInIfThen(1, 0, #success, true),
    makeCheckInIfThen(2, DateUtils.DAY_NS, #success, false),
  ];
  let analytics = Analytics.computeHabitAnalytics(habit, checkIns);
  expect.nat(analytics.ifThenEffectiveness.usedPlan.total).equal(1);
  expect.nat(analytics.ifThenEffectiveness.notUsedPlan.total).equal(1);
});

// ---------------------------------------------------------------------------
// Best / worst day — MIN_DAY_SAMPLE, tie-breaks, and the gap gate
// ---------------------------------------------------------------------------

/// Builds a DayOfWeekStat directly so best/worst selection can be exercised
/// without constructing real timestamps.
func makeDow(dayOfWeek : Nat, successes : Nat, total : Nat) : AnalyticsTypes.DayOfWeekStat {
  {
    dayOfWeek;
    dayName = "day";
    successes;
    total;
    rate = if (total == 0) 0.0 else successes.toFloat() / total.toFloat();
  };
};

test("best/worst: a 1/1 Wednesday does NOT beat a Thursday at 20/25", func() {
  // Wednesday (3) has a perfect but tiny sample; Thursday (4) has a real one.
  // Wednesday is below MIN_DAY_SAMPLE, so it is not eligible at all — and with
  // only Thursday eligible, both extremes are null rather than naming the
  // tiny Wednesday as best.
  let stats = [
    makeDow(3, 1, 1),
    makeDow(4, 20, 25),
  ];
  let (best, worst) = Analytics.pickBestWorst(stats);
  expect.bool(best == null).isTrue();
  expect.bool(worst == null).isTrue();
});

test("best/worst: an ineligible tiny day is ignored while two real days compete", func() {
  // Wednesday (3) at 1/1 is below MIN_DAY_SAMPLE and must be ignored. Monday
  // (1) at 9/10 and Thursday (4) at 5/10 are both eligible; Monday is best,
  // Thursday is worst, and the tiny Wednesday is never named.
  let stats = [
    makeDow(1, 9, 10),
    makeDow(3, 1, 1),
    makeDow(4, 5, 10),
  ];
  let (best, worst) = Analytics.pickBestWorst(stats);
  expect.bool(best == ?1).isTrue();
  expect.bool(worst == ?4).isTrue();
});

test("best/worst: all weekdays at equal rate → both null", func() {
  let stats = [
    makeDow(1, 4, 5),
    makeDow(2, 4, 5),
    makeDow(3, 4, 5),
  ];
  let (best, worst) = Analytics.pickBestWorst(stats);
  expect.bool(best == null).isTrue();
  expect.bool(worst == null).isTrue();
});

test("best/worst: a single eligible weekday → both null", func() {
  let stats = [
    makeDow(1, 5, 5),
    makeDow(2, 1, 1), // below MIN_DAY_SAMPLE, not eligible
  ];
  let (best, worst) = Analytics.pickBestWorst(stats);
  expect.bool(best == null).isTrue();
  expect.bool(worst == null).isTrue();
});

test("best/worst: a rate gap under 0.15 → both null", func() {
  // 0.80 vs 0.70 — a 0.10 gap, too close to call.
  let stats = [
    makeDow(1, 8, 10),
    makeDow(2, 7, 10),
  ];
  let (best, worst) = Analytics.pickBestWorst(stats);
  expect.bool(best == null).isTrue();
  expect.bool(worst == null).isTrue();
});

test("best/worst: a gap of at least 0.15 reports both, and they differ", func() {
  // 0.90 vs 0.50 — a 0.40 gap.
  let stats = [
    makeDow(1, 9, 10),
    makeDow(2, 5, 10),
  ];
  let (best, worst) = Analytics.pickBestWorst(stats);
  expect.bool(best == ?1).isTrue();
  expect.bool(worst == ?2).isTrue();
  expect.bool(best != worst).isTrue();
});

test("best/worst: equal rates tie-break by larger total, then earlier weekday", func() {
  // Monday (1) and Tuesday (2) both at 1.0; Tuesday has the larger total, so
  // it wins best. Wednesday (3) at 0.0 is the worst.
  let stats = [
    makeDow(1, 4, 4),
    makeDow(2, 8, 8),
    makeDow(3, 0, 4),
  ];
  let (best, worst) = Analytics.pickBestWorst(stats);
  expect.bool(best == ?2).isTrue();
  expect.bool(worst == ?3).isTrue();
});

// ---------------------------------------------------------------------------
// Category breakdown — habitCount
// ---------------------------------------------------------------------------

test("computeCategoryBreakdown: habitCount is 0 for empty categories", func() {
  let cats = Analytics.computeCategoryBreakdown([], []);
  expect.nat(cats.size()).equal(5);
  for (c in cats.values()) {
    expect.nat(c.habitCount).equal(0);
  };
});

test("computeCategoryBreakdown: habitCount counts the caller's habits per category", func() {
  let habits = [
    makeGoal(1, #Health),
    makeGoal(2, #Health),
    makeGoal(3, #Learning),
  ];
  let cats = Analytics.computeCategoryBreakdown(habits, []);
  // #Health is first, #Learning second in the fixed category list.
  expect.nat(cats[0].habitCount).equal(2);
  expect.nat(cats[1].habitCount).equal(1);
  expect.nat(cats[2].habitCount).equal(0);
  expect.nat(cats[3].habitCount).equal(0);
  expect.nat(cats[4].habitCount).equal(0);
});
