import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeHabit } from "../test/fixtures";
import { GoalCard, clearCheckInMarkers } from "./GoalCard";

// GoalCard pulls `useResolveObstacleLabel` (via ../types) which reaches the
// backend seam. The card under test never resolves an obstacle, so stub the
// hook module rather than booting the canister infrastructure.
vi.mock("../hooks/useBackend", () => ({
  useBackend: () => ({ actor: null, isFetching: false, actorReady: false }),
}));

// ─── GoalCard — if-then follow-up question visibility ─────────────────────────
// The follow-up question's visibility is DERIVED fresh on every render from the
// check-in record itself:
//   show the question  ⇔  !executedIfThen && !followUpDeclined
//   quiet "Not answered" ⇔  !executedIfThen && followUpDeclined
// Both answers live on the check-in, so undoing the check-in removes them with
// it and a fresh check-in asks the question again. Nothing about the question
// is read from or written to browser storage.

function renderDoneCard(
  overrides: {
    executedIfThen?: boolean;
    followUpDeclined?: boolean;
    ifThenCheckInId?: bigint;
    onMarkIfThenUsed?: (goalId: bigint, checkInId: bigint) => void;
    onDeclineIfThen?: (goalId: bigint, checkInId: bigint) => void;
  } = {},
) {
  const goal = makeHabit({
    id: 7n,
    ifThenPlan: "If I feel tired, I will walk",
  });
  const onMarkIfThenUsed = overrides.onMarkIfThenUsed ?? vi.fn();
  const onDeclineIfThen = overrides.onDeclineIfThen ?? vi.fn();
  const utils = render(
    <GoalCard
      goal={goal}
      checkInToday={{ checkInType: "success" }}
      index={0}
      mode="done"
      isDarkMode={true}
      executedIfThen={overrides.executedIfThen ?? false}
      followUpDeclined={overrides.followUpDeclined ?? false}
      ifThenCheckInId={
        "ifThenCheckInId" in overrides ? overrides.ifThenCheckInId : 42n
      }
      onMarkIfThenUsed={onMarkIfThenUsed}
      onDeclineIfThen={onDeclineIfThen}
    />,
  );
  return { ...utils, goal, onMarkIfThenUsed, onDeclineIfThen };
}

describe("GoalCard — if-then follow-up question", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows the question on a fresh check-in that has not been answered", () => {
    renderDoneCard();

    expect(screen.getByText("I used my if-then plan")).toBeInTheDocument();
    expect(screen.getByTestId("goal.ifthen_note.action.1")).toBeInTheDocument();
    expect(
      screen.getByTestId("goal.ifthen_note.decline.1"),
    ).toBeInTheDocument();
    // The quiet not-answered state is NOT shown while the question is open.
    expect(screen.queryByText("Not answered")).not.toBeInTheDocument();
  });

  it("hides the question and marks the card as plan-used when executedIfThen is true", () => {
    renderDoneCard({ executedIfThen: true });

    expect(
      screen.queryByText("I used my if-then plan"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Not answered")).not.toBeInTheDocument();
    // The revival icon marks the card as a hard-fought win via the plan.
    expect(screen.getByTestId("goal.revival_icon")).toBeInTheDocument();
  });

  it("hides the question and shows the quiet not-answered state when declined", () => {
    renderDoneCard({ followUpDeclined: true });

    expect(
      screen.queryByText("I used my if-then plan"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Not answered")).toBeInTheDocument();
    expect(screen.getByTestId("goal.ifthen_declined.1")).toBeInTheDocument();
  });

  it("does not show the question for a habit with no if-then plan", () => {
    render(
      <GoalCard
        goal={makeHabit({ id: 8n, ifThenPlan: "" })}
        checkInToday={{ checkInType: "success" }}
        index={0}
        mode="done"
        isDarkMode={true}
        ifThenCheckInId={42n}
      />,
    );

    expect(
      screen.queryByText("I used my if-then plan"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Not answered")).not.toBeInTheDocument();
  });

  it("does not show the question while the check-in id is still unknown", () => {
    renderDoneCard({ ifThenCheckInId: undefined });

    expect(
      screen.queryByText("I used my if-then plan"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Not answered")).not.toBeInTheDocument();
  });

  it("reports 'Used it' with the real check-in id", async () => {
    const user = userEvent.setup();
    const { goal, onMarkIfThenUsed } = renderDoneCard({ ifThenCheckInId: 42n });

    await user.click(screen.getByTestId("goal.ifthen_note.action.1"));

    expect(onMarkIfThenUsed).toHaveBeenCalledWith(goal.id, 42n);
  });

  it("reports 'Decline' with the real check-in id", async () => {
    const user = userEvent.setup();
    const { goal, onDeclineIfThen } = renderDoneCard({ ifThenCheckInId: 42n });

    await user.click(screen.getByTestId("goal.ifthen_note.decline.1"));

    expect(onDeclineIfThen).toHaveBeenCalledWith(goal.id, 42n);
  });

  it("never reads or writes follow-up question state in browser storage", async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    renderDoneCard({ ifThenCheckInId: 42n });
    await user.click(screen.getByTestId("goal.ifthen_note.action.1"));

    // The question's state lives on the check-in record, never in storage.
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);

    setItem.mockRestore();
    getItem.mockRestore();
  });
});

// ─── Missed-window sheet marker ───────────────────────────────────────────────
// The missed-window sheet's "already shown" flag is the ONE piece of state that
// legitimately lives in browser storage. It stays keyed per habit per day, and
// undo clears it so a re-check-in can show the sheet again.

describe("clearCheckInMarkers — missed-window sheet flag", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears both failure-type markers for the habit on undo", () => {
    const today = new Date().toDateString();
    localStorage.setItem(`cumulative-missed-sheet-7-${today}-start`, "1");
    localStorage.setItem(`cumulative-missed-sheet-7-${today}-checkout`, "1");

    clearCheckInMarkers(7n, 42n);

    expect(
      localStorage.getItem(`cumulative-missed-sheet-7-${today}-start`),
    ).toBeNull();
    expect(
      localStorage.getItem(`cumulative-missed-sheet-7-${today}-checkout`),
    ).toBeNull();
  });

  it("leaves another habit's marker untouched", () => {
    const today = new Date().toDateString();
    localStorage.setItem(`cumulative-missed-sheet-7-${today}-start`, "1");
    localStorage.setItem(`cumulative-missed-sheet-9-${today}-start`, "1");

    clearCheckInMarkers(7n, 42n);

    expect(
      localStorage.getItem(`cumulative-missed-sheet-9-${today}-start`),
    ).toBe("1");
  });
});
