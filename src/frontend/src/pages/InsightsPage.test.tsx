import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoalCategory } from "../backend";
import type { AnalyticsSummary } from "../types/index";
import { InsightsPage } from "./InsightsPage";

// ─── Backend seam ─────────────────────────────────────────────────────────────
// InsightsPage reads the analytics summary through useBackend().getAnalytics()
// and gates its query on useUserProfile(). We replace both modules with small
// controllable doubles so each test can pin the profile-loading window and the
// exact analytics payload.
let getAnalytics: ReturnType<typeof vi.fn>;
let profileState: { data: unknown; isLoading: boolean };

vi.mock("../hooks/useBackend", () => ({
  useBackend: () => ({
    actor: {
      getAnalytics: (...args: unknown[]) => getAnalytics(...args),
    },
    isFetching: false,
    actorReady: true,
  }),
}));

vi.mock("../hooks/useUserProfile", () => ({
  useUserProfile: () => profileState,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

function makeSummary(
  overrides: Partial<AnalyticsSummary> = {},
): AnalyticsSummary {
  return {
    habits: [],
    overallIfThenEffectiveness: {
      usedPlan: { successes: 0n, total: 0n, rate: 0 },
      notUsedPlan: { successes: 0n, total: 0n, rate: 0 },
    },
    dayOfWeek: [],
    bestDayOfWeek: undefined,
    worstDayOfWeek: undefined,
    categoryBreakdown: [],
    predictedObstaclePool: [],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <InsightsPage />
    </QueryClientProvider>,
  );
}

describe("InsightsPage", () => {
  beforeEach(() => {
    profileState = {
      data: { timezoneOffsetMinutes: 0n },
      isLoading: false,
    };
    getAnalytics = vi.fn(async () => makeSummary());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the skeleton while the profile is loading", async () => {
    // The insights query is disabled until the profile loads, so TanStack
    // Query v5 reports isLoading=false for it. The page must still show the
    // skeleton during that window instead of flashing the placeholders.
    profileState = { data: undefined, isLoading: true };
    renderPage();

    expect(
      await screen.findByTestId("insights.loading_state"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("insights.highlight_card"),
    ).not.toBeInTheDocument();
  });

  it("shows the skeleton while the insights query is loading", async () => {
    let resolveAnalytics: ((value: AnalyticsSummary) => void) | undefined;
    getAnalytics = vi.fn(
      () =>
        new Promise<AnalyticsSummary>((resolve) => {
          resolveAnalytics = resolve;
        }),
    );
    renderPage();

    expect(
      await screen.findByTestId("insights.loading_state"),
    ).toBeInTheDocument();

    resolveAnalytics?.(makeSummary());
    await waitFor(() =>
      expect(
        screen.queryByTestId("insights.loading_state"),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the '{n} of 20 days' caption below the if-then gate", async () => {
    getAnalytics = vi.fn(async () =>
      makeSummary({
        overallIfThenEffectiveness: {
          usedPlan: { successes: 2n, total: 5n, rate: 0.4 },
          notUsedPlan: { successes: 1n, total: 4n, rate: 0.25 },
        },
      }),
    );
    renderPage();

    expect(
      await screen.findByText("Your plans are taking shape"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("5 of 20 days with your plan so far."),
    ).toBeInTheDocument();
  });

  it("shows plain percentages with no multiplier at or above the gate", async () => {
    getAnalytics = vi.fn(async () =>
      makeSummary({
        overallIfThenEffectiveness: {
          usedPlan: { successes: 18n, total: 20n, rate: 0.9 },
          notUsedPlan: { successes: 10n, total: 20n, rate: 0.5 },
        },
      }),
    );
    renderPage();

    expect(
      await screen.findByText("Your plan tends to help"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "You followed through 90% of the time on days you used your plan, and 50% on days you didn't.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Based on 20 days with your plan and 20 without. This shows a pattern, not a cause.",
      ),
    ).toBeInTheDocument();
    // No multiplier glyph anywhere in the card.
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it("stays neutral when the plan side does not lead by 10 points", async () => {
    getAnalytics = vi.fn(async () =>
      makeSummary({
        overallIfThenEffectiveness: {
          usedPlan: { successes: 12n, total: 20n, rate: 0.6 },
          notUsedPlan: { successes: 11n, total: 20n, rate: 0.55 },
        },
      }),
    );
    renderPage();

    expect(
      await screen.findByText("No clear difference yet"),
    ).toBeInTheDocument();
  });

  it("labels the second day card 'Toughest day' and shows gathering copy when the backend returns null", async () => {
    getAnalytics = vi.fn(async () =>
      makeSummary({ bestDayOfWeek: undefined, worstDayOfWeek: undefined }),
    );
    renderPage();

    expect(await screen.findByText("Toughest day")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "We'll show your standout day here once there's enough data.",
      ),
    ).toHaveLength(2);
  });

  it("shows 'Nothing here yet' for a category with habitCount 0", async () => {
    getAnalytics = vi.fn(async () =>
      makeSummary({
        categoryBreakdown: [
          {
            category: GoalCategory.Health,
            successes: 0n,
            total: 0n,
            habitCount: 0n,
            rate: 0,
          },
        ],
      }),
    );
    renderPage();

    // The Health stat has habitCount 0 and the other four categories have no
    // stat at all — all five render the empty hint.
    await waitFor(() =>
      expect(screen.getAllByText("Nothing here yet")).toHaveLength(5),
    );
  });

  it("shows the gathering hint for a category with habits but too little data", async () => {
    getAnalytics = vi.fn(async () =>
      makeSummary({
        categoryBreakdown: [
          {
            category: GoalCategory.Health,
            successes: 1n,
            total: 2n,
            habitCount: 1n,
            rate: 0.5,
          },
        ],
      }),
    );
    renderPage();

    expect(
      await screen.findByText("Gathering a little more data…"),
    ).toBeInTheDocument();
  });

  it("gates the obstacles section on total actual occurrences", async () => {
    getAnalytics = vi.fn(async () =>
      makeSummary({
        habits: [
          {
            habitId: 1n,
            habitName: "Run",
            category: GoalCategory.Health,
            shownUpDays: 10n,
            ifThenEffectiveness: {
              usedPlan: { successes: 0n, total: 0n, rate: 0 },
              notUsedPlan: { successes: 0n, total: 0n, rate: 0 },
            },
            predictedObstacles: [],
            actualObstacles: [
              { obstacleName: "Low Energy", count: 1n, obstacleTemplateId: 1n },
            ],
          },
        ],
      }),
    );
    renderPage();

    // Only 1 actual occurrence — below the evidence gate, so no real rows.
    expect(
      await screen.findByTestId("insights.obstacles_section"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Low Energy")).not.toBeInTheDocument();
  });

  it("lists repeated actual obstacles with a muted count and 'No repeats yet' otherwise", async () => {
    getAnalytics = vi.fn(async () =>
      makeSummary({
        habits: [
          {
            habitId: 1n,
            habitName: "Run",
            category: GoalCategory.Health,
            shownUpDays: 10n,
            ifThenEffectiveness: {
              usedPlan: { successes: 0n, total: 0n, rate: 0 },
              notUsedPlan: { successes: 0n, total: 0n, rate: 0 },
            },
            predictedObstacles: [],
            actualObstacles: [
              { obstacleName: "Low Energy", count: 3n, obstacleTemplateId: 1n },
              { obstacleName: "No Time", count: 1n, obstacleTemplateId: 2n },
            ],
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("Low Energy")).toBeInTheDocument();
    expect(screen.getByText("×3")).toBeInTheDocument();
    // "No Time" only occurred once, so it is not listed.
    expect(screen.queryByText("No Time")).not.toBeInTheDocument();
  });

  it("shows 'No repeats yet' when no actual obstacle reaches 2", async () => {
    getAnalytics = vi.fn(async () =>
      makeSummary({
        habits: [
          {
            habitId: 1n,
            habitName: "Run",
            category: GoalCategory.Health,
            shownUpDays: 10n,
            ifThenEffectiveness: {
              usedPlan: { successes: 0n, total: 0n, rate: 0 },
              notUsedPlan: { successes: 0n, total: 0n, rate: 0 },
            },
            predictedObstacles: [],
            actualObstacles: [
              { obstacleName: "Low Energy", count: 1n, obstacleTemplateId: 1n },
              { obstacleName: "No Time", count: 1n, obstacleTemplateId: 2n },
              {
                obstacleName: "Distraction",
                count: 1n,
                obstacleTemplateId: 3n,
              },
            ],
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("No repeats yet")).toBeInTheDocument();
  });
});
