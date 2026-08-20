import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoalState } from "../backend";
import { GoalsPage } from "../pages/GoalsPage";
import { makeHabit } from "../test/fixtures";

// ─── Mock the backend seam ────────────────────────────────────────────────────
// The page consumes useBackend()/useDeleteHabit() from ../hooks/useBackend.
// We replace that module with a typed local actor mock so the page renders
// against deterministic data without any network or canister.
const listMyGoals = vi.fn();
const updateGoalState = vi.fn();
const updateHabit = vi.fn();
const deleteHabit = vi.fn();

vi.mock("../hooks/useBackend", () => ({
  useBackend: () => ({
    actor: {
      listMyGoals,
      updateGoalState,
      updateHabit,
      deleteHabit,
    },
    isFetching: false,
  }),
  useDeleteHabit: () => ({
    mutate: deleteHabit,
    isPending: false,
  }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

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
      <GoalsPage />
    </QueryClientProvider>,
  );
}

describe("GoalsPage (My Habits)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMyGoals.mockResolvedValue([{ goal: undefined, habits: [makeHabit()] }]);
  });

  it("renders the page heading and a habit's state label and formatted date", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "My Habits" }),
    ).toBeInTheDocument();

    // State badge label for an active habit.
    expect(await screen.findByText("Active")).toBeInTheDocument();

    // formatDate(createdAt) → "Mar 15, 2024" (en-US, month short).
    expect(await screen.findByText("Mar 15, 2024")).toBeInTheDocument();
  });

  it("renders the distinct state labels for paused and completed habits", async () => {
    listMyGoals.mockResolvedValue([
      {
        goal: undefined,
        habits: [
          makeHabit({ id: 1n, state: GoalState.paused }),
          makeHabit({ id: 2n, state: GoalState.completed }),
        ],
      },
    ]);

    renderPage();

    expect(await screen.findByText("Paused")).toBeInTheDocument();
    expect(await screen.findByText("Completed")).toBeInTheDocument();
  });

  it("opens the habit delete dialog with the habit-specific confirmation copy", async () => {
    const user = userEvent.setup();
    renderPage();

    const deleteButton = await screen.findByRole("button", {
      name: "Delete habit Run every morning",
    });
    await user.click(deleteButton);

    // GoalsPage's DeleteHabitDialog copy: habit-level title + check-in warning.
    expect(
      await screen.findByText("Delete habit permanently?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/all of its check-in history/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/including streaks and progress records/i),
    ).toBeInTheDocument();
  });

  it("filters the habit list by state tab", async () => {
    const user = userEvent.setup();
    listMyGoals.mockResolvedValue([
      {
        goal: undefined,
        habits: [
          makeHabit({
            id: 1n,
            state: GoalState.active,
            wishDescription: "Active habit",
          }),
          makeHabit({
            id: 2n,
            state: GoalState.paused,
            wishDescription: "Paused habit",
          }),
        ],
      },
    ]);

    renderPage();

    // Default filter is GoalState.active, so only the active habit shows.
    expect(await screen.findByText("Active habit")).toBeInTheDocument();
    expect(screen.queryByText("Paused habit")).not.toBeInTheDocument();

    // Switch to the Paused tab.
    await user.click(screen.getByRole("button", { name: /paused/i }));
    expect(await screen.findByText("Paused habit")).toBeInTheDocument();
    // The exiting card lingers in the DOM during the AnimatePresence exit
    // animation, so wait for it to be removed rather than asserting instantly.
    await waitFor(() =>
      expect(screen.queryByText("Active habit")).not.toBeInTheDocument(),
    );
  });
});
