import Principal "mo:core/Principal";
import Common "common";

module {
  /// Default scheduled days — every day of the week.
  public let DEFAULT_SCHEDULED_DAYS : [Text] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  /// A habit obstacle. Obstacles are locked to exactly seven built-in values
  /// (see `builtinObstacles`) — no custom obstacles can ever be created. The
  /// `owner` field is retained for type stability but is not meaningful for
  /// the global built-ins.
  public type ObstacleTemplate = {
    id : Common.ObstacleTemplateId;
    owner : Common.UserId;
    title : Text;
    description : Text;
  };

  /// The seven built-in obstacle values. These are the ONLY obstacles a habit
  /// can ever reference — the backend rejects any label outside this fixed
  /// list. Ids are stable (1-7) so a given label always resolves to the same
  /// obstacle.
  public func builtinObstacles() : [ObstacleTemplate] {
    let anon = Principal.fromText("aaaaa-aa");
    [
      { id = 1; owner = anon; title = "Low Energy"; description = "" },
      { id = 2; owner = anon; title = "Time Crunch"; description = "" },
      { id = 3; owner = anon; title = "Distraction"; description = "" },
      { id = 4; owner = anon; title = "Social Pressure"; description = "" },
      { id = 5; owner = anon; title = "Environment"; description = "" },
      { id = 6; owner = anon; title = "Health"; description = "" },
      { id = 7; owner = anon; title = "Something else"; description = "" },
    ];
  };

  public type GoalCategory = { #Health; #Learning; #Social; #Productivity; #Leisure };

  // ─────────────────────────────────────────────────────────────────────────
  // MACRO GOAL vs HABIT — READ THIS BEFORE EDITING
  // ─────────────────────────────────────────────────────────────────────────
  // A single `Goal` storage record serves two roles, distinguished by `goalId`:
  //
  //   • Macro goal  — `goalId` is null. A container created via the dedicated
  //     `createMacroGoal` flow. Carries `category`, `wish`, `outcome`
  //     (wishDescription). Does NOT carry Lock-In or schedule fields — those
  //     stay null/zero on macro goals.
  //
  //   • Habit       — `goalId` is set to its parent macro goal's id. Created
  //     via `createHabit`, which REQUIRES a `goalId`. Inherits `category`
  //     from its parent macro goal (the `category` field on a habit mirrors the
  //     parent and is not independently editable). Carries Lock-In and schedule
  //     fields.
  //
  // Keeping one storage type preserves migration compatibility with existing
  // data (all records live in one `goals` List). The public API exposes two
  // distinct projections (`MacroGoalPublic`, `HabitPublic`) so callers cannot
  // accidentally treat a macro goal as a habit or vice-versa.
  // ─────────────────────────────────────────────────────────────────────────

  /// Single storage record for both macro goals and habits.
  /// `goalId` distinguishes the two: null = macro goal, set = habit.
  public type Goal = {
    id : Common.GoalId;
    owner : Common.UserId;
    /// null  → this record IS a macro goal (a container).
    /// set   → this record is a habit linked to its parent macro goal.
    /// When set, `category` mirrors the parent and is not independently editable;
    /// `wish`/`wishDescription`/`outcome` are sourced from the parent and read-only.
    var goalId : ?Common.GoalId;
    var wish : Text;
    var wishDescription : Text;
    outcome : Text;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    var ifThenPlan : Text;
    var state : Common.GoalState;
    createdAt : Common.Timestamp;
    var updatedAt : Common.Timestamp;
    // Habit color — meaningful only on habits (goalId set). Macro goals never
    // carry a custom color; this field is retained on the shared storage record
    // so habits can keep their own color picker.
    var themeColor : ?Text;
    // Lock-In + schedule fields — meaningful only on habits (goalId set).
    // Macro goals keep these null/zero.
    var isLockIn : Bool;
    var startTime : ?Text;
    var endTime : ?Text;
    var lastEditedAt : ?Common.Timestamp;
    var lockInDurationMinutes : Nat;
    var startTimeMinutes : Nat;
    var endTimeMinutes : Nat;
    var scheduledDays : [Text];
    // Category — meaningful on macro goals; on habits it mirrors the parent.
    var category : GoalCategory;
  };

  /// Public projection of a macro goal (goalId = null).
  /// Excludes Lock-In/schedule fields — macro goals do not carry them.
  public type MacroGoalPublic = {
    id : Common.GoalId;
    owner : Common.UserId;
    wish : Text;
    wishDescription : Text;
    outcome : Text;
    state : Common.GoalState;
    createdAt : Common.Timestamp;
    updatedAt : Common.Timestamp;
    category : GoalCategory;
  };

  /// Public projection of a habit (goalId set).
  /// `category` is inherited from the parent macro goal — included for
  /// convenience but not independently editable.
  public type HabitPublic = {
    id : Common.GoalId;
    owner : Common.UserId;
    goalId : Common.GoalId;
    wish : Text;
    wishDescription : Text;
    outcome : Text;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    ifThenPlan : Text;
    state : Common.GoalState;
    createdAt : Common.Timestamp;
    updatedAt : Common.Timestamp;
    themeColor : ?Text;
    isLockIn : Bool;
    startTime : ?Text;
    endTime : ?Text;
    lastEditedAt : ?Common.Timestamp;
    lockInDurationMinutes : Nat;
    startTimeMinutes : Nat;
    endTimeMinutes : Nat;
    scheduledDays : [Text];
    category : GoalCategory;
  };

  /// A macro goal grouped with its linked habits — supports the dashboard
  /// grouping requirement. `habits` is the list of habits whose `goalId`
  /// points at this macro goal.
  public type GoalWithHabitsPublic = {
    goal : MacroGoalPublic;
    habits : [HabitPublic];
  };

  /// Minimal projection of a macro goal for the wizard chips / reuse picker.
  public type ReusableGoalPublic = {
    id : Common.GoalId;
    wish : Text;
    wishDescription : Text;
    state : Common.GoalState;
    category : GoalCategory;
  };

  /// Request to create a macro goal (a container). Captured by the goal
  /// wizard: category, wish, outcome (wishDescription). Extensible for more
  /// inputs later. Does NOT carry Lock-In or schedule fields.
  public type CreateMacroGoalRequest = {
    wish : Text;
    wishDescription : Text;
    outcome : Text;
    category : GoalCategory;
  };

  /// Request to create a habit inside an existing macro goal.
  /// `goalId` is REQUIRED — a habit must reference an existing macro goal.
  /// `category` is inherited from the parent and NOT accepted here.
  /// `wish`/`outcome` are sourced from the parent macro goal and NOT accepted
  /// here (read-only on habits). `wishDescription` is sourced from the parent
  /// by default, but MAY be overridden per-habit: when supplied, the habit's
  /// displayed name is the user's typed name rather than the parent's
  /// wishDescription.
  public type CreateHabitRequest = {
    goalId : Common.GoalId;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    ifThenPlan : Text;
    themeColor : ?Text;
    isLockIn : Bool;
    startTime : ?Text;
    endTime : ?Text;
    lockInDurationMinutes : ?Nat;
    startTimeMinutes : ?Nat;
    endTimeMinutes : ?Nat;
    scheduledDays : ?[Text];
    /// Optional habit name. When present, overrides the parent macro goal's
    /// wishDescription on this habit record. When null/absent, the habit
    /// inherits the parent's wishDescription (legacy behaviour).
    wishDescription : ?Text;
  };

  /// Update request for a habit. `wish`/`wishDescription`/`outcome`/`category`
  /// are immutable after creation (enforced server-side). Only Lock-In,
  /// schedule, ifThenPlan, and cosmetic fields are editable.
  public type UpdateHabitRequest = {
    ifThenPlan : ?Text;
    themeColor : ?Text;
    isLockIn : ?Bool;
    startTime : ?Text;
    endTime : ?Text;
    timezoneOffsetMinutes : Int;
    lockInDurationMinutes : ?Nat;
    startTimeMinutes : ?Nat;
    endTimeMinutes : ?Nat;
    scheduledDays : ?[Text];
    /// When true, applies the daily edit lockout check (Time-tab save).
    /// When false or null, skips the lockout check (General-tab save — unlimited).
    isTimeEdit : ?Bool;
    /// Optional expected-obstacle template link. When provided, updates the
    /// habit's obstacleTemplateId; when absent, leaves it unchanged.
    obstacleTemplateId : ?Common.ObstacleTemplateId;
  };

  /// Update request for a macro goal. `wish`/`wishDescription`/`outcome`/
  /// `category` are immutable after creation. Only cosmetic fields and state
  /// are editable.
  public type UpdateMacroGoalRequest = {};

  /// Typed error variants for goal operations.
  public type GoalError = {
    #goalNotFound;
    #notOwner;
    #goalNotEditable;
    #invalidInput;
    #lockInOverlap : Text;
    #strictLockActive;
    #dailyEditLockout;
    #immutableType;
    /// Raised when an edit attempts to change wish/wishDescription/outcome/
    /// category on a habit that is linked to a macro goal. The macro goal's
    /// text is read-only — create a separate macro goal for different text.
    #reusedGoalReadOnly;
    /// Raised when habit creation is attempted without a goalId, or when the
    /// referenced macro goal does not exist or is not owned by the caller.
    #parentGoalRequired;
    /// Raised when a macro-goal operation is attempted on a record that is
    /// actually a habit, or vice-versa.
    #wrongGoalKind;
  };
};
