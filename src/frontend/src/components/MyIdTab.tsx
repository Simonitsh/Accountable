import { useAuth } from "@/hooks/useAuth";
import { Check, Copy, UserCircle2 } from "lucide-react";
import { useState } from "react";

export function MyIdTab() {
  const { principalText } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!principalText) return;
    try {
      await navigator.clipboard.writeText(principalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without the async clipboard API
      const ta = document.createElement("textarea");
      ta.value = principalText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="flex items-center gap-3 text-foreground">
        <div className="avatar-container flex h-14 w-14 items-center justify-center">
          <UserCircle2 className="h-7 w-7 text-foreground" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">
            Your Principal ID
          </h2>
          <p className="text-sm text-muted-foreground">
            Your unique identity on the network
          </p>
        </div>
      </div>

      <div className="card-neumorphic w-full max-w-xl rounded-2xl p-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Principal ID
        </div>
        <div
          className="break-all rounded-xl bg-background/40 p-4 font-mono text-sm leading-relaxed text-foreground shadow-neumorphic-inset"
          data-ocid="myid.principal_text"
        >
          {principalText ?? "Not signed in"}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          disabled={!principalText}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-smooth disabled:cursor-not-allowed disabled:opacity-50 ${
            copied
              ? "bg-accent-social/20 text-foreground shadow-neumorphic-inset"
              : "button-primary-neon"
          }`}
          data-ocid="myid.copy_button"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy ID
            </>
          )}
        </button>
      </div>

      <p className="max-w-xl text-center text-sm text-muted-foreground">
        Share this ID so partners can send you a request.
      </p>
    </div>
  );
}

export default MyIdTab;
