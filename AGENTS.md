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
