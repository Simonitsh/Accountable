import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoalState } from "../backend";
import { MyGoalsPage } from "../pages/MyGoalsPage";
import { makeHabit, makeMacroGoal } from "../test/fixtures";

// ─── Mock the backend seam ────────────────────────────────────────────────────
const listMyGoals = vi.fn();
const updateGoalState = vi.fn();
const deleteGoal = vi.fn();

vi.mock("../hooks/useBackend", () => ({
  useBackend: () => ({
    actor: {
      listMyGoals,
      updateGoalState,
      deleteGoal,
    },
    isFetching: false,
  }),
  useDeleteGoal: () => ({
    mutate: deleteGoal,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MyGoalsPage />
    </QueryClientProvider>,
  );
}

// The state label text also appears in the filter tab buttons, so scope state
// badge assertions to the goal list container.
async function goalList() {
  const list = await screen.findByTestId("my_goals.goal_list");
  return within(list);
}

describe("MyGoalsPage (My Goals)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMyGoals.mockResolvedValue([
      {
        goal: makeMacroGoal(),
        habits: [makeHabit()],
      },
    ]);
  });

  it("renders the page heading, state label, and formatted date", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "My Goals" }),
    ).toBeInTheDocument();

    // State badge label for the active goal, scoped to the goal list.
    expect(await (await goalList()).findByText("Active")).toBeInTheDocument();

    // formatDate(createdAt) → "Mar 15, 2024".
    expect(
      await (await goalList()).findByText("Mar 15, 2024"),
    ).toBeInTheDocument();
  });

  it("renders the distinct state labels for paused and completed goals", async () => {
    listMyGoals.mockResolvedValue([
      {
        goal: makeMacroGoal({ id: 1n, state: GoalState.paused }),
        habits: [],
      },
      {
        goal: makeMacroGoal({ id: 2n, state: GoalState.completed }),
        habits: [],
      },
    ]);

    renderPage();

    const list = await goalList();
    expect(await list.findByText("Paused")).toBeInTheDocument();
    expect(await list.findByText("Completed")).toBeInTheDocument();
  });

  it("opens the goal delete dialog with the goal-specific confirmation copy and habit list", async () => {
    const user = userEvent.setup();
    listMyGoals.mockResolvedValue([
      {
        goal: makeMacroGoal(),
        habits: [makeHabit({ wishDescription: "Run every morning" })],
      },
    ]);

    renderPage();

    const deleteButton = await screen.findByRole("button", {
      name: "Delete goal I want to run 5K so that I can build a daily habit",
    });
    await user.click(deleteButton);

    // MyGoalsPage's DeleteGoalDialog copy: goal-level title + habit list.
    expect(
      await screen.findByText("Delete goal permanently?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/will also be permanently deleted/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Run every morning")).toBeInTheDocument();
  });

  it("filters the goal list by state tab", async () => {
    const user = userEvent.setup();
    listMyGoals.mockResolvedValue([
      {
        goal: makeMacroGoal({
          id: 1n,
          state: GoalState.active,
          wish: "Active goal wish",
        }),
        habits: [],
      },
      {
        goal: makeMacroGoal({
          id: 2n,
          state: GoalState.paused,
          wish: "Paused goal wish",
        }),
        habits: [],
      },
    ]);

    renderPage();

    // Default filter is "all" for MyGoalsPage, so both goals show.
    expect(await screen.findByText("Active goal wish")).toBeInTheDocument();
    expect(await screen.findByText("Paused goal wish")).toBeInTheDocument();

    // Switch to the Paused tab.
    await user.click(screen.getByTestId("my_goals.filter.paused"));
    expect(await screen.findByText("Paused goal wish")).toBeInTheDocument();
    // The exiting card lingers during the AnimatePresence exit animation.
    await waitFor(() =>
      expect(screen.queryByText("Active goal wish")).not.toBeInTheDocument(),
    );
  });
});
