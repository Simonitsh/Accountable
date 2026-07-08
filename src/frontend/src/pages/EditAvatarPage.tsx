import { useBlocker, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "../components/Avatar";
import {
  AVATAR_NO_SHAPE_LABEL,
  AVATAR_SHAPE_IDS,
  AVATAR_SHAPE_LABELS,
  type AvatarShapeId,
  renderAvatarShape,
} from "../components/AvatarShapes";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { useUpdateAvatar, useUserProfile } from "../hooks/useUserProfile";
import type { AvatarColorMode } from "../types";
import {
  AVATAR_BASE_COLORS,
  type AvatarBaseColor,
  buildAvatarColor,
  findNearestBaseColor,
} from "../utils/avatarColors";

const sectionLabel =
  "block text-xs font-mono tracking-widest text-muted-foreground uppercase mb-2";

const insetCard: React.CSSProperties = {
  background: "oklch(var(--card))",
  boxShadow:
    "inset 2px 2px 6px rgba(0,0,0,0.4), inset -2px -2px 6px rgba(255,255,255,0.04)",
  borderRadius: "1rem",
  padding: "1.25rem",
};

const COLOR_MODES: { id: AvatarColorMode; label: string; hint: string }[] = [
  {
    id: "Fill",
    label: "Fill",
    hint: "Color applied to border and inner shape",
  },
  {
    id: "BorderOnly",
    label: "Border Only",
    hint: "Color on the ring only; inner shape stays neutral",
  },
];

export function EditAvatarPage() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useUserProfile();
  const {
    mutateAsync: mutateAvatar,
    isPending,
    isError,
    error,
  } = useUpdateAvatar();

  // Local editor state — seeded once from the profile, then driven by the user.
  const [shape, setShape] = useState<AvatarShapeId | null>(null);
  const [baseId, setBaseId] = useState<AvatarBaseColor["id"] | null>(null);
  const [colorMode, setColorMode] = useState<AvatarColorMode>("Fill");
  const seededRef = useRef(false);

  // Seed from the stored profile on first load.
  useEffect(() => {
    if (!profile || seededRef.current) return;
    seededRef.current = true;
    const seedShape = (profile.avatarShape as AvatarShapeId | null) ?? null;
    const seedColor = profile.avatarColor ?? null;
    setShape(seedShape);
    if (seedShape && seedColor) {
      const nearest = findNearestBaseColor(seedColor);
      setBaseId(nearest ? nearest.id : null);
    } else {
      setBaseId(null);
    }
    const seedMode =
      (profile.avatarColorMode as AvatarColorMode | null) ?? "Fill";
    setColorMode(seedMode);
  }, [profile]);

  // Derived avatar color: whenever a base color is chosen, regardless of shape.
  // This lets a "No Shape" avatar carry a color that tints the username letter.
  const avatarColor = baseId ? buildAvatarColor(baseId) : null;

  // Surface backend errors as a toast (auto-save has no explicit Save button).
  useEffect(() => {
    if (isError && error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save avatar.",
      );
    }
  }, [isError, error]);

  const handleBack = useCallback(() => {
    navigate({ to: "/profile/edit" });
  }, [navigate]);

  const handleSelectShape = useCallback((id: AvatarShapeId) => {
    setShape((prev) => (prev === id ? null : id));
    // Default to emerald so the preview is immediately visible when a shape
    // is picked with no color yet.
    setBaseId((prev) => prev ?? "emerald");
  }, []);

  const handleSelectNoShape = useCallback(() => {
    setShape(null);
  }, []);

  const handleSelectBase = useCallback((base: AvatarBaseColor) => {
    setBaseId((prev) => (prev === base.id ? null : base.id));
  }, []);

  const handleSelectMode = useCallback((mode: AvatarColorMode) => {
    setColorMode(mode);
  }, []);

  const handleReset = useCallback(() => {
    setShape(null);
    setBaseId(null);
    setColorMode("Fill");
  }, []);

  // Dirty flag: true when local state differs from the persisted profile.
  // Reset to false after a successful save.
  const [savedSnapshot, setSavedSnapshot] = useState<{
    shape: AvatarShapeId | null;
    baseId: AvatarBaseColor["id"] | null;
    colorMode: AvatarColorMode;
  } | null>(null);

  const persistedShape = (profile?.avatarShape as AvatarShapeId | null) ?? null;
  const persistedColor = profile?.avatarColor ?? null;
  const persistedBaseId = persistedColor
    ? (findNearestBaseColor(persistedColor)?.id ?? null)
    : null;
  const persistedMode =
    (profile?.avatarColorMode as AvatarColorMode | null) ?? "Fill";

  const referenceShape = savedSnapshot?.shape ?? persistedShape;
  const referenceBaseId = savedSnapshot?.baseId ?? persistedBaseId;
  const referenceMode = savedSnapshot?.colorMode ?? persistedMode;

  const isDirty =
    shape !== referenceShape ||
    baseId !== referenceBaseId ||
    colorMode !== referenceMode;

  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(t);
  }, [justSaved]);

  // Block TanStack Router navigation when there are unsaved changes.
  // justSaved stays false until after mutateAsync succeeds, so the blocker
  // only fires for genuine unsaved-change navigations — matching the
  // EditProfilePage pattern (condition: isDirty && !justSaved).
  const blocker = useBlocker({
    condition: isDirty && !justSaved,
  });

  // Secondary safety net: warn on browser back / tab close when there are
  // unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // After a successful save, navigate back to /profile/edit once isDirty has
  // settled to false. Waiting for isDirty=false guarantees the blocker
  // condition (isDirty && !justSaved) is false before the navigation fires,
  // so the discard prompt never appears on a post-save navigation.
  useEffect(() => {
    if (justSaved && !isDirty) {
      navigate({ to: "/profile/edit" });
    }
  }, [justSaved, isDirty, navigate]);

  const handleSave = useCallback(async () => {
    if (!profile || !isDirty || isPending) return;
    try {
      await mutateAvatar({
        avatarShape: shape,
        avatarColor,
        avatarColorMode: colorMode,
        currentProfile: profile,
      });
      setSavedSnapshot({ shape, baseId, colorMode });
      setJustSaved(true);
      toast.success("Avatar saved.");
    } catch {
      // Error toast is already surfaced by the isError effect below.
    }
  }, [
    profile,
    isDirty,
    isPending,
    mutateAvatar,
    shape,
    avatarColor,
    colorMode,
    baseId,
  ]);

  const hasSelection = Boolean(shape) || Boolean(baseId);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      data-ocid="edit_avatar.page"
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center px-4 py-3 border-b border-border"
        style={{
          background: "oklch(var(--card))",
          boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          className="p-2 rounded-xl mr-2 text-foreground"
          style={{
            boxShadow:
              "3px 3px 8px rgba(0,0,0,0.4), -3px -3px 8px rgba(255,255,255,0.05)",
          }}
          aria-label="Back to edit profile"
          data-ocid="edit_avatar.back_button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center pr-9">
          Edit Avatar
        </h1>
      </div>

      {/* Scrollable content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-32">
        {isLoading ? (
          <div
            className="flex flex-col items-center justify-center py-20 gap-3"
            data-ocid="edit_avatar.loading_state"
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading your avatar…
            </p>
          </div>
        ) : (
          <>
            {/* Preview + status */}
            <div className="space-y-5" style={insetCard}>
              <div className="flex items-center justify-between">
                <h2 className={sectionLabel}>Preview</h2>
                <SaveStatus
                  isPending={isPending}
                  isError={isError}
                  isDirty={isDirty}
                />
              </div>

              <div className="flex flex-col items-center gap-3 py-2">
                <Avatar
                  username={profile?.username ?? ""}
                  avatarShape={shape}
                  avatarColor={avatarColor}
                  colorMode={colorMode}
                  size="lg"
                  alt="Avatar preview"
                />
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  {hasSelection
                    ? "Pick a shape, color, and mode — press Save to keep your changes."
                    : "No avatar selected — your username initial is shown by default."}
                </p>
              </div>
            </div>

            {/* Shape picker */}
            <div className="space-y-3" style={insetCard}>
              <div className="flex items-center justify-between">
                <h2 className={sectionLabel}>Shape</h2>
                {hasSelection && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
                    aria-label="Reset avatar to default"
                    data-ocid="edit_avatar.reset_button"
                  >
                    <RotateCcw size={12} />
                    Reset
                  </button>
                )}
              </div>
              <div
                className="grid grid-cols-5 gap-2"
                data-ocid="edit_avatar.shape_list"
              >
                {/* No Shape option — clears the shape so the username initial
                    is shown (optionally colored by the selected base color). */}
                <button
                  type="button"
                  onClick={handleSelectNoShape}
                  className={`avatar-shape-btn h-14 ${shape === null ? "active" : ""}`}
                  aria-pressed={shape === null}
                  aria-label={AVATAR_NO_SHAPE_LABEL}
                  title={AVATAR_NO_SHAPE_LABEL}
                  data-ocid="edit_avatar.no_shape_button"
                >
                  <span className="text-sm font-semibold text-foreground">
                    Aa
                  </span>
                </button>
                {AVATAR_SHAPE_IDS.map((id, idx) => {
                  const active = shape === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectShape(id)}
                      className={`avatar-shape-btn h-14 ${active ? "active" : ""}`}
                      aria-pressed={active}
                      aria-label={`${AVATAR_SHAPE_LABELS[id]} shape`}
                      data-ocid={`edit_avatar.shape_button.${idx + 1}`}
                    >
                      <span className="w-7 h-7 block">
                        {renderAvatarShape(id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Base color swatches */}
            <div className="space-y-3" style={insetCard}>
              <h2 className={sectionLabel}>Color</h2>
              <div
                className="grid grid-cols-5 gap-2"
                data-ocid="edit_avatar.color_list"
              >
                {AVATAR_BASE_COLORS.map((base, idx) => {
                  const active = baseId === base.id;
                  return (
                    <button
                      key={base.id}
                      type="button"
                      onClick={() => handleSelectBase(base)}
                      className={`avatar-swatch h-12 w-full ${active ? "active" : ""}`}
                      aria-pressed={active}
                      aria-label={`${base.label} base color`}
                      title={base.label}
                      data-ocid={`edit_avatar.color_swatch.${idx + 1}`}
                    >
                      <span
                        className="block rounded-full w-7 h-7 mx-auto"
                        style={{ backgroundColor: base.hex }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color mode selector */}
            <div className="space-y-3" style={insetCard}>
              <h2 className={sectionLabel}>Color Mode</h2>
              <div
                className="grid grid-cols-2 gap-2"
                role="radiogroup"
                aria-label="Avatar color mode"
                data-ocid="edit_avatar.color_mode_list"
              >
                {COLOR_MODES.map((mode) => {
                  const active = colorMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      // biome-ignore lint/a11y/useSemanticElements: custom toggle button with rich label + hint content
                      role="radio"
                      aria-checked={active}
                      onClick={() => handleSelectMode(mode.id)}
                      className={`rounded-xl px-3 py-3 text-left transition-smooth border ${
                        active
                          ? "border-[#10b981] bg-[#10b981]/10"
                          : "border-transparent bg-muted/40 hover:border-border"
                      }`}
                      data-ocid={`edit_avatar.color_mode.${mode.id.toLowerCase()}`}
                    >
                      <span className="block text-sm font-semibold text-foreground">
                        {mode.label}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                        {mode.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky save bar — manual save, disabled when there are no unsaved changes */}
      {!isLoading && (
        <div
          className="sticky bottom-0 z-20 border-t border-border px-4 py-3"
          style={{
            background: "oklch(var(--card))",
            boxShadow: "0 -2px 10px rgba(0,0,0,0.4)",
          }}
        >
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              aria-label="Cancel and go back to edit profile"
              data-ocid="edit_avatar.cancel_button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "oklch(var(--primary))",
                color: "oklch(var(--primary-foreground))",
                boxShadow:
                  "3px 3px 8px rgba(0,0,0,0.4), -3px -3px 8px rgba(255,255,255,0.05)",
              }}
              aria-label="Save avatar changes"
              data-ocid="edit_avatar.save_button"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : justSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : isDirty ? (
                "Save"
              ) : (
                "Saved"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Discard-changes prompt — shared component, identical wording everywhere */}
      <UnsavedChangesDialog
        blocker={blocker}
        ocidPrefix="edit_avatar"
        description="Your unsaved avatar changes will be lost."
      />
    </div>
  );
}

/** Subtle status indicator: shows unsaved / saving / saved / error states. */
function SaveStatus({
  isPending,
  isError,
  isDirty,
}: {
  isPending: boolean;
  isError: boolean;
  isDirty: boolean;
}) {
  if (isPending) {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        data-ocid="edit_avatar.saving_state"
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (isError) {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-destructive"
        data-ocid="edit_avatar.error_state"
      >
        Save failed
      </span>
    );
  }
  if (isDirty) {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        data-ocid="edit_avatar.unsaved_state"
      >
        Unsaved
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      data-ocid="edit_avatar.saved_state"
    >
      <Check className="w-3 h-3" />
      Saved
    </span>
  );
}
