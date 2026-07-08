import type { useBlocker } from "@tanstack/react-router";

/**
 * Reusable "Discard changes?" prompt for unsaved-changes navigation blocking.
 *
 * Renders only when the supplied TanStack Router `blocker` is in the
 * `blocked` state. Wording and actions are identical everywhere this
 * component is used, satisfying the "unsaved-changes prompt must be
 * identical everywhere in the app" requirement.
 *
 * Actions:
 *   - "Keep Editing"  → blocker.reset()   (stay on the page, keep changes)
 *   - "Discard"       → blocker.proceed() (navigate away, lose changes)
 *
 * Pass a unique `ocidPrefix` per page so deterministic markers stay
 * page-scoped (e.g. "edit_profile", "edit_avatar"). Defaults to
 * "unsaved_changes" for any caller that doesn't care.
 */
type Blocker = ReturnType<typeof useBlocker>;
type UnsavedChangesDialogProps = {
  blocker: Blocker;
  /**
   * Short description of what would be lost, shown under the title.
   * Defaults to the profile wording used by EditProfilePage so the
   * prompt is identical across pages unless a caller overrides it.
   */
  description?: string;
  /**
   * Prefix for `data-ocid` markers. Each page should pass its own
   * (e.g. "edit_profile", "edit_avatar") to keep markers page-scoped.
   */
  ocidPrefix?: string;
};

export function UnsavedChangesDialog({
  blocker,
  description = "Your unsaved profile changes will be lost.",
  ocidPrefix = "unsaved_changes",
}: UnsavedChangesDialogProps) {
  if (blocker.status !== "blocked") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      data-ocid={`${ocidPrefix}.discard_dialog`}
    >
      <div
        className="rounded-2xl p-6 mx-6 space-y-4"
        style={{
          background: "oklch(var(--card))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <h3
          className="text-lg font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          Discard changes?
        </h3>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {description}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              blocker.reset();
            }}
            className="flex-1 py-3 rounded-xl font-medium"
            style={{
              background: "var(--muted)",
              color: "var(--foreground)",
            }}
            data-ocid={`${ocidPrefix}.keep_editing_button`}
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={() => {
              blocker.proceed();
            }}
            className="flex-1 py-3 rounded-xl font-medium"
            style={{ background: "#ef4444", color: "#fff" }}
            data-ocid={`${ocidPrefix}.discard_button`}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
