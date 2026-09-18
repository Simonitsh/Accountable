mixin () {
  public query func getApiDoc() : async Text {
    "## Habit & Partner Backend — API Reference\n" #
    "\n" #
    "This canister powers a habit-tracking app: users create macro goals and habits, record daily check-ins, connect with partners, and view an Insights summary derived from their own check-in history. All data is scoped to the calling principal unless noted.\n" #
    "\n" #
    "## Identity & Authentication\n" #
    "\n" #
    "Every public method is called by an Internet Computer principal. A caller is **anonymous** when they have not signed in (the `aaaaa-aa` principal). Anonymous callers are rejected with a trap on every mutating endpoint (goal, habit, check-in, connection, interaction, and profile writes) and on partner-habit reads.\n" #
    "\n" #
    "The app's frontend pins an Internet Identity derivation origin, published at `/.well-known/ii-derivation-origin` when available. An agent already holding the user's Internet Identity authorization derives the correct per-app principal against that origin (for example `icp identity link web <name> --app <host>`). Such a delegation acts with the user's full authority in this app until it expires.\n" #
    "\n" #
    "### Registration prerequisite\n" #
    "\n" #
    "Most endpoints assume the caller has a profile. Registration happens only when a caller signs in through the app's own frontend, which calls `register(username)` once. A principal that never did so is **unregistered** even when it belongs to the app's owner, and a signed-in caller derived against a different origin is a different principal than the one the frontend registered.\n" #
    "\n" #
    "A direct API caller must register before any role-guarded call: call `register(username)` once as a signed-in caller. The first initializer receives the `#admin` role if their principal is in the hardcoded admin list; all other callers receive `#user`. An unregistered or anonymous caller on a guarded endpoint receives a trap — for example `register` traps with `\"Username cannot be empty\"` on empty input, and `getMyProfile` traps with `\"Profile not found — register first\"` when the caller has no profile.\n" #
    "\n" #
    "### Roles\n" #
    "\n" #
    "- **Owner**: the caller whose principal matches a record's `owner` field. Owners can read and mutate their own goals, habits, check-ins, and connections.\n" #
    "- **Admin**: a caller whose stored `role` is `#admin` (promoted from the hardcoded admin list on sign-in). Admins can call `listAllUsers` and read any user's profile via `getUserProfile`.\n" #
    "- **Partner**: an accepted, mutual connection. Partners can read each other's habit summaries and feed items.\n" #
    "\n" #
    "## Units & Encodings\n" #
    "\n" #
    "- **Timestamps** are `Int` nanoseconds since the Unix epoch (UTC). `Time.now()` is the source. Day boundaries and day-of-week are computed from these timestamps.\n" #
    "- **Identifiers** (`goalId`, `checkInId`, `connectionId`, `interactionId`, `obstacleTemplateId`) are `Nat`.\n" #
    "- **Principals** are `Principal` values; the caller's own principal is `caller`.\n" #
    "- **Optional values** use `?T` / `null`. For example `obstacleTemplateId` on a check-in is `null` when no template was recorded; `goalId` on a `Goal` is `null` for a macro goal and set for a habit.\n" #
    "- **Variants** are Candid variants. `checkInType` is one of `#success`, `#skip`, `#missed`, `#inProgress`, `#missedCheckIn`, `#missedCheckOut`. `#skip` is a deliberate skip and always carries an `obstacleTemplateId`; `#missed` is a scheduled day that passed with no interaction and never carries one. `GoalCategory` is one of `#Health`, `#Learning`, `#Social`, `#Productivity`, `#Leisure`. `GoalState` is `#active`, `#paused`, `#completed`.\n" #
    "- **Day of week** in the Insights summary is `0 = Sunday ... 6 = Saturday`.\n" #
    "\n" #
    "## Public Methods\n" #
    "\n" #
    "### Auth\n" #
    "- `register(username) : UserProfilePublic` — creates/updates the caller's profile. Traps on empty or taken username. Requires a signed-in caller.\n" #
    "- `updateMyProfile(...) : { #ok : UserProfilePublic; #err : Text }` — updates the caller's profile; validates avatar shape/color/mode.\n" #
    "- `isUsernameAvailable(username) : Bool` — query; checks availability excluding the caller.\n" #
    "- `getMyProfile() : UserProfilePublic` — returns the caller's profile; traps if unregistered.\n" #
    "- `getUserProfile(target) : ?UserProfilePublic` — query; owner or admin only, else traps `\"unauthorized\"`.\n" #
    "- `setTimezone(tz) : ()` — sets the caller's timezone.\n" #
    "- `listAllUsers() : [UserProfilePublic]` — query; admin only, else traps `\"admin only\"`.\n" #
    "\n" #
    "### Goals & Habits\n" #
    "- `createMacroGoal(request) : { #ok : MacroGoalPublic; #err : Text }` — creates a container with category/wish/outcome.\n" #
    "- `createHabit(request) : { #ok : HabitPublic; #err : Text }` — creates a habit inside an existing macro goal (`goalId` required).\n" #
    "- `getMacroGoal(goalId) : ?MacroGoalPublic` — query; owner only.\n" #
    "- `getHabit(habitId) : ?HabitPublic` — query; owner only.\n" #
    "- `updateGoalState(goalId, newState) : Bool` — transitions a goal's state; traps on error.\n" #
    "- `deleteGoal(goalId) : { #ok; #err : Text }` — hard-deletes a macro goal and all child habits, check-ins, and interactions atomically.\n" #
    "- `deleteHabit(habitId) : { #ok; #err : Text }` — hard-deletes a single habit and its check-ins/interactions atomically.\n" #
    "- `updateHabit(habitId, request) : { #ok : HabitPublic; #err : Text }` — edits editable habit fields; wish/outcome/category are immutable. `UpdateHabitRequest` now accepts an optional `obstacleTemplateId` (`?Nat`): when provided, the habit's expected-obstacle template link is updated; when absent, it is left unchanged.\n" #
    "- `updateMacroGoal(goalId, request) : { #ok : MacroGoalPublic; #err : Text }` — edits cosmetic macro-goal fields only.\n" #
    "- `listMyGoals() : [GoalWithHabitsPublic]` — query; macro goals grouped with linked habits.\n" #
    "- `listHabitsByParent(parentGoalId) : { #ok : [HabitPublic]; #err : Text }` — query.\n" #
    "- `listMyReusableGoals() : [ReusableGoalPublic]` — query.\n" #
    "- `resolveObstacleLabel(request) : ObstacleTemplate` — resolves a built-in obstacle label (e.g. \"Low Energy\", \"Time Crunch\") to one of the seven fixed built-in obstacles. Obstacles are locked down to exactly seven values — Low Energy, Time Crunch, Distraction, Social Pressure, Environment, Health, and Something else — and nothing else can ever exist. The match is case-insensitive on the built-in title, and each built-in has a stable id, so the same label always resolves to the same obstacle. If the label is not one of the seven built-ins, the call traps — a custom obstacle can never be created.\n" #
    "\n" #
    "### Check-ins\n" #
    "- `recordCheckIn(request) : CheckIn` — records a check-in against an active owned habit. Enforces one-per-day and Lock-In rules; traps on violation.\n" #
    "- `listMyCheckIns() : [CheckIn]` — query.\n" #
    "- `getCheckInsForGoal(goalId) : [CheckIn]` — query.\n" #
    "- `deleteCheckIn(checkInId) : { #ok; #err : { #notFound; #unauthorized; #sealed : Text } }` — deletes a check-in; terminal Lock-In sessions are sealed and cannot be undone.\n" #
    "- `markCheckInIfThenUsed(checkInId) : { #ok; #err : { #notFound; #unauthorized } }` — tags a check-in as having used the if-then plan. Idempotent: re-tagging is a no-op success.\n" #
    "- `getCheckInsForPeriod(goalId, fromTimestamp, toTimestamp) : [CheckIn]` — query.\n" #
    "- `getCheckInsForGoalTimeline(goalId, fromTimestamp) : [CheckIn]` — query; newest-first.\n" #
    "\n" #
    "### Connections\n" #
    "- `sendConnectionRequest(target) : ConnectionPublic` — sends a connection request.\n" #
    "- `respondToConnection(connectionId, accept) : Bool` — accepts/rejects a pending request.\n" #
    "- `listConnections() : [ConnectionPublic]` — query; accepted connections.\n" #
    "- `listPendingRequests() : [ConnectionPublic]` — query.\n" #
    "\n" #
    "### Feed\n" #
    "- `getPartnerFeed() : [FeedItem]` — query; feed from accepted partners.\n" #
    "- `recordInteraction(checkInId, interactionType) : Interaction` — records a high-five on a check-in.\n" #
    "- `getInteractionCount(checkInId) : Nat` — query.\n" #
    "\n" #
    "### Partner Habits\n" #
    "- `getPartnerHabits(target) : { #ok : PartnerHabitDetail; #err : PartnerHabitError }` — query; accepted mutual partners only.\n" #
    "- `listPartnerOverviews() : [PartnerOverview]` — query; accepted mutual partners only.\n" #
    "\n" #
    "### Insights\n" #
    "- `getAnalytics(timezoneOffsetMinutes : Int) : AnalyticsSummary` — query. Computes, on-the-fly from the caller's own habits and check-ins (nothing persisted): per-habit shown-up days (genuine successes only), if-then plan effectiveness (follow-through with vs without the plan, per habit and overall), day-of-week follow-through with best/worst day, per-category follow-through, and planned-vs-actual obstacle comparison. The day-of-week bucketing (and thus best/worst day) is computed in the caller's local time using `timezoneOffsetMinutes` (minutes east of UTC, matching the per-user timezone stored on the profile), so a check-in is attributed to the correct day in the caller's own timezone rather than raw UTC. Requires a signed-in caller; anonymous callers get an empty summary (no habits/check-ins).\n" #
    "\n" #
    "### OQL (read-only analysis)\n" #
    "- `schema() : Text` — query; JSON catalogue of exposed entities.\n" #
    "- `execute(qJson : Text) : Result` — query; runs a JSON query over the exposed entities. Read-only; used by the Data Intelligence agent.\n" #
    "\n" #
    "### Dev\n" #
    "- `devReset() : ()` — **dev-only** full data reset. Wipes all canister state. Not a production feature.\n" #
    "\n" #
    "## Lifecycle & Polling\n" #
    "\n" #
    "A recurring hourly timer auto-fails active non-Lock-In goals that had no terminal check-in on a scheduled day, recording a `#missed` check-in (a forgotten day, distinct from a deliberate `#skip`). A `#missed` record is terminal, so the timer never re-records the same day on later nights. Lock-In goals manage their own missed states through the check-in flow. There is no long-running job to poll; `getAnalytics` is a pure query that reflects the latest persisted check-ins immediately.\n" #
    "\n" #
    "## Mutation Retry Safety\n" #
    "\n" #
    "- **Idempotent**: `markCheckInIfThenUsed` is idempotent — re-tagging an already-tagged check-in returns `#ok` without change. `ensureAdminRole` (internal) is idempotent.\n" #
    "- **Destructive**: `deleteGoal` and `deleteHabit` are hard deletes — final, no soft-delete or recovery. `deleteCheckIn` cannot undo sealed Lock-In sessions. `devReset` wipes all state.\n" #
    "- **Duplicate-call behavior**: `recordCheckIn` enforces one-per-day per goal (and Lock-In-specific rules), trapping on duplicates rather than silently overwriting.\n" #
    "\n" #
    "## Errors, Traps & Gotchas\n" #
    "\n" #
    "- Many endpoints **trap** (reject the message) on caller error rather than returning a `Result` — e.g. anonymous callers, unregistered callers, and one-per-day violations. A trap rolls back the whole message and reaches the frontend as an opaque reject.\n" #
    "- `getAnalytics` counts only the caller's own data; it never leaks other users' habits or check-ins.\n" #
    "- Shown-up days exclude deliberate skips (`#skip`) and missed days (`#missed`), so the count reflects genuine effort, not grading.\n" #
    "- The predicted obstacle on a habit is saved permanently at creation and is not editable; the Insights summary compares it against obstacles actually recorded on check-ins.\n" #
    "- `getUserProfile` and `listAllUsers` expose email only to the owner or an admin; partner-facing paths strip it.\n" #
    "- OQL `execute` is read-only and controller-scoped for connection/interaction entities; user-scoped entities expose only the caller's own rows.\n"
  ;
};
};
