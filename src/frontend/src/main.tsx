import { InternetIdentityProvider } from "@caffeineai/core-infrastructure";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import { createActor } from "./backend";
import "./index.css";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// ─── One-time dev data reset ──────────────────────────────────────────────────
// Fires ONCE before the app mounts. Uses an anonymous (unauthenticated) actor
// since devReset() requires no auth. The localStorage flag prevents re-runs.
const RESET_KEY = "cumulative_reset_v1";

async function runDevResetIfNeeded(): Promise<void> {
  if (localStorage.getItem(RESET_KEY)) return;

  try {
    const canisterId =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (import.meta as any).env?.CANISTER_ID_BACKEND as string | undefined;

    if (!canisterId) return;

    const noopUpload = async (_file: unknown): Promise<Uint8Array> =>
      new Uint8Array();
    const noopDownload = async (_file: unknown) => {
      const { ExternalBlob } = await import("./backend");
      return ExternalBlob.fromBytes(new Uint8Array());
    };

    const actor = createActor(
      canisterId,
      noopUpload as (
        f: import("./backend").ExternalBlob,
      ) => Promise<Uint8Array>,
      noopDownload as (
        f: Uint8Array,
      ) => Promise<import("./backend").ExternalBlob>,
    );

    await actor.devReset();
    localStorage.setItem(RESET_KEY, "1");
  } catch {
    // Silently ignore — app still loads normally even if reset fails
  }
}

// ─── Boot sequence ────────────────────────────────────────────────────────────
// Mount immediately — never block the render on the dev reset network call.
// The reset runs concurrently in the background; if it fails the app still loads.
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <InternetIdentityProvider>
      <App />
    </InternetIdentityProvider>
  </QueryClientProvider>,
);

// Fire dev reset in the background without blocking mount.
void runDevResetIfNeeded();
