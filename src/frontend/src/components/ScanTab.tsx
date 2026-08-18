import { useAuth } from "@/hooks/useAuth";
import { useSendConnectionRequest } from "@/hooks/useConnections";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  AlertCircle,
  Camera,
  CameraOff,
  Keyboard,
  ScanLine,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ScanStatus = "idle" | "scanning" | "success" | "error";
type SendState = "idle" | "sending" | "sent" | "error";

const CONTAINER_ID = "qr-scan-region";

// localStorage key used as the cross-page transport to surface a "new partner"
// glow on the Partners page after a successful connection request send.
// Mirrors the established NEW_HABIT_KEY pattern in DashboardPage/GoalsPage.
const NEW_PARTNER_KEY = "cumulative-new-partner-key";

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.AZTEC,
];

/**
 * Construct an Html5Qrcode instance for the fixed container id.
 *
 * The constructor throws synchronously if `document.getElementById` returns
 * null (container not mounted) or if a prior instance still owns the DOM
 * node. Callers MUST ensure (a) the container exists and (b) any prior
 * instance has been stopped + cleared first.
 *
 * Wrapped in its own function so a constructor throw is always caught by the
 * caller's try/catch — never escapes to the React render/error boundary.
 */
function createScanner(): Html5Qrcode {
  return new Html5Qrcode(CONTAINER_ID, {
    formatsToSupport: SUPPORTED_FORMATS,
    verbose: false,
  });
}

export function ScanTab() {
  const { principalText } = useAuth();
  const sendRequest = useSendConnectionRequest();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Track whether the component is still mounted so async callbacks can
  // bail out gracefully after awaits if ScanTab has unmounted.
  const mountedRef = useRef<boolean>(true);

  const [status, setStatus] = useState<ScanStatus>("idle");
  const [scannedPrincipal, setScannedPrincipal] = useState<string>("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  /**
   * Synchronous DOM teardown of the injected <video> + UI nodes. This is the
   * critical piece for the React/DOM ownership race: html5-qrcode injects
   * its own <video> element into #qr-scan-region, but React also owns that
   * container. When ScanTab unmounts, React's reconciler synchronously
   * removes the container's children — including the injected <video> that
   * React did not create — which throws
   * "Failed to execute removeChild on Node: The node to be removed is a
   * child of this node."
   *
   * clear() is synchronous (returns void per the .d.ts) and removes the
   * injected nodes. Calling it BEFORE React's unmount removes the container
   * prevents the crash. Never throws out of this function.
   */
  const clearScannerSync = useCallback(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      scanner.clear();
    } catch {
      // swallow — best-effort synchronous DOM cleanup
    }
  }, []);

  /**
   * Fully defensive async teardown. Never throws out of this function — every
   * operation is wrapped in its own try/catch so a failure in one step does
   * not prevent cleanup of the others, and the function always resolves.
   *
   * - Guards scannerRef.current against null.
   * - Guards scanner.isScanning existence (some versions may not expose it).
   * - Wraps stop() and clear() each in their own try/catch.
   * - Always nulls scannerRef.current at the end.
   *
   * NOTE: clear() is also called here for the async teardown path (e.g. when
   * starting a new scanner or resetting). The synchronous unmount path uses
   * clearScannerSync() directly because it cannot await stop() before React
   * removes the container.
   */
  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    // stop() is the only async lifecycle method. Guard isScanning existence
    // — accessing a missing property would yield undefined (falsy) and skip
    // stop(), which is wrong if the scanner is actually running. Use a
    // typeof check so we only call stop() when we know the property exists
    // and is truthy.
    try {
      if (typeof scanner.isScanning === "boolean" && scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // swallow — we still want to clear() below
    }

    // clear() is synchronous (returns void per the .d.ts). Wrap separately
    // so a stop() failure does not prevent DOM cleanup.
    try {
      scanner.clear();
    } catch {
      // swallow — best-effort DOM cleanup
    }

    scannerRef.current = null;
  }, []);

  /**
   * Cleanup on unmount. This is the FIX for the removeChild crash.
   *
   * React's unmount is synchronous: it removes the #qr-scan-region
   * container's children immediately when ScanTab unmounts (tab switch or
   * navigation). html5-qrcode has injected its own <video> into that
   * container — a node React did not create — so React's reconciler throws
   * "Failed to execute removeChild on Node" when it tries to remove it.
   *
   * The previous implementation fired `void stopScanner().catch(()=>{})`
   * asynchronously from this return, but React removes the children BEFORE
   * the awaited scanner.stop() ever runs, so the injected <video> was still
   * in the DOM when React tripped over it.
   *
   * The fix: call scanner.clear() SYNCHRONOUSLY in the cleanup body BEFORE
   * returning. clear() removes the injected <video> and any UI html5-qrcode
   * added, and it returns void (NOT a promise — do not await it). With the
   * injected nodes gone, React's reconciler has nothing foreign to remove
   * and the unmount completes cleanly. THEN fire-and-forget scanner.stop()
   * for the async camera teardown (releasing the camera hardware).
   *
   * The container div in JSX has NO React-managed children (see render), so
   * React never tries to reconcile its children — the only nodes inside it
   * are the ones html5-qrcode injects, which clear() removes synchronously.
   */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Mark unmounted first so any in-flight async callback bails out
      // before touching refs/state after its next await.
      mountedRef.current = false;

      // Synchronous DOM teardown FIRST. clear() removes the injected
      // <video> + UI nodes that React would otherwise trip over during its
      // synchronous unmount. Wrapped in its own try/catch so a failure here
      // cannot prevent the async stop() below.
      try {
        clearScannerSync();
      } catch {
        // swallow — clearScannerSync already swallows internally, but be
        // defensive against future changes
      }

      // Fire-and-forget the async camera teardown. stop() releases the
      // camera hardware; it cannot run synchronously but is safe to run
      // after clear() because the DOM nodes are already gone. Swallow any
      // rejection — the component is unmounted, there is no UI to surface
      // an error to.
      void stopScanner().catch(() => {
        /* ignore — best-effort async camera teardown */
      });
    };
  }, [clearScannerSync, stopScanner]);

  const startScanner = async () => {
    setScanError(null);
    setStatus("scanning");

    // Guard containerRef against null. If the component unmounted between
    // the click and this async body, containerRef.current is null and
    // accessing .innerHTML would throw a TypeError that escapes the try
    // below (the guard is before the try). Guard explicitly first.
    const container = containerRef.current;
    if (!container) {
      setStatus("error");
      setScanError("Scanner container not available. Reload the page.");
      return;
    }

    // Guarantee the container is empty before html5-qrcode injects its own
    // <video> element. The container has NO React-managed children (see
    // render), so the only thing this clears is any residual injected node
    // from a prior instance. Wrapped in try/catch — a corrupted DOM node
    // should not crash the route.
    try {
      container.innerHTML = "";
    } catch {
      // best-effort — proceed and let the constructor throw if it must
    }

    // Destroy any prior scanner instance BEFORE constructing a new one. A
    // second tap on Start Scanning (or a re-entry after a failed start)
    // would otherwise collide with the prior instance still holding the
    // container DOM node, and `new Html5Qrcode(CONTAINER_ID)` would throw
    // "already in use". Await so the teardown completes first.
    try {
      await stopScanner();
    } catch {
      // stopScanner never throws, but be defensive against future changes
    }

    // Re-read the container after the await — the component may have
    // unmounted during stopScanner. Also check mountedRef so we do not
    // touch state on an unmounted component.
    if (!mountedRef.current || !containerRef.current) {
      // Component unmounted mid-start. stopScanner already ran in the
      // unmount cleanup; nothing else to do.
      return;
    }

    // Use a qrbox FUNCTION instead of a fixed { width, height } so the
    // viewfinder frame is always proportionally centered inside the square
    // wrapper regardless of viewport size. html5-qrcode calls this function
    // with the rendered width/height of the scan region (the container), so
    // Math.min * 0.7 yields a square frame with equal ~15% padding on all
    // four sides. A fixed qrbox (e.g. 200x200) is centered against the
    // injected <video>'s intrinsic size, NOT the visible square wrapper —
    // when the video renders taller than the wrapper (overflow-hidden clips
    // it), the frame appears off-center vertically. The function form
    // guarantees equal padding on all four sides inside the square wrapper.
    const scanConfig = {
      fps: 10,
      qrbox: (
        viewfinderWidth: number,
        viewfinderHeight: number,
      ): { width: number; height: number } => {
        const size = Math.floor(
          Math.min(viewfinderWidth, viewfinderHeight) * 0.7,
        );
        return { width: size, height: size };
      },
    };

    // Wrap the decoded callback body in its own try/catch. html5-qrcode
    // invokes onDecoded from inside its internal scan loop, OUTSIDE the
    // startScanner call stack — so an uncaught throw here propagates up
    // through the library and crashes the route (the error boundary fires).
    // We capture the decoded text and surface it via React state; if
    // anything throws, we swallow it so the scan loop keeps running (or
    // stops cleanly below).
    const onDecoded = (decodedText: string) => {
      try {
        if (!mountedRef.current) return;
        if (!decodedText) return;
        setScannedPrincipal(decodedText);
        setStatus("success");
        // Fire-and-forget teardown. stopScanner is fully defensive and
        // never throws, but wrap to be safe against future changes.
        void stopScanner().catch(() => {
          /* ignore */
        });
      } catch {
        // swallow — never let a callback throw escape to the scan loop
      }
    };

    // onDecodeError fires on per-frame decode failures (no QR in frame).
    // Wrap defensively even though the body is empty — a future edit or a
    // library quirk should not be able to crash the route from here.
    const onDecodeError = () => {
      try {
        // per-frame decode failure — ignore silently
      } catch {
        // swallow — defensive only
      }
    };

    try {
      // Both the constructor AND start() are inside this try. The
      // constructor can throw synchronously (missing element, prior
      // instance); start() can throw synchronously OR reject asynchronously.
      // Wrapping both means any of these lands in the fallback below
      // instead of escaping to the error boundary.
      const scanner = createScanner();
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        scanConfig,
        onDecoded,
        onDecodeError,
      );
      // Re-check mounted after the await — if unmounted, the cleanup
      // already tore down the scanner; do not touch state.
      if (!mountedRef.current) return;
      return;
    } catch (primaryError) {
      // If we unmounted during the primary attempt, do not attempt the
      // fallback — the cleanup already handled teardown.
      if (!mountedRef.current) {
        return;
      }
      // Fallback: enumerate cameras explicitly and start with the first
      // available cameraId. This handles browsers/devices that reject the
      // facingMode shorthand or have a single camera.
      try {
        // The primary attempt may have left a half-constructed instance in
        // scannerRef.current (e.g. constructor succeeded but start()
        // rejected). Tear it down before retrying so the new constructor
        // does not collide with a stale instance on the same container id.
        await stopScanner();

        // Re-read refs after the await — component may have unmounted.
        if (!mountedRef.current || !containerRef.current) {
          return;
        }

        const scanner = createScanner();
        scannerRef.current = scanner;
        const cameras = await Html5Qrcode.getCameras();
        // Re-check mounted after the await.
        if (!mountedRef.current) {
          // Cleanup already ran on unmount; abort.
          return;
        }
        if (!cameras || cameras.length === 0) {
          throw new Error("No cameras found on this device.");
        }
        await scanner.start(
          cameras[0].id,
          scanConfig,
          onDecoded,
          onDecodeError,
        );
        if (!mountedRef.current) return;
        return;
      } catch (fallbackError) {
        // Both paths failed. Tear down any residual instance and show the
        // user-facing error state instead of crashing.
        try {
          await stopScanner();
        } catch {
          // ignore — stopScanner never throws
        }
        if (!mountedRef.current) return;
        setStatus("error");
        setScanError(
          "Camera not available. Check browser permissions or try a different camera.",
        );
        // surface the underlying reasons for debugging without leaking to UI
        void primaryError;
        void fallbackError;
      }
    }
  };

  const resetScan = async () => {
    try {
      await stopScanner();
    } catch {
      // stopScanner never throws — defensive only
    }
    if (!mountedRef.current) return;
    setScannedPrincipal("");
    setStatus("idle");
    setScanError(null);
  };

  const handleSend = async (principal: string) => {
    const trimmed = principal.trim();
    if (!trimmed || !principalText) return;
    setSendState("sending");
    setSendError(null);
    try {
      await sendRequest.mutateAsync(trimmed);
      if (!mountedRef.current) return;

      // Set the cross-page glow transport key so PartnersPage can surface
      // a "new partner" highlight on the freshly-requested partner. Mirrors
      // the NEW_HABIT_KEY pattern in DashboardPage/GoalsPage. Wrap in
      // try/catch — localStorage may be unavailable (private mode, etc.)
      // and a throw here must not block the navigation.
      try {
        localStorage.setItem(NEW_PARTNER_KEY, trimmed);
      } catch {
        // best-effort — glow is a non-critical enhancement
      }

      // Invalidate the partnerOverviews cache so PartnersPage loads fresh
      // data (the new pending request / partner) instead of showing stale
      // state. The useSendConnectionRequest onSuccess already invalidates
      // ['pendingRequests'] + ['connections'], but partnerOverviews is a
      // separate query key that must be invalidated explicitly here.
      void queryClient.invalidateQueries({ queryKey: ["partnerOverviews"] });

      // Show the success toast (existing behavior) before navigating away.
      setSendState("sent");
      setScannedPrincipal("");
      setStatus("idle");
      setManualInput("");

      // Navigate to /partners immediately — the user is leaving this view
      // anyway, so the previous 2.5s "reset to idle" wait is replaced by
      // the navigation. The success toast state is preserved for the brief
      // moment before unmount; the cleanup effect handles scanner teardown.
      navigate({ to: "/partners" });
    } catch (e) {
      if (!mountedRef.current) return;
      setSendState("error");
      setSendError(e instanceof Error ? e.message : "Failed to send request");
    }
  };

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex items-center gap-3 text-foreground">
        <div className="avatar-container flex h-14 w-14 items-center justify-center">
          <ScanLine className="h-7 w-7 text-foreground" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">
            Scan Partner QR
          </h2>
          <p className="text-sm text-muted-foreground">
            Scan a partner&apos;s Principal ID QR code
          </p>
        </div>
      </div>

      {/* Scanner card */}
      <div className="card-neumorphic w-full rounded-2xl p-5">
        {/*
         * Scanner container — ISOLATED from React's reconciler.
         *
         * html5-qrcode injects its own <video> element into this div. If
         * React also managed children here, the unmount reconciler would
         * try to remove the injected <video> (a node React did not create)
         * and throw "Failed to execute removeChild on Node".
         *
         * This div has NO React-managed children — no conditional content,
         * no placeholders, nothing. The placeholder UI is rendered as a
         * sibling overlay (absolutely positioned) so React never touches
         * this container's children. The only nodes inside this container
         * are the ones html5-qrcode injects, and the useEffect cleanup
         * removes them synchronously via scanner.clear() BEFORE React's
         * unmount removes the container.
         */}
        {/*
         * Scanner wrapper — relative + overflow-hidden + square aspect.
         *
         * aspect-square makes the camera viewport a square so the qrbox
         * (200x200) is centered with equal padding on all four sides — the
         * frame is fully visible inside the camera view, not cut off at the
         * top/bottom. max-w-sm caps the square's width on wider screens.
         *
         * overflow-hidden is a belt-and-suspenders measure: html5-qrcode's
         * injected <video> sets its own inline absolute positioning and
         * z-index, and on some devices it overflows the frame vertically.
         * Clipping here keeps the video inside the scanner frame.
         */}
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden">
          <div
            ref={containerRef}
            id={CONTAINER_ID}
            className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl bg-background/40 shadow-neumorphic-inset"
            data-ocid="scan.canvas_target"
          />
          {status !== "scanning" && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center gap-3 text-center text-muted-foreground">
              <Camera className="h-10 w-10 text-foreground/70" />
              <p className="text-sm">
                {status === "idle"
                  ? "Camera is off. Tap start to scan."
                  : status === "error"
                    ? "Camera unavailable."
                    : "Scan complete."}
              </p>
            </div>
          )}
        </div>

        {scanError && (
          <div
            className="mt-4 flex items-start gap-2 rounded-lg bg-accent-social/10 p-3 text-sm text-foreground"
            data-ocid="scan.error_state"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {status !== "scanning" ? (
            <button
              type="button"
              onClick={startScanner}
              disabled={!principalText}
              className="button-primary-neon flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-smooth disabled:cursor-not-allowed disabled:opacity-50"
              data-ocid="scan.start_button"
            >
              <Camera className="h-4 w-4" />
              Start Scanning
            </button>
          ) : (
            <button
              type="button"
              onClick={resetScan}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm font-semibold text-foreground transition-smooth"
              data-ocid="scan.stop_button"
            >
              <CameraOff className="h-4 w-4" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Scanned result confirmation */}
      {scannedPrincipal && (
        <div
          className="card-neumorphic w-full rounded-2xl p-5"
          data-ocid="scan.success_state"
        >
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground">
            Scanned Principal ID
          </div>
          <div className="break-all rounded-xl bg-background/40 p-4 font-mono text-sm leading-relaxed text-foreground shadow-neumorphic-inset">
            {scannedPrincipal}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => handleSend(scannedPrincipal)}
              disabled={sendState === "sending"}
              className="button-primary-neon flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-smooth disabled:opacity-50"
              data-ocid="scan.send_button"
            >
              <Send className="h-4 w-4" />
              {sendState === "sending" ? "Sending..." : "Send Partner Request"}
            </button>
            <button
              type="button"
              onClick={resetScan}
              className="rounded-xl bg-muted px-4 py-3 text-sm font-semibold text-foreground transition-smooth"
              data-ocid="scan.cancel_button"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Manual entry fallback */}
      <div className="card-neumorphic w-full rounded-2xl p-5">
        <div className="mb-3 flex items-center gap-2 text-foreground">
          <Keyboard className="h-4 w-4 text-foreground" />
          <h3 className="font-display text-base font-semibold">Manual Entry</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Can&apos;t scan? Paste a partner&apos;s Principal ID below.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Paste Principal ID..."
            className="input-neumorphic flex-1 rounded-xl px-4 py-3 font-mono text-sm text-foreground outline-none"
            data-ocid="scan.input"
          />
          <button
            type="button"
            onClick={() => handleSend(manualInput)}
            disabled={!manualInput.trim() || sendState === "sending"}
            className="button-primary-neon flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-smooth disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            data-ocid="scan.manual_send_button"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </div>

      {/* Send feedback */}
      {sendState === "sent" && (
        <div
          className="rounded-xl bg-accent-social/15 p-3 text-center text-sm font-medium text-foreground"
          data-ocid="scan.success_toast"
        >
          Partner request sent!
        </div>
      )}
      {sendState === "error" && sendError && (
        <div
          className="flex items-start gap-2 rounded-xl bg-accent-social/10 p-3 text-sm text-foreground"
          data-ocid="scan.send_error_state"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{sendError}</span>
        </div>
      )}
    </div>
  );
}

export default ScanTab;
