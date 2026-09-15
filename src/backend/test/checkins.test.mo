import { test; suite; expect } "mo:test";
import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Int "mo:core/Int";
import DateUtils "../lib/date-utils";
import CheckIns "../lib/checkins";
import Common "../types/common";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import AuthTypes "../types/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic time constants (nanoseconds). Never use Time.now().
// Reference date: Monday 2024-01-01 00:00:00 UTC = 1_704_067_200_000_000_000 ns.
// ─────────────────────────────────────────────────────────────────────────────
let DAY_NS : Int = DateUtils.DAY_NS; // 86_400_000_000_000
let HOUR_NS : Int = 3_600_000_000_000;
let MIN_NS : Int = 60_000_000_000;
let MON_2024_01_01 : Int = 1_704_067_200_000_000_000; // Monday 00:00 UTC

// Timezone offsets in minutes
let UTC_0 : Int = 0;
let UTC_MINUS_8 : Int = -8 * 60; // -480
let UTC_PLUS_10 : Int = 10 * 60; // +600

// ─────────────────────────────────────────────────────────────────────────────
// sameDay() — day-boundary logic
// ─────────────────────────────────────────────────────────────────────────────
suite(
  "sameDay() day-boundary logic",
  func() {
    test(
      "same-day timestamps at zero offset are the same day",
      func() {
        let a = MON_2024_01_01 + 10 * HOUR_NS; // Mon 10:00 UTC
        let b = MON_2024_01_01 + 23 * HOUR_NS; // Mon 23:00 UTC
        expect.bool(DateUtils.sameDay(a, b, UTC_0)).isTrue();
      },
    );

    test(
      "timestamps across a midnight crossing at zero offset are different days",
      func() {
        let a = MON_2024_01_01 + 23 * HOUR_NS + 59 * MIN_NS + 59_000_000_000; // Mon 23:59:59.999
        let b = MON_2024_01_01 + DAY_NS + 1_000_000_000; // Tue 00:00:00.001
        expect.bool(DateUtils.sameDay(a, b, UTC_0)).isFalse();
      },
    );

    test(
      "negative timezone offset (UTC-8) can move a UTC timestamp to a different local calendar day",
      func() {
        // 2024-01-01 02:00 UTC with UTC-8 → local 2023-12-31 18:00 (Dec 31)
        let a = MON_2024_01_01 + 2 * HOUR_NS;
        // 2024-01-01 10:00 UTC with UTC-8 → local 2024-01-01 02:00 (Jan 1)
        let b = MON_2024_01_01 + 10 * HOUR_NS;
        // Both are Jan 1 in UTC but different local days → not the same day
        expect.bool(DateUtils.sameDay(a, b, UTC_MINUS_8)).isFalse();
      },
    );

    test(
      "negative timezone offset (UTC-8) keeps same-local-day timestamps together",
      func() {
        // 2024-01-01 02:00 UTC → local 2023-12-31 18:00
        let a = MON_2024_01_01 + 2 * HOUR_NS;
        // 2024-01-01 07:00 UTC → local 2023-12-31 23:00 (still Dec 31)
        let b = MON_2024_01_01 + 7 * HOUR_NS;
        expect.bool(DateUtils.sameDay(a, b, UTC_MINUS_8)).isTrue();
      },
    );

    test(
      "positive timezone offset (UTC+10) can move a UTC timestamp to the next local calendar day",
      func() {
        // 2024-01-01 20:00 UTC with UTC+10 → local 2024-01-02 06:00 (Jan 2)
        let a = MON_2024_01_01 + 20 * HOUR_NS;
        // 2024-01-01 10:00 UTC with UTC+10 → local 2024-01-01 20:00 (Jan 1)
        let b = MON_2024_01_01 + 10 * HOUR_NS;
        // Different local days → not the same day
        expect.bool(DateUtils.sameDay(a, b, UTC_PLUS_10)).isFalse();
      },
    );

    test(
      "positive timezone offset (UTC+10) keeps same-next-day timestamps together",
      func() {
        // 2024-01-01 20:00 UTC → local 2024-01-02 06:00
        let a = MON_2024_01_01 + 20 * HOUR_NS;
        // 2024-01-02 05:00 UTC → local 2024-01-02 15:00 (still Jan 2)
        let b = MON_2024_01_01 + DAY_NS + 5 * HOUR_NS;
        expect.bool(DateUtils.sameDay(a, b, UTC_PLUS_10)).isTrue();
      },
    );

    test(
      "exact local midnight boundary (00:00) is the same day as the preceding 23:59:59",
      func() {
        let midnight = MON_2024_01_01; // Mon 00:00:00.000 UTC
        let beforeMidnight = MON_2024_01_01 - 1_000_000_000; // Sun 23:59:59.999 UTC
        expect.bool(DateUtils.sameDay(midnight, beforeMidnight, UTC_0)).isFalse();
        // Mon 00:00 and Mon 23:59:59.999 are the same day
        let lateMon = MON_2024_01_01 + DAY_NS - 1_000_000_000;
        expect.bool(DateUtils.sameDay(midnight, lateMon, UTC_0)).isTrue();
      },
    );

    test(
      "exact local midnight boundary with a positive offset",
      func() {
        // UTC+10: local midnight (Jan 2 00:00) = Jan 1 14:00 UTC
        let localMidnight = MON_2024_01_01 + 14 * HOUR_NS;
        // One ns before local midnight = Jan 1 13:59:59.999 UTC → local Jan 1 23:59:59.999
        let beforeLocalMidnight = localMidnight - 1_000_000_000;
        expect.bool(DateUtils.sameDay(localMidnight, beforeLocalMidnight, UTC_PLUS_10)).isFalse();
        // localMidnight and localMidnight + 1ns are the same local day
        let afterLocalMidnight = localMidnight + 1_000_000_000;
        expect.bool(DateUtils.sameDay(localMidnight, afterLocalMidnight, UTC_PLUS_10)).isTrue();
      },
    );

    test(
      "exact local midnight boundary with a negative offset",
      func() {
        // UTC-8: local midnight (Jan 1 00:00) = Jan 1 08:00 UTC
        let localMidnight = MON_2024_01_01 + 8 * HOUR_NS;
        // One ns before local midnight = Jan 1 07:59:59.999 UTC → local Dec 31 23:59:59.999
        let beforeLocalMidnight = localMidnight - 1_000_000_000;
        expect.bool(DateUtils.sameDay(localMidnight, beforeLocalMidnight, UTC_MINUS_8)).isFalse();
        // localMidnight and localMidnight + 1ns are the same local day
        let afterLocalMidnight = localMidnight + 1_000_000_000;
        expect.bool(DateUtils.sameDay(localMidnight, afterLocalMidnight, UTC_MINUS_8)).isTrue();
      },
    );
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// dayOfWeek() — mod-7 day-of-week wraparound
// ─────────────────────────────────────────────────────────────────────────────
suite(
  "dayOfWeek() mod-7 wraparound",
  func() {
    test(
      "epoch (1970-01-01) is Thursday (index 4)",
      func() {
        expect.nat(DateUtils.dayOfWeek(0, UTC_0)).equal(4);
      },
    );

    test(
      "three days after epoch wraps to Sunday (index 0)",
      func() {
        expect.nat(DateUtils.dayOfWeek(3 * DAY_NS, UTC_0)).equal(0);
      },
    );

    test(
      "exact whole-day multiple before epoch wraps to Wednesday (index 3)",
      func() {
        // -1 * DAY_NS is an exact whole-day multiple, so integer division
        // truncates cleanly to -1 day. This only verifies the exact-multiple
        // boundary — a negative timestamp that is NOT an exact multiple of a
        // day truncates toward zero and lands one day off, which is not
        // covered here (real timestamps are always positive).
        expect.nat(DateUtils.dayOfWeek(-1 * DAY_NS, UTC_0)).equal(3);
      },
    );

    test(
      "seven days after epoch returns to Thursday (index 4)",
      func() {
        expect.nat(DateUtils.dayOfWeek(7 * DAY_NS, UTC_0)).equal(4);
      },
    );

    test(
      "Monday 2024-01-01 is index 1",
      func() {
        expect.nat(DateUtils.dayOfWeek(MON_2024_01_01, UTC_0)).equal(1);
      },
    );

    test(
      "dayOfWeekAbbr maps indices to abbreviations",
      func() {
        expect.text(DateUtils.dayOfWeekAbbr(MON_2024_01_01, UTC_0)).equal("mon");
        expect.text(DateUtils.dayOfWeekAbbr(0, UTC_0)).equal("thu");
        expect.text(DateUtils.dayOfWeekAbbr(3 * DAY_NS, UTC_0)).equal("sun");
      },
    );

    test(
      "dayOfWeekAbbrUtc is UTC-only (no offset applied)",
      func() {
        // 2024-01-01 20:00 UTC is Monday in UTC
        expect.text(DateUtils.dayOfWeekAbbrUtc(MON_2024_01_01 + 20 * HOUR_NS)).equal("mon");
        // But with UTC+10 it is Tuesday locally
        expect.text(DateUtils.dayOfWeekAbbr(MON_2024_01_01 + 20 * HOUR_NS, UTC_PLUS_10)).equal("tue");
      },
    );
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// autoFailMissedGoals() — midnight auto-fail per-owner timezone
// ─────────────────────────────────────────────────────────────────────────────
// Helpers to build minimal in-memory records.
func makeProfile(owner : Common.UserId, tzOffsetMinutes : Int) : AuthTypes.UserProfile {
  {
    id = owner;
    var username = "u";
    var displayName = "U";
    var avatarShape = null;
    var avatarColor = null;
    var avatarColorMode = #Fill;
    var timezone = "tz";
    var bio = null;
    var email = null;
    var timezoneOffsetMinutes = tzOffsetMinutes;
    var role = #user;
    var createdAt = 0;
  };
};

func makeGoal(
  id : Common.GoalId,
  owner : Common.UserId,
  scheduledDays : [Text],
  isLockIn : Bool,
) : GoalTypes.Goal {
  {
    id;
    owner;
    var goalId = ?id;
    var wish = "wish";
    var wishDescription = "desc";
    outcome = "outcome";
    obstacleTemplateId = null;
    var ifThenPlan = "";
    var state = #active;
    createdAt = 0;
    var updatedAt = 0;
    var iconName = null;
    var themeColor = null;
    var isLockIn;
    var startTime = null;
    var endTime = null;
    var lastEditedAt = null;
    var lockInDurationMinutes = 0;
    var startTimeMinutes = 0;
    var endTimeMinutes = 0;
    var scheduledDays;
    var category = #Health;
  };
};

func makeCheckIn(
  id : Common.CheckInId,
  goalId : Common.GoalId,
  owner : Common.UserId,
  checkInType : Common.CheckInType,
  timestamp : Int,
) : CheckInTypes.CheckIn {
  {
    id;
    goalId;
    owner;
    checkInType;
    obstacleTemplateId = null;
    timestamp;
    lockInStartedAt = null;
    lockInEndedAt = null;
    executedIfThen = false;
    note = null;
  };
};

let ALL_DAYS : [Text] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
let WEEKDAYS : [Text] = ["mon", "tue", "wed", "thu", "fri"];

suite(
  "autoFailMissedGoals() midnight boundary",
  func() {
    test(
      "fails a goal with no terminal check-in on yesterday (UTC owner)",
      func() {
        let owner = Principal.fromText("aaaaa-aa");
        let checkIns = List.empty<CheckInTypes.CheckIn>();
        let goals = List.empty<GoalTypes.Goal>();
        goals.add(makeGoal(1, owner, ALL_DAYS, false));
        let nextId : [var Nat] = [var 0];
        let profiles = Map.empty<Common.UserId, AuthTypes.UserProfile>();
        profiles.add(owner, makeProfile(owner, UTC_0));
        // now = Monday 00:00 UTC → yesterday = Sunday (scheduled, no check-in)
        let count = CheckIns.autoFailMissedGoals(checkIns, goals, nextId, profiles, MON_2024_01_01);
        expect.nat(count).equal(1);
        expect.nat(nextId[0]).equal(1);
        // The auto-failed check-in was recorded as a #skip
        let recorded = checkIns.toArray();
        expect.nat(recorded.size()).equal(1);
        expect.nat(recorded[0].goalId).equal(1);
        expect.principal(recorded[0].owner).equal(owner);
        switch (recorded[0].checkInType) {
          case (#skip) {};
          case (_) { assert false };
        };
        // timestamp is one ns before yesterday's local midnight (Sunday 23:59:59.999999999 UTC)
        expect.int(recorded[0].timestamp).equal(MON_2024_01_01 - 1);
      },
    );

    test(
      "does not fail a goal already checked in on the target day",
      func() {
        let owner = Principal.fromText("aaaaa-aa");
        let checkIns = List.empty<CheckInTypes.CheckIn>();
        // A #success check-in on Sunday (yesterday for UTC owner at Monday 00:00)
        checkIns.add(makeCheckIn(0, 1, owner, #success, MON_2024_01_01 - 12 * HOUR_NS));
        let goals = List.empty<GoalTypes.Goal>();
        goals.add(makeGoal(1, owner, ALL_DAYS, false));
        let nextId : [var Nat] = [var 0];
        let profiles = Map.empty<Common.UserId, AuthTypes.UserProfile>();
        profiles.add(owner, makeProfile(owner, UTC_0));
        let count = CheckIns.autoFailMissedGoals(checkIns, goals, nextId, profiles, MON_2024_01_01);
        expect.nat(count).equal(0);
        expect.nat(nextId[0]).equal(0);
        expect.nat(checkIns.toArray().size()).equal(1); // unchanged
      },
    );

    test(
      "skips a rest day (yesterday not in scheduledDays)",
      func() {
        let owner = Principal.fromText("aaaaa-aa");
        let checkIns = List.empty<CheckInTypes.CheckIn>();
        let goals = List.empty<GoalTypes.Goal>();
        // Owner only schedules weekdays; yesterday (Sunday) is a rest day
        goals.add(makeGoal(1, owner, WEEKDAYS, false));
        let nextId : [var Nat] = [var 0];
        let profiles = Map.empty<Common.UserId, AuthTypes.UserProfile>();
        profiles.add(owner, makeProfile(owner, UTC_0));
        let count = CheckIns.autoFailMissedGoals(checkIns, goals, nextId, profiles, MON_2024_01_01);
        expect.nat(count).equal(0);
        expect.nat(checkIns.toArray().size()).equal(0);
      },
    );

    test(
      "skips Lock-In goals (they manage their own missed states)",
      func() {
        let owner = Principal.fromText("aaaaa-aa");
        let checkIns = List.empty<CheckInTypes.CheckIn>();
        let goals = List.empty<GoalTypes.Goal>();
        goals.add(makeGoal(1, owner, ALL_DAYS, true)); // isLockIn = true
        let nextId : [var Nat] = [var 0];
        let profiles = Map.empty<Common.UserId, AuthTypes.UserProfile>();
        profiles.add(owner, makeProfile(owner, UTC_0));
        let count = CheckIns.autoFailMissedGoals(checkIns, goals, nextId, profiles, MON_2024_01_01);
        expect.nat(count).equal(0);
        expect.nat(checkIns.toArray().size()).equal(0);
      },
    );

    test(
      "skips non-active goals",
      func() {
        let owner = Principal.fromText("aaaaa-aa");
        let checkIns = List.empty<CheckInTypes.CheckIn>();
        let goals = List.empty<GoalTypes.Goal>();
        let g = makeGoal(1, owner, ALL_DAYS, false);
        g.state := #paused;
        goals.add(g);
        let nextId : [var Nat] = [var 0];
        let profiles = Map.empty<Common.UserId, AuthTypes.UserProfile>();
        profiles.add(owner, makeProfile(owner, UTC_0));
        let count = CheckIns.autoFailMissedGoals(checkIns, goals, nextId, profiles, MON_2024_01_01);
        expect.nat(count).equal(0);
      },
    );

    test(
      "owners in different timezones: one owner's yesterday is not another's",
      func() {
        // now = Monday 2024-01-01 20:00 UTC
        let nowNs = MON_2024_01_01 + 20 * HOUR_NS;
        let ownerA = Principal.fromText("aaaaa-aa"); // UTC (offset 0)
        let ownerB = Principal.fromText("2vxsx-fae"); // UTC+10 (offset +600)

        let checkIns = List.empty<CheckInTypes.CheckIn>();
        let goals = List.empty<GoalTypes.Goal>();
        // A schedules only weekdays. A's yesterday (Sunday) is a rest day → not failed.
        goals.add(makeGoal(1, ownerA, WEEKDAYS, false));
        // B schedules every day. B's yesterday (Monday) is scheduled → failed.
        goals.add(makeGoal(2, ownerB, ALL_DAYS, false));

        let nextId : [var Nat] = [var 0];
        let profiles = Map.empty<Common.UserId, AuthTypes.UserProfile>();
        profiles.add(ownerA, makeProfile(ownerA, UTC_0));
        profiles.add(ownerB, makeProfile(ownerB, UTC_PLUS_10));

        let count = CheckIns.autoFailMissedGoals(checkIns, goals, nextId, profiles, nowNs);
        // Only B is failed (A's yesterday is a rest day)
        expect.nat(count).equal(1);
        expect.nat(nextId[0]).equal(1);
        let recorded = checkIns.toArray();
        expect.nat(recorded.size()).equal(1);
        expect.nat(recorded[0].goalId).equal(2);
        expect.principal(recorded[0].owner).equal(ownerB);
      },
    );

    test(
      "falls back to UTC offset 0 when no profile exists for the owner",
      func() {
        let owner = Principal.fromText("aaaaa-aa");
        let checkIns = List.empty<CheckInTypes.CheckIn>();
        let goals = List.empty<GoalTypes.Goal>();
        goals.add(makeGoal(1, owner, ALL_DAYS, false));
        let nextId : [var Nat] = [var 0];
        let profiles = Map.empty<Common.UserId, AuthTypes.UserProfile>(); // empty
        let count = CheckIns.autoFailMissedGoals(checkIns, goals, nextId, profiles, MON_2024_01_01);
        expect.nat(count).equal(1);
      },
    );
  },
);
