import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfilePublic } from "../backend.d.ts";
import { useUserProfile } from "./useUserProfile";

// ─── Backend seam ─────────────────────────────────────────────────────────────
// useUserProfile talks to the canister through useBackend(). Replace it with a
// small in-memory actor so the sync-on-load / visibilitychange behavior runs
// against deterministic data with no network.
let syncTimezone: ReturnType<typeof vi.fn>;
let getMyProfile: ReturnType<typeof vi.fn>;

vi.mock("./useBackend", () => ({
  useBackend: () => ({
    actor: {
      getMyProfile: (...args: unknown[]) => getMyProfile(...args),
      syncTimezone: (...args: unknown[]) => syncTimezone(...args),
    },
    isFetching: false,
    actorReady: true,
  }),
}));

vi.mock("./useAuth", () => ({
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

function makeProfile(
  overrides: Partial<UserProfilePublic> = {},
): UserProfilePublic {
  return {
    id: "aaaaa-aa" as unknown as UserProfilePublic["id"],
    username: "alex_cumulative",
    displayName: "Alex",
    avatarShape: null,
    avatarColor: null,
    avatarColorMode: "Fill" as UserProfilePublic["avatarColorMode"],
    timezone: "UTC",
    role: "user" as UserProfilePublic["role"],
    timezoneOffsetMinutes: 0n,
    ...overrides,
  } as UserProfilePublic;
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useUserProfile timezone sync", () => {
  beforeEach(() => {
    syncTimezone = vi.fn().mockResolvedValue(undefined);
    getMyProfile = vi.fn().mockResolvedValue(makeProfile());
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: "America/New_York" }),
        }) as unknown as Intl.DateTimeFormat,
    );
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(300);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs the device zone and offset once the profile loads", async () => {
    renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(syncTimezone).toHaveBeenCalledWith("America/New_York", -300n);
    });
  });

  it("does not sync when the stored values already match the device", async () => {
    getMyProfile = vi.fn().mockResolvedValue(
      makeProfile({
        timezone: "America/New_York",
        timezoneOffsetMinutes: -300n,
      }),
    );

    renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(getMyProfile).toHaveBeenCalled();
    });
    expect(syncTimezone).not.toHaveBeenCalled();
  });

  it("re-syncs when the tab becomes visible again", async () => {
    renderHook(() => useUserProfile(), { wrapper });

    await waitFor(() => {
      expect(syncTimezone).toHaveBeenCalledTimes(1);
    });

    // Simulate a DST shift / travel while the tab was hidden.
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(240);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(syncTimezone).toHaveBeenCalledWith("America/New_York", -240n);
    });
  });
});
