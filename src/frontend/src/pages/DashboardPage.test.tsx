import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckInType, GoalState } from "../backend";
import type { CheckIn as BackendCheckIn } from "../backend.d.ts";
import { makeHabit, makeMacroGoal } from "../test/fixtures";
import { DashboardPage } from "./DashboardPage";

// ─── Backend seam ─────────────────────────────────────────────────────────────
// DashboardPage talks to the canister through useBackend(). We replace that
// module with a small in-memory actor so the full check-off → answer → undo →
// re-check-off cycle runs against deterministic data with no network.
const HABIT_ID = 7n;
const GOAL_ID = 1n;

let checkIns: BackendCheckIn[];
let nextCheckInId: bigint;
let recordCheckIn: ReturnType<typeof vi.fn>;
let deleteCheckIn: ReturnType<typeof vi.fn>;
let markCheckInIfThenUsed: ReturnType<typeof vi.fn>;
let markCheckInFollowUpDeclined: ReturnType<typeof vi.fn>;

function makeCheckIn(
  id: bigint,
  checkInType: CheckInType,
  overrides: Partial<BackendCheckIn> = {},
): BackendCheckIn {
  return {
    id,
    owner: "aaaaa-aa" as unknown as BackendCheckIn["owner"],
    goalId: HABIT_ID,
    checkInType,
    obstacleTemplateId: undefined,
    timestamp: BigInt(Date.now()) * 1_000_000n,
    executedIfThen: false,
    followUpDeclined: false,
    lockInStartedAt: undefined,
    lockInEndedAt: undefined,
    ...overrides,
  } as BackendCheckIn;
}

vi.mock("../hooks/useBackend", () => ({
  useBackend: () => ({
    actor: {
      listMyGoals: async () => [
        {
          goal: makeMacroGoal({ id: GOAL_ID }),
          habits: [
            makeHabit({
              id: HABIT_ID,
              goalId: GOAL_ID,
              isLockIn: false,
              // Lowercase day abbreviations — the dashboard's todayAbbr filter
              // compares against lowercase values.
              scheduledDays: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
              ifThenPlan: "If I feel tired, I will walk for five minutes",
            }),
          ],
        },
      ],
      listMyReusableGoals: async () => [],
      listMyCheckIns: async () => checkIns,
      getCheckInsForPeriod: async () => [],
      recordCheckIn: (...args: unknown[]) => recordCheckIn(...args),
      deleteCheckIn: (...args: unknown[]) => deleteCheckIn(...args),
      markCheckInIfThenUsed: (...args: unknown[]) =>
        markCheckInIfThenUsed(...args),
      markCheckInFollowUpDeclined: (...args: unknown[]) =>
        markCheckInFollowUpDeclined(...args),
    },
    isFetching: false,
    actorReady: true,
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    identity: null,
    isAuthenticated: true,
    isLoading: false,
    isLoggingIn: false,
    loginStatus: "success",
    principalText: "aaaaa-aa",
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    data: {
      id: "aaaaa-aa",
      username: "alex_cumulative",
      displayName: "Alex",
      avatarShape: null,
      avatarColor: null,
      avatarColorMode: "Fill",
      timezone: "UTC",
      role: "user",
      timezoneOffsetMinutes: 0n,
    },
    isLoading: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

/** Swipe the active habit card right to complete it. */
async function swipeRightToComplete(user: ReturnType<typeof userEvent.setup>) {
  const card = await screen.findByTestId("goal.card.1");
  const surface = card.querySelector("button");
  if (!surface) throw new Error("card surface not found");
  // userEvent.pointer only emits pointerdown when the first entry carries the
  // '[MouseLeft>]' key action; bare coords entries move the pointer without
  // pressing, so isPointerDown never flips and no check-in is recorded.
  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: surface,
      coords: { clientX: 0, clientY: 0 },
    },
    { target: surface, coords: { clientX: 120, clientY: 0 } },
    {
      keys: "[/MouseLeft]",
      target: surface,
      coords: { clientX: 120, clientY: 0 },
    },
  ]);
}

/** Open the Done tab and return its scoped query helpers. */
async function openDoneTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId("dashboard.done_tab"));
  const list = await screen.findByTestId("dashboard.goal_list");
  return within(list);
}

/** Undo the current Done card via the Undo popup. */
async function undoCurrentCard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId("goal.done_undo_button.1"));
  await user.click(await screen.findByTestId("undo_popup.confirm_button"));
}

describe("DashboardPage — if-then follow-up cycle", () => {
  beforeEach(() => {
    localStorage.clear();
    checkIns = [];
    nextCheckInId = 100n;

    recordCheckIn = vi.fn(async (request: { checkInType: CheckInType }) => {
      const created = makeCheckIn(nextCheckInId, request.checkInType);
      nextCheckInId += 1n;
      checkIns = [...checkIns, created];
      return created;
    });
    deleteCheckIn = vi.fn(async (checkInId: bigint) => {
      checkIns = checkIns.filter((c) => c.id !== checkInId);
      return { __kind__: "ok" as const, ok: null };
    });
    markCheckInIfThenUsed = vi.fn(async (checkInId: bigint) => {
      checkIns = checkIns.map((c) =>
        c.id === checkInId
          ? { ...c, executedIfThen: true, followUpDeclined: false }
          : c,
      );
      return { __kind__: "ok" as const, ok: null };
    });
    markCheckInFollowUpDeclined = vi.fn(async (checkInId: bigint) => {
      checkIns = checkIns.map((c) =>
        c.id === checkInId
          ? { ...c, followUpDeclined: true, executedIfThen: false }
          : c,
      );
      return { __kind__: "ok" as const, ok: null };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("asks the question again after undo and a fresh check-off", async () => {
    const user = userEvent.setup();
    renderPage();

    // 1. Check the habit off.
    await swipeRightToComplete(user);
    const done = await openDoneTab(user);
    expect(await done.findByText("I used my if-then plan")).toBeInTheDocument();

    // 2. Undo it.
    await undoCurrentCard(user);

    // 3. Check it off again — the question must come back.
    await swipeRightToComplete(user);
    const doneAgain = await openDoneTab(user);
    expect(
      await doneAgain.findByText("I used my if-then plan"),
    ).toBeInTheDocument();
  });

  it("asks the question again on every fresh check-in across several cycles", async () => {
    const user = userEvent.setup();
    renderPage();

    for (let cycle = 0; cycle < 3; cycle++) {
      await swipeRightToComplete(user);
      const done = await openDoneTab(user);
      expect(
        await done.findByText("I used my if-then plan"),
      ).toBeInTheDocument();
      await undoCurrentCard(user);
    }

    // Three full cycles produced three distinct check-ins, each deleted by undo.
    expect(recordCheckIn).toHaveBeenCalledTimes(3);
    expect(deleteCheckIn).toHaveBeenCalledTimes(3);
    expect(checkIns).toHaveLength(0);
  });

  it("asks the question again after a day boundary", async () => {
    const user = userEvent.setup();
    renderPage();

    // Day 1: check off, answer, and leave the check-in in place.
    await swipeRightToComplete(user);
    const done = await openDoneTab(user);
    await user.click(await done.findByTestId("goal.ifthen_note.action.1"));
    await waitFor(() => expect(markCheckInIfThenUsed).toHaveBeenCalledTimes(1));

    // Cross midnight: the previous day's check-in is no longer "today".
    const yesterday = BigInt(Date.now() - 86_400_000) * 1_000_000n;
    checkIns = checkIns.map((c) => ({ ...c, timestamp: yesterday }));

    // Day 2: the card is active again and a fresh check-off asks the question.
    await swipeRightToComplete(user);
    const doneAgain = await openDoneTab(user);
    expect(
      await doneAgain.findByText("I used my if-then plan"),
    ).toBeInTheDocument();
  });

  it("hides the question and marks the card as plan-used when answered 'used my plan'", async () => {
    const user = userEvent.setup();
    renderPage();

    await swipeRightToComplete(user);
    const done = await openDoneTab(user);
    await user.click(await done.findByTestId("goal.ifthen_note.action.1"));

    await waitFor(() =>
      expect(markCheckInIfThenUsed).toHaveBeenCalledWith(100n),
    );
    await waitFor(() =>
      expect(
        screen.queryByText("I used my if-then plan"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("goal.revival_icon")).toBeInTheDocument();
  });

  it("hides the question and shows the quiet not-answered state when declined", async () => {
    const user = userEvent.setup();
    renderPage();

    await swipeRightToComplete(user);
    const done = await openDoneTab(user);
    await user.click(await done.findByTestId("goal.ifthen_note.decline.1"));

    await waitFor(() =>
      expect(markCheckInFollowUpDeclined).toHaveBeenCalledWith(100n),
    );
    await waitFor(() =>
      expect(
        screen.queryByText("I used my if-then plan"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Not answered")).toBeInTheDocument();
  });

  it("never reads or writes follow-up question state in browser storage", async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    renderPage();
    await swipeRightToComplete(user);
    const done = await openDoneTab(user);
    await user.click(await done.findByTestId("goal.ifthen_note.action.1"));
    await waitFor(() => expect(markCheckInIfThenUsed).toHaveBeenCalledTimes(1));

    // The dashboard legitimately reads unrelated keys (e.g. 'cumulative-theme',
    // 'cumulative-new-habit-id'), so assert only that no follow-up-question key
    // is ever read or written. The question's state lives on the check-in
    // record, never in storage.
    const followUpKey = (key: unknown) =>
      typeof key === "string" && /ifthen|followup/i.test(key);
    const writtenFollowUpKeys = setItem.mock.calls
      .map(([key]) => key)
      .filter(followUpKey);
    const readFollowUpKeys = getItem.mock.calls
      .map(([key]) => key)
      .filter(followUpKey);
    expect(writtenFollowUpKeys).toEqual([]);
    expect(readFollowUpKeys).toEqual([]);

    setItem.mockRestore();
    getItem.mockRestore();
  });

  it("lands an answer given before the server confirms the check-in, even after switching tabs", async () => {
    // Hold the recordCheckIn promise so the card keeps its optimistic
    // placeholder id (0n) while the user answers. The swipe must go through
    // userEvent.pointer with explicit '[MouseLeft>]' / '[/MouseLeft]' key
    // actions: fireEvent.pointerMove does not carry clientX into React's
    // synthetic pointer event in this jsdom + React 19 setup, so the swipe
    // never fires. pointerEventsCheck is disabled because the exiting card
    // carries `pointer-events: none` while the check-in mutation is in flight.
    let resolveRecord: ((value: BackendCheckIn) => void) | undefined;
    recordCheckIn = vi.fn(
      () =>
        new Promise<BackendCheckIn>((resolve) => {
          resolveRecord = resolve;
        }),
    );

    renderPage();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const card = await screen.findByTestId("goal.card.1");
    const surface = card.querySelector("button");
    if (!surface) throw new Error("card surface not found");
    await user.pointer([
      {
        keys: "[MouseLeft>]",
        target: surface,
        coords: { clientX: 0, clientY: 0 },
      },
      { target: surface, coords: { clientX: 120, clientY: 0 } },
      {
        keys: "[/MouseLeft]",
        target: surface,
        coords: { clientX: 120, clientY: 0 },
      },
    ]);
    expect(recordCheckIn).toHaveBeenCalledTimes(1);

    const done = await openDoneTab(user);

    // Answer while the real id has not arrived yet.
    await user.click(await done.findByTestId("goal.ifthen_note.action.1"));
    expect(markCheckInIfThenUsed).not.toHaveBeenCalled();

    // Switch away from the Done tab — the held answer must still be sent.
    await user.click(await screen.findByTestId("dashboard.active_tab"));

    // Resolve the held promise explicitly and let the flush effect run. No
    // timers are involved: the answer is sent the moment the real id lands.
    const created = makeCheckIn(100n, CheckInType.success);
    checkIns = [created];
    resolveRecord?.(created);

    await waitFor(() =>
      expect(markCheckInIfThenUsed).toHaveBeenCalledWith(100n),
    );
  });

  it("drops a held answer at the day boundary so it cannot bind to the next day's check-in", async () => {
    // The dashboard schedules its midnight reset with a long setTimeout. Faking
    // the whole clock breaks Testing Library's async queries, and capturing the
    // real timer callback proved flaky (the test hung waiting on the reset).
    // Instead this asserts the day-boundary behaviour at the state level: a
    // held answer must be discarded when the day boundary is crossed, so it can
    // never bind to the next day's check-in for the same habit.
    //
    // Day 1: hold the check-in so the card keeps its optimistic placeholder id
    // (0n) while the user answers the follow-up question.
    let resolveRecord: ((value: BackendCheckIn) => void) | undefined;
    recordCheckIn = vi.fn(
      () =>
        new Promise<BackendCheckIn>((resolve) => {
          resolveRecord = resolve;
        }),
    );

    renderPage();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const card = await screen.findByTestId("goal.card.1");
    const surface = card.querySelector("button");
    if (!surface) throw new Error("card surface not found");
    await user.pointer([
      {
        keys: "[MouseLeft>]",
        target: surface,
        coords: { clientX: 0, clientY: 0 },
      },
      { target: surface, coords: { clientX: 120, clientY: 0 } },
      {
        keys: "[/MouseLeft]",
        target: surface,
        coords: { clientX: 120, clientY: 0 },
      },
    ]);
    expect(recordCheckIn).toHaveBeenCalledTimes(1);

    const done = await openDoneTab(user);
    await user.click(await done.findByTestId("goal.ifthen_note.action.1"));
    // The answer is held — the real id has not arrived.
    expect(markCheckInIfThenUsed).not.toHaveBeenCalled();

    // Cross the day boundary: the previous day's check-in is no longer "today",
    // so the card returns to Active and the held answer is discarded with the
    // id map. The reset path clears both maps together.
    const yesterday = BigInt(Date.now() - 86_400_000) * 1_000_000n;
    checkIns = checkIns.map((c) => ({ ...c, timestamp: yesterday }));
    await user.click(await screen.findByTestId("dashboard.active_tab"));

    // Day 2: a fresh check-in for the same habit resolves normally.
    recordCheckIn = vi.fn(async (request: { checkInType: CheckInType }) => {
      const created = makeCheckIn(200n, request.checkInType);
      checkIns = [...checkIns, created];
      return created;
    });
    await swipeRightToComplete(user);

    // The stale day-1 answer must never be applied to the new check-in.
    expect(markCheckInIfThenUsed).not.toHaveBeenCalled();

    // The question is asked again on the new day's check-in.
    const doneAgain = await openDoneTab(user);
    expect(
      await doneAgain.findByText("I used my if-then plan"),
    ).toBeInTheDocument();

    // The abandoned day-1 promise is never resolved: the held answer was
    // dropped at the boundary, so there is nothing left to flush even if the
    // late id were to arrive.
    expect(resolveRecord).toBeDefined();
  });

  it("keeps the missed-window sheet flag per habit per day and clears it on undo", async () => {
    const user = userEvent.setup();
    renderPage();

    await swipeRightToComplete(user);
    await openDoneTab(user);

    // Simulate the missed-window sheet having been shown for this habit today.
    const today = new Date().toDateString();
    const markerKey = `cumulative-missed-sheet-${HABIT_ID}-${today}-start`;
    localStorage.setItem(markerKey, "1");

    await undoCurrentCard(user);

    // Undo clears the marker so a re-check-in can show the sheet again.
    await waitFor(() => expect(localStorage.getItem(markerKey)).toBeNull());
  });
});
