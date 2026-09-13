import List "mo:core/List";
import Set "mo:core/Set";
import Time "mo:core/Time";
import Common "../types/common";
import GoalTypes "../types/goals";
import CheckInTypes "../types/checkins";
import FeedTypes "../types/feed";

/// Goals — pure domain logic module.
///
/// All functions are stateless: they receive the mutable List and ID counter
/// from the caller (main.mo via the Goals module). No state is held here.
/// This module returns typed Result<T, GoalError> values — callers must handle
/// all error variants explicitly.
///
/// MACRO GOAL vs HABIT
/// ───────────────────
/// `createMacroGoal` creates a container (goalId = null) with category, wish,
/// outcome. `createHabit` creates a habit linked to an existing macro goal
/// (goalId required); the habit inherits the parent's category and its
/// wish/wishDescription/outcome are sourced from the parent (read-only).
module {
  // 86400 seconds in nanoseconds
  let DAY_NS : Int = 86_400_000_000_000;

  func sameDay(a : Common.Timestamp, b : Common.Timestamp, timezoneOffsetMinutes : Int) : Bool {
    let offsetNs = timezoneOffsetMinutes * 60 * 1_000_000_000;
    ((a + offsetNs) / DAY_NS) == ((b + offsetNs) / DAY_NS);
  };

  /// Projects a stored Goal to its macro-goal public form.
  /// Caller must ensure the Goal is a macro goal (goalId = null).
  public func toMacroGoalPublic(goal : GoalTypes.Goal) : GoalTypes.MacroGoalPublic {
    {
      id = goal.id;
      owner = goal.owner;
      wish = goal.wish;
      wishDescription = goal.wishDescription;
      outcome = goal.outcome;
      state = goal.state;
      createdAt = goal.createdAt;
      updatedAt = goal.updatedAt;
      iconName = goal.iconName;
      themeColor = goal.themeColor;
      category = goal.category;
    };
  };

  /// Projects a stored Goal to its habit public form.
  /// Caller must ensure the Goal is a habit (goalId set).
  public func toHabitPublic(goal : GoalTypes.Goal) : GoalTypes.HabitPublic {
    {
      id = goal.id;
      owner = goal.owner;
      goalId = switch (goal.goalId) { case null 0; case (?n) n };
      wish = goal.wish;
      wishDescription = goal.wishDescription;
      outcome = goal.outcome;
      obstacleTemplateId = goal.obstacleTemplateId;
      ifThenPlan = goal.ifThenPlan;
      state = goal.state;
      createdAt = goal.createdAt;
      updatedAt = goal.updatedAt;
      iconName = goal.iconName;
      themeColor = goal.themeColor;
      isLockIn = goal.isLockIn;
      startTime = goal.startTime;
      endTime = goal.endTime;
      lastEditedAt = goal.lastEditedAt;
      lockInDurationMinutes = goal.lockInDurationMinutes;
      startTimeMinutes = goal.startTimeMinutes;
      endTimeMinutes = goal.endTimeMinutes;
      scheduledDays = goal.scheduledDays;
      category = goal.category;
    };
  };

  /// Creates a new macro goal (a container). Validates that wish is non-empty.
  /// Lock-In and schedule fields are NOT accepted — macro goals do not carry
  /// them. Returns the macro goal in its public form.
  public func createMacroGoal(
    goals : List.List<GoalTypes.Goal>,
    nextId : Nat,
    caller : Common.UserId,
    request : GoalTypes.CreateMacroGoalRequest,
  ) : { #ok : GoalTypes.MacroGoalPublic; #err : GoalTypes.GoalError } {
    if (request.wish == "") return #err(#invalidInput);
    let now = Time.now();
    let goal : GoalTypes.Goal = {
      id = nextId;
      owner = caller;
      var goalId = null;
      var wish = request.wish;
      var wishDescription = request.wishDescription;
      outcome = request.outcome;
      obstacleTemplateId = null;
      var ifThenPlan = "";
      var state = #active;
      createdAt = now;
      var updatedAt = now;
      var iconName = request.iconName;
      var themeColor = request.themeColor;
      var isLockIn = false;
      var startTime = null;
      var endTime = null;
      var lastEditedAt = null;
      var lockInDurationMinutes = 0;
      var startTimeMinutes = 0;
      var endTimeMinutes = 0;
      var scheduledDays = [] : [Text];
      var category = request.category;
    };
    goals.add(goal);
    #ok(toMacroGoalPublic(goal));
  };

  /// Creates a new habit linked to an existing macro goal.
  /// `request.goalId` is REQUIRED — the habit must reference an existing
  /// macro goal owned by `caller`. The habit inherits the parent's category
  /// and its wish/outcome are sourced from the parent (read-only). The habit's
  /// wishDescription (displayed name) defaults to the parent's, but is
  /// overridden by `request.wishDescription` when the caller supplies one.
  /// Validates Lock-In overlap against the caller's other habits.
  public func createHabit(
    goals : List.List<GoalTypes.Goal>,
    nextId : Nat,
    caller : Common.UserId,
    request : GoalTypes.CreateHabitRequest,
  ) : { #ok : GoalTypes.HabitPublic; #err : GoalTypes.GoalError } {
    // Look up the parent macro goal.
    let parent = switch (goals.find(func(g : GoalTypes.Goal) : Bool {
      g.id == request.goalId and g.owner == caller and g.goalId == null;
    })) {
      case null return #err(#parentGoalRequired);
      case (?p) p;
    };

    let isLockIn = request.isLockIn;
    let lockInDurationMinutes = switch (request.lockInDurationMinutes) { case null 0; case (?n) n };
    let startTimeMinutes = switch (request.startTimeMinutes) { case null 0; case (?n) n };
    let endTimeMinutes = switch (request.endTimeMinutes) { case null 0; case (?n) n };
    let scheduledDays = switch (request.scheduledDays) { case null GoalTypes.DEFAULT_SCHEDULED_DAYS; case (?d) d };
    // Habit name: prefer the user's typed wishDescription when supplied;
    // otherwise fall back to the parent macro goal's wishDescription.
    let wishDescription = switch (request.wishDescription) {
      case null parent.wishDescription;
      case (?name) name;
    };

    // Validate Lock-In overlap against the caller's other habits.
    if (isLockIn and startTimeMinutes > 0 and endTimeMinutes > 0) {
      let overlap = goals.find(func(g : GoalTypes.Goal) : Bool {
        g.owner == caller and
        g.id != nextId and
        g.goalId != null and
        g.isLockIn and
        g.startTimeMinutes > 0 and g.endTimeMinutes > 0 and
        // Two [start, end] windows overlap iff startA < endB and startB < endA.
        startTimeMinutes < g.endTimeMinutes and
        g.startTimeMinutes < endTimeMinutes;
      });
      switch (overlap) {
        case (?g) return #err(#lockInOverlap("Lock-In window overlaps with another habit"));
        case null {};
      };
    };

    let now = Time.now();
    let habit : GoalTypes.Goal = {
      id = nextId;
      owner = caller;
      var goalId = ?request.goalId;
      var wish = parent.wish;
      var wishDescription = wishDescription;
      outcome = parent.outcome;
      obstacleTemplateId = request.obstacleTemplateId;
      var ifThenPlan = request.ifThenPlan;
      var state = #active;
      createdAt = now;
      var updatedAt = now;
      var iconName = request.iconName;
      var themeColor = request.themeColor;
      var isLockIn = isLockIn;
      var startTime = request.startTime;
      var endTime = request.endTime;
      var lastEditedAt = null;
      var lockInDurationMinutes = lockInDurationMinutes;
      var startTimeMinutes = startTimeMinutes;
      var endTimeMinutes = endTimeMinutes;
      var scheduledDays = scheduledDays;
      var category = parent.category;
    };
    goals.add(habit);
    #ok(toHabitPublic(habit));
  };

  /// Retrieves a macro goal by ID. Only the owning caller can see it.
  /// Returns null if the record is a habit or not owned by the caller.
  public func getMacroGoal(
    goals : List.List<GoalTypes.Goal>,
    goalId : Common.GoalId,
    caller : Common.UserId,
  ) : ?GoalTypes.MacroGoalPublic {
    switch (goals.find(func(g : GoalTypes.Goal) : Bool {
      g.id == goalId and g.owner == caller and g.goalId == null;
    })) {
      case null null;
      case (?g) ?toMacroGoalPublic(g);
    };
  };

  /// Retrieves a habit by ID. Only the owning caller can see it.
  /// Returns null if the record is a macro goal or not owned by the caller.
  public func getHabit(
    goals : List.List<GoalTypes.Goal>,
    habitId : Common.GoalId,
    caller : Common.UserId,
  ) : ?GoalTypes.HabitPublic {
    switch (goals.find(func(g : GoalTypes.Goal) : Bool {
      g.id == habitId and g.owner == caller and g.goalId != null;
    })) {
      case null null;
      case (?g) ?toHabitPublic(g);
    };
  };

  /// Transitions a goal (macro or habit) to a new state.
  public func updateGoalState(
    goals : List.List<GoalTypes.Goal>,
    goalId : Common.GoalId,
    caller : Common.UserId,
    newState : Common.GoalState,
  ) : { #ok : Bool; #err : GoalTypes.GoalError } {
    switch (goals.find(func(g : GoalTypes.Goal) : Bool { g.id == goalId and g.owner == caller })) {
      case null #err(#goalNotFound);
      case (?g) {
        g.state := newState;
        g.updatedAt := Time.now();
        #ok(true);
      };
    };
  };

  /// Lists all macro goals owned by `caller` (goalId = null records).
  public func listOwnedMacroGoals(
    goals : List.List<GoalTypes.Goal>,
    caller : Common.UserId,
  ) : [GoalTypes.MacroGoalPublic] {
    goals.values()
      .filter(func(g : GoalTypes.Goal) : Bool { g.owner == caller and g.goalId == null })
      .map(func(g) { toMacroGoalPublic(g) })
      .toArray();
  };

  /// Lists all habits owned by `caller` (goalId set records).
  public func listOwnedHabits(
    goals : List.List<GoalTypes.Goal>,
    caller : Common.UserId,
  ) : [GoalTypes.HabitPublic] {
    goals.values()
      .filter(func(g : GoalTypes.Goal) : Bool { g.owner == caller and g.goalId != null })
      .map(func(g) { toHabitPublic(g) })
      .toArray();
  };

  /// Lists the caller's macro goals, each grouped with its linked habits.
  /// Supports the dashboard grouping requirement: a macro goal appears once
  /// with all habits whose `goalId` points at it. Hard-deleted goals are
  /// removed entirely by the cascade delete, so no orphaned habits remain —
  /// every habit returned here has a live parent macro goal.
  public func listMyGoalsGrouped(
    goals : List.List<GoalTypes.Goal>,
    caller : Common.UserId,
  ) : [GoalTypes.GoalWithHabitsPublic] {
    let snapshot = goals.toArray();
    // Macro goals owned by caller.
    let macroGoals = snapshot.filter(func(g : GoalTypes.Goal) : Bool {
      g.owner == caller and g.goalId == null;
    });
    // Habits owned by caller — grouped under their parent macro goal below.
    let callerHabits = snapshot.filter(func(g : GoalTypes.Goal) : Bool {
      g.owner == caller and g.goalId != null;
    });
    macroGoals.map(func(mg) {
      let linked = callerHabits
        .filter(func(h : GoalTypes.Goal) : Bool {
          switch (h.goalId) { case null false; case (?pid) pid == mg.id };
        })
        .map(func(h) { toHabitPublic(h) });
      { goal = toMacroGoalPublic(mg); habits = linked };
    });
  };

  /// Lists habits linked to a specific macro goal (by parent goalId).
  /// Only habits owned by `caller` are returned. Returns #err #goalNotFound
  /// if the macro goal does not exist or is not owned by the caller.
  public func listHabitsByParent(
    goals : List.List<GoalTypes.Goal>,
    parentGoalId : Common.GoalId,
    caller : Common.UserId,
  ) : { #ok : [GoalTypes.HabitPublic]; #err : GoalTypes.GoalError } {
    // Verify the parent macro goal exists and is owned by caller.
    let parentExists = switch (goals.find(func(g : GoalTypes.Goal) : Bool {
      g.id == parentGoalId and g.owner == caller and g.goalId == null;
    })) {
      case null false;
      case (?_) true;
    };
    if (not parentExists) return #err(#goalNotFound);

    let habits = goals.values()
      .filter(func(g : GoalTypes.Goal) : Bool {
        g.owner == caller and
        g.goalId != null and
        (switch (g.goalId) { case null false; case (?pid) pid == parentGoalId });
      })
      .map(func(g) { toHabitPublic(g) })
      .toArray();
    #ok(habits);
  };

  /// Updates an editable habit. Enforces:
  ///   • wish/wishDescription/outcome/category are immutable (sourced from
  ///     the parent macro goal) — any non-null value that differs is rejected
  ///     with #reusedGoalReadOnly.
  ///   • isLockIn and category are immutable after creation (#immutableType).
  ///   • Daily edit lockout (when isTimeEdit = ?true).
  ///   • Strict Lock-In active-window lockout.
  ///   • Lock-In overlap check against the caller's other habits.
  public func updateHabit(
    goals : List.List<GoalTypes.Goal>,
    habitId : Common.GoalId,
    caller : Common.UserId,
    request : GoalTypes.UpdateHabitRequest,
  ) : { #ok : GoalTypes.HabitPublic; #err : GoalTypes.GoalError } {
    let habit = switch (goals.find(func(g : GoalTypes.Goal) : Bool {
      g.id == habitId and g.owner == caller and g.goalId != null;
    })) {
      case null return #err(#goalNotFound);
      case (?h) h;
    };

    // isLockIn is immutable after creation.
    switch (request.isLockIn) {
      case null {};
      case (?v) {
        if (v != habit.isLockIn) return #err(#immutableType);
      };
    };

    // Daily edit lockout: when isTimeEdit = ?true, the habit may only be
    // edited once per day (timezone-aware). General-tab saves (isTimeEdit
    // null/false) are unlimited.
    switch (request.isTimeEdit) {
      case null {};
      case (?true) {
        let now = Time.now();
        // Strict Lock-In active-window lockout: when the habit is a Lock-In
        // habit and the current time (in the caller's local timezone) falls
        // within [startTimeMinutes - 5, endTimeMinutes + 5], the schedule is
        // locked and cannot be edited. Uses the habit's CURRENTLY STORED
        // times (not any new values in the request), and does not gate on
        // scheduledDays — matching the frontend's isLockInActiveWindow().
        // This is the more specific reason, so it takes priority over the
        // daily edit lockout below.
        if (habit.isLockIn) {
          let offsetNs = request.timezoneOffsetMinutes * 60 * 1_000_000_000;
          let localNowMinutes = ((now + offsetNs) % DAY_NS) / 60_000_000_000;
          let windowStart = habit.startTimeMinutes.toInt() - 5;
          let windowEnd = habit.endTimeMinutes.toInt() + 5;
          if (localNowMinutes >= windowStart and localNowMinutes <= windowEnd) {
            return #err(#strictLockActive);
          };
        };
        // Daily edit lockout: when isTimeEdit = ?true, the habit may only be
        // edited once per day (timezone-aware).
        switch (habit.lastEditedAt) {
          case null {};
          case (?last) {
            if (sameDay(last, now, request.timezoneOffsetMinutes)) {
              return #err(#dailyEditLockout);
            };
          };
        };
      };
      case (?false) {};
    };

    // Resolve new schedule values (fall back to existing when not supplied).
    let newLockInDurationMinutes = switch (request.lockInDurationMinutes) {
      case null habit.lockInDurationMinutes;
      case (?n) n;
    };
    let newStartTimeMinutes = switch (request.startTimeMinutes) {
      case null habit.startTimeMinutes;
      case (?n) n;
    };
    let newEndTimeMinutes = switch (request.endTimeMinutes) {
      case null habit.endTimeMinutes;
      case (?n) n;
    };

    // Lock-In overlap check against the caller's OTHER habits.
    if (habit.isLockIn and newStartTimeMinutes > 0 and newEndTimeMinutes > 0) {
      let overlap = goals.find(func(g : GoalTypes.Goal) : Bool {
        g.owner == caller and
        g.id != habit.id and
        g.goalId != null and
        g.isLockIn and
        g.startTimeMinutes > 0 and g.endTimeMinutes > 0 and
        newStartTimeMinutes < g.endTimeMinutes and
        g.startTimeMinutes < newEndTimeMinutes;
      });
      switch (overlap) {
        case (?_) return #err(#lockInOverlap("Lock-In window overlaps with another habit"));
        case null {};
      };
    };

    // Apply edits.
    switch (request.ifThenPlan) {
      case null {};
      case (?v) { habit.ifThenPlan := v };
    };
    switch (request.iconName) {
      case null {};
      case (?v) { habit.iconName := ?v };
    };
    switch (request.themeColor) {
      case null {};
      case (?v) { habit.themeColor := ?v };
    };
    switch (request.startTime) {
      case null {};
      case (?v) { habit.startTime := ?v };
    };
    switch (request.endTime) {
      case null {};
      case (?v) { habit.endTime := ?v };
    };
    habit.lockInDurationMinutes := newLockInDurationMinutes;
    habit.startTimeMinutes := newStartTimeMinutes;
    habit.endTimeMinutes := newEndTimeMinutes;
    switch (request.scheduledDays) {
      case null {};
      case (?d) { habit.scheduledDays := d };
    };
    let now = Time.now();
    habit.updatedAt := now;
    // Track last edit time only when the time-tab lockout was applied.
    switch (request.isTimeEdit) {
      case (?true) { habit.lastEditedAt := ?now };
      case _ {};
    };

    // Expected-obstacle template link: update only when the edit supplies one.
    // `obstacleTemplateId` is an immutable field, so when the edit provides a
    // new value the record must be rebuilt and replaced in the list rather than
    // mutated in place.
    switch (request.obstacleTemplateId) {
      case null { #ok(toHabitPublic(habit)) };
      case (?id) {
        let updated : GoalTypes.Goal = {
          id = habit.id;
          owner = habit.owner;
          var goalId = habit.goalId;
          var wish = habit.wish;
          var wishDescription = habit.wishDescription;
          outcome = habit.outcome;
          obstacleTemplateId = ?id;
          var ifThenPlan = habit.ifThenPlan;
          var state = habit.state;
          createdAt = habit.createdAt;
          var updatedAt = habit.updatedAt;
          var iconName = habit.iconName;
          var themeColor = habit.themeColor;
          var isLockIn = habit.isLockIn;
          var startTime = habit.startTime;
          var endTime = habit.endTime;
          var lastEditedAt = habit.lastEditedAt;
          var lockInDurationMinutes = habit.lockInDurationMinutes;
          var startTimeMinutes = habit.startTimeMinutes;
          var endTimeMinutes = habit.endTimeMinutes;
          var scheduledDays = habit.scheduledDays;
          var category = habit.category;
        };
        let snapshot = goals.toArray();
        goals.clear();
        for (g in snapshot.values()) {
          if (g.id == habit.id) { goals.add(updated) } else { goals.add(g) };
        };
        #ok(toHabitPublic(updated));
      };
    };
  };

  /// Updates an editable macro goal. Only cosmetic fields (iconName,
  /// themeColor) are editable; wish/wishDescription/outcome/category are
  /// immutable after creation.
  public func updateMacroGoal(
    goals : List.List<GoalTypes.Goal>,
    goalId : Common.GoalId,
    caller : Common.UserId,
    request : GoalTypes.UpdateMacroGoalRequest,
  ) : { #ok : GoalTypes.MacroGoalPublic; #err : GoalTypes.GoalError } {
    let goal = switch (goals.find(func(g : GoalTypes.Goal) : Bool {
      g.id == goalId and g.owner == caller and g.goalId == null;
    })) {
      case null return #err(#goalNotFound);
      case (?g) g;
    };
    switch (request.iconName) {
      case null {};
      case (?v) { goal.iconName := ?v };
    };
    switch (request.themeColor) {
      case null {};
      case (?v) { goal.themeColor := ?v };
    };
    goal.updatedAt := Time.now();
    #ok(toMacroGoalPublic(goal));
  };

  public func createObstacleTemplate(
    templates : List.List<GoalTypes.ObstacleTemplate>,
    nextId : Nat,
    caller : Common.UserId,
    request : GoalTypes.CreateObstacleRequest,
  ) : GoalTypes.ObstacleTemplate {
    let template : GoalTypes.ObstacleTemplate = {
      id = nextId;
      owner = caller;
      title = request.title;
      description = request.description;
    };
    templates.add(template);
    template;
  };

  public func listObstacleTemplates(
    templates : List.List<GoalTypes.ObstacleTemplate>,
    caller : Common.UserId,
  ) : [GoalTypes.ObstacleTemplate] {
    templates.values()
      .filter(func(t : GoalTypes.ObstacleTemplate) : Bool { t.owner == caller })
      .toArray();
  };

  /// Returns the caller's reusable macro goals for the wizard chips.
  /// Each entry exposes id, wish, wishDescription, state, and category.
  public func listReusableGoals(
    goals : List.List<GoalTypes.Goal>,
    caller : Common.UserId,
  ) : [GoalTypes.ReusableGoalPublic] {
    goals.values()
      .filter(func(g : GoalTypes.Goal) : Bool {
        g.owner == caller and g.goalId == null;
      })
      .map(func(g) {
        {
          id = g.id;
          wish = g.wish;
          wishDescription = g.wishDescription;
          state = g.state;
          category = g.category;
        };
      })
      .toArray();
  };

  /// Permanently removes a macro goal and all of its child habits in a single
  /// atomic operation. Before removing the habits and the goal itself, this
  /// deletes every child habit's check-ins, timeline entries, and feed
  /// interactions. All-or-nothing: partial failure cannot leave dangling
  /// habits pointing at a deleted goal.
  ///
  /// `goalId` must reference a macro goal (goalId = null) owned by `caller`.
  /// `checkIns` and `interactions` are the shared collections this operation
  /// mutates to purge dependent records.
  ///
  /// All removals are synchronous (no `await` between them), so the cascade
  /// is atomic: either every dependent record is purged or none is. The
  /// `List.retain` primitive filters each collection in place in one pass.
  public func deleteGoal(
    goals : List.List<GoalTypes.Goal>,
    checkIns : List.List<CheckInTypes.CheckIn>,
    interactions : List.List<FeedTypes.Interaction>,
    goalId : Common.GoalId,
    caller : Common.UserId,
  ) : { #ok; #err : GoalTypes.GoalError } {
    // 1. Verify the macro goal exists, is a macro goal (goalId null), and is
    //    owned by the caller. A habit id or a missing id yields #goalNotFound.
    let macroGoal = goals.find(func(g : GoalTypes.Goal) : Bool {
      g.id == goalId and g.owner == caller and g.goalId == null;
    });
    switch (macroGoal) {
      case null return #err(#goalNotFound);
      case (?_) {};
    };

    // 2. Collect the set of goal ids to remove: the macro goal itself plus
    //    every child habit whose goalId points at it. We snapshot first so
    //    the retain pass below has a stable predicate.
    let goalsSnapshot = goals.toArray();
    let purgeGoalIds = Set.empty<Common.GoalId>();
    purgeGoalIds.add(goalId);
    for (g in goalsSnapshot.values()) {
      switch (g.goalId) {
        case null {};
        case (?parentId) {
          if (parentId == goalId) {
            purgeGoalIds.add(g.id);
          };
        };
      };
    };

    // 3. Snapshot the check-in ids that will be removed (check-ins whose
    //    goalId is one of the purged habits/goal). We need these ids to
    //    filter interactions BEFORE we mutate the checkIns list.
    let checkInsSnapshot = checkIns.toArray();
    let removedCheckInIds = Set.empty<Common.CheckInId>();
    for (c in checkInsSnapshot.values()) {
      if (purgeGoalIds.contains(c.goalId)) {
        removedCheckInIds.add(c.id);
      };
    };

    // 4. Atomically remove the linked interactions (those whose checkInId is
    //    in the removed set). Rebuild from a snapshot — List.retain is unsafe
    //    (IC0503 'Array index out of bounds') when the list grows during the
    //    in-place pass, so we rebuild instead. No await — the whole cascade is
    //    one synchronous transaction.
    let interactionsSnapshot = interactions.toArray();
    interactions.clear();
    for (i in interactionsSnapshot.values()) {
      if (not removedCheckInIds.contains(i.checkInId)) {
        interactions.add(i);
      };
    };

    // 5. Atomically remove the linked check-ins (those whose goalId is one
    //    of the purged goals). Rebuild from a snapshot for the same reason.
    let checkInsSnapshot2 = checkIns.toArray();
    checkIns.clear();
    for (c in checkInsSnapshot2.values()) {
      if (not purgeGoalIds.contains(c.goalId)) {
        checkIns.add(c);
      };
    };

    // 6. Atomically remove the habits and the macro goal itself. Rebuild from
    //    a snapshot, dropping both the child habits (goalId points at the
    //    macro goal) and the macro goal (id == goalId).
    let goalsSnapshot2 = goals.toArray();
    goals.clear();
    for (g in goalsSnapshot2.values()) {
      let isMacroGoal = g.goalId == null;
      let isTargetMacro = g.id == goalId and isMacroGoal;
      let isChildHabit = switch (g.goalId) { case null false; case (?pid) pid == goalId };
      if (not isTargetMacro and not isChildHabit) {
        goals.add(g);
      };
    };

    #ok;
  };

  /// Permanently removes a single habit in one atomic operation. Before
  /// removing the habit itself, this deletes the habit's check-ins, their
  /// timeline entries, and feed interactions. All-or-nothing: partial failure
  /// cannot leave dangling check-ins pointing at a deleted habit.
  ///
  /// `habitId` must reference a habit (goalId set) owned by `caller`.
  /// `checkIns` and `interactions` are the shared collections this operation
  /// mutates to purge dependent records.
  ///
  /// All removals are synchronous (no `await` between them), so the cascade
  /// is atomic: either every dependent record is purged or none is. The
  /// `List.retain` primitive filters each collection in place in one pass.
  ///
  /// Scoped to a single habit — does NOT touch the parent macro goal or any
  /// sibling habits. The habit is removed from its parent goal's habit list
  /// implicitly (habits are linked by `goalId` on the habit record, not by a
  /// list on the parent — removing the habit record is sufficient).
  public func deleteHabit(
    goals : List.List<GoalTypes.Goal>,
    checkIns : List.List<CheckInTypes.CheckIn>,
    interactions : List.List<FeedTypes.Interaction>,
    habitId : Common.GoalId,
    caller : Common.UserId,
  ) : { #ok; #err : GoalTypes.GoalError } {
    // 1. Find the habit record by habitId. We look for any goal owned by the
    //    caller with the matching id — then discriminate by goalId below.
    let habit = switch (goals.find(func(g : GoalTypes.Goal) : Bool {
      g.id == habitId and g.owner == caller;
    })) {
      case null return #err(#goalNotFound);
      case (?h) h;
    };

    // 2. Verify the record is a habit (goalId set), not a macro goal. A macro
    //    goal id passed here is a caller bug — surface #wrongGoalKind so the
    //    frontend can route to deleteGoal instead.
    switch (habit.goalId) {
      case null return #err(#wrongGoalKind);
      case (?_) {};
    };

    // 3. Snapshot the check-in ids that belong to this habit (checkIns whose
    //    goalId == habitId). We need these ids to filter interactions BEFORE
    //    we mutate the checkIns list.
    let checkInsSnapshot = checkIns.toArray();
    let removedCheckInIds = Set.empty<Common.CheckInId>();
    for (c in checkInsSnapshot.values()) {
      if (c.goalId == habitId) {
        removedCheckInIds.add(c.id);
      };
    };

    // 4. Atomically remove the linked interactions (those whose checkInId is
    //    in the removed set). Rebuild from a snapshot — List.retain is unsafe
    //    (IC0503 'Array index out of bounds') when the list grows during the
    //    in-place pass, so we rebuild instead. No await — the whole cascade is
    //    one synchronous transaction.
    let interactionsSnapshot = interactions.toArray();
    interactions.clear();
    for (i in interactionsSnapshot.values()) {
      if (not removedCheckInIds.contains(i.checkInId)) {
        interactions.add(i);
      };
    };

    // 5. Atomically remove the habit's check-ins (those whose goalId == habitId).
    //    Rebuild from a snapshot for the same reason.
    let checkInsSnapshot2 = checkIns.toArray();
    checkIns.clear();
    for (c in checkInsSnapshot2.values()) {
      if (c.goalId != habitId) {
        checkIns.add(c);
      };
    };

    // 6. Atomically remove the habit record itself. Rebuild from a snapshot.
    //    The habit is detached from its parent macro goal implicitly: habits
    //    are linked by `goalId` on the habit record, not by a list on the
    //    parent, so removing the record is sufficient. No parent mutation.
    let goalsSnapshot2 = goals.toArray();
    goals.clear();
    for (g in goalsSnapshot2.values()) {
      if (g.id != habitId) {
        goals.add(g);
      };
    };

    #ok;
  };
};
