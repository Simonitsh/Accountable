import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Testing Library's automatic cleanup only registers itself when it finds a
// global `afterEach` at import time. Vitest's `globals: true` does not expose
// one to module scope here, so rendered trees leaked between tests and
// `getByTestId` started matching duplicates. Register cleanup explicitly.
afterEach(() => {
  cleanup();
});

// The generated components use `data-ocid` as their test hook attribute
// rather than the default `data-testid`. Configure Testing Library to query
// by `data-ocid` so semantic queries work against the real DOM.
configure({ testIdAttribute: "data-ocid" });

// `@caffeineai/object-storage` ships a `dist/index.js` that imports a
// `./blob` subpath its own exports map does not expose, so Vitest cannot
// resolve it (the Vite production build resolves it through a different
// mechanism). The app's `backend.ts` imports `ExternalBlob` from this
// package purely as a type/class carrier; the pages under test never touch
// it. Mock the module so importing `../backend` for the `GoalState` enum
// does not pull in the unresolvable package.
vi.mock("@caffeineai/object-storage", () => {
  function ExternalBlob() {}
  ExternalBlob.fromBytes = (_bytes: Uint8Array) => new ExternalBlob();
  return { ExternalBlob };
});
