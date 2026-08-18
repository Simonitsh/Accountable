import { useAuth } from "@/hooks/useAuth";
import { AlertCircle, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

export function MyQrTab() {
  const { principalText } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!canvasRef.current || !principalText) return;
      try {
        await QRCode.toCanvas(canvasRef.current, principalText, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#1a1a1a", light: "#ffffff" },
        });
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render QR code");
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [principalText]);

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="flex items-center gap-3 text-foreground">
        <div className="avatar-container flex h-14 w-14 items-center justify-center">
          <QrCode className="h-7 w-7 text-foreground" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">Your QR Code</h2>
          <p className="text-sm text-muted-foreground">
            Scan to connect instantly
          </p>
        </div>
      </div>

      <div className="card-neumorphic w-full max-w-md rounded-2xl p-6">
        <div className="flex items-center justify-center rounded-xl bg-white p-4 shadow-neumorphic-inset">
          {principalText ? (
            <canvas
              ref={canvasRef}
              className="h-64 w-64 max-w-full"
              aria-label="QR code encoding your Principal ID"
              data-ocid="myqr.canvas"
            />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center text-sm text-muted-foreground">
              Sign in to view your QR code
            </div>
          )}
        </div>

        {error && (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg bg-accent-social/10 p-3 text-sm text-foreground"
            data-ocid="myqr.error_state"
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <p className="max-w-md text-center text-sm text-muted-foreground">
        Have a partner scan this code to send you a request.
      </p>
    </div>
  );
}

export default MyQrTab;
