# Project Guidance

## User Preferences

- Calm Technology tone; no streak language in habit-tracking UI.
- Do not change UI copy or layout unless explicitly requested.

## Verified Commands

- **typecheck**: `cd src/backend && mops check --fix && cd ../.. && cd src/frontend && pnpm typecheck`
- **fix**: `cd src/frontend && pnpm fix`
- **build**: `cd src/backend && mops build && cd ../.. && pnpm bindgen && cd src/frontend && pnpm build`

## Learnings

- Project uses Enhanced Migration: [canisters.backend.migrations] chain in mops.toml; new migrations are timestamp-named YYYYMMDD_HHMMSS.mo and auto-included; OldActor must equal the prior migration's NewActor.
- mops build emits MOPS-CHECK-DEPLOY-SKIPPED (M0263) on this converted project because the fresh-install deploy check cannot supply prior stable variables; the build still succeeds and this is expected.
- mo:test (test@2.1.2) has no expect.float; assert Float equality with expect.bool(a == b).isTrue().
- Backend tests run with mops test; frontend tests run with pnpm test (vitest).
- The build environment exports VITEST_MAX_FORKS/VITEST_MAX_THREADS without matching MIN values; pin pool:'forks' with explicit minForks/maxForks in vitest.config.ts.
- The generated syncTimezone signature takes offsetMinutes as bigint; callers pass BigInt(offsetMinutes).
- computeCategoryBreakdown takes [GoalTypes.Goal] (shared storage record), not the HabitPublic projection.
- TanStack Query v5 reports isLoading=false for a disabled query; a page gated on a prerequisite query must OR in that prerequisite's loading flag to keep its skeleton visible.
- The frontend mock backend at src/frontend/src/mocks/backend.ts must be updated whenever a frontend type mirror gains a required field, or pnpm typecheck fails.
- Analytics if-then effectiveness excludes #missed and #inProgress from both buckets and excludes habits with no if-then plan; best/worst day uses MIN_DAY_SAMPLE=4 and a 0.15 rate-gap gate.
- pickBestWorst in lib/analytics.mo is public so the mo:test suite can exercise best/worst selection directly; it returns (?Nat, ?Nat).
- Removing a public method only (no stored type or state-shape change) requires no migration; the enhanced migration chain is untouched.
- Removing a method from the frontend mock actor while the generated backendInterface still declares it produces TS2741 at the mock object literal; the fix is a bindgen re-run, not a generated-file edit.
