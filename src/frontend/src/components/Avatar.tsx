import type { JSX } from "react";
import type { AvatarColorMode } from "../types";
import { sanitizeAvatarColor } from "../utils/avatarColors";
import { type AvatarShapeId, renderAvatarShape } from "./AvatarShapes";

/**
 * Shared Avatar component.
 *
 * Per user instructions:
 *  - Container is ALWAYS a circle with neutral background (never tinted by avatarColor).
 *  - When avatarShape and avatarColor are null, render the first letter of the
 *    user's username in white text on the neutral circle.
 *  - When avatarShape is null but avatarColor is set ("No Shape" + color), the
 *    username initial is rendered as a SOLID COLORED LETTER on the neutral
 *    container background — no colored circle or badge around it. In Fill mode
 *    the letter takes the avatarColor; in BorderOnly mode the letter stays
 *    neutral and only the container border is colored.
 *  - colorMode 'Fill' (default): avatarColor applies to BOTH the circular border
 *    ring AND the inner geometric shape (or the initial letter when no shape).
 *  - colorMode 'BorderOnly': avatarColor applies to the circular border ring ONLY;
 *    the inner shape (or initial letter) renders in a neutral white/light-gray.
 *  - The component falls back to the username initial when no shape is chosen,
 *    regardless of color mode.
 *  - Accept a `size` prop so the same component works in header, profile, and feed.
 *
 * The `.avatar-container` class (index.css) provides the neutral circle, neumorphic
 * inset shadow, and transparent default border. We override the border-color inline
 * with the sanitized avatarColor when present.
 *
 * `avatarShape` accepts either the local `AvatarShapeId` union or the backend's
 * `Variant_Star_Pentagon_Triangle_Hexagon_Square` enum — both share the same string
 * values ("Triangle" | "Square" | "Pentagon" | "Hexagon" | "Star").
 */

export type AvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 64,
  xl: 120,
};

const INITIAL_FONT_PX: Record<AvatarSize, number> = {
  sm: 13,
  md: 16,
  lg: 26,
  xl: 48,
};

const SHAPE_INSET_PX: Record<AvatarSize, number> = {
  sm: 7,
  md: 9,
  lg: 14,
  xl: 26,
};

export interface AvatarProps {
  /** Username — used for the default initial when shape/color are null. */
  username: string;
  /** Geometric shape variant (Triangle/Square/Pentagon/Hexagon/Star) or null. */
  avatarShape?: AvatarShapeId | null;
  /** Hex color string of an approved base palette swatch, or null. */
  avatarColor?: string | null;
  /** How the color is applied. 'Fill' tints border + inner shape; 'BorderOnly' tints only the border ring with a neutral inner shape. */
  colorMode?: AvatarColorMode;
  /** Diameter preset. */
  size?: AvatarSize;
  /** Optional accessible label; defaults to username. */
  alt?: string;
  /** Extra className for the container. */
  className?: string;
}

export function Avatar({
  username,
  avatarShape,
  avatarColor,
  colorMode = "Fill",
  size = "md",
  alt,
  className,
}: AvatarProps): JSX.Element {
  const px = SIZE_PX[size];
  const initialFont = INITIAL_FONT_PX[size];
  const shapeInset = SHAPE_INSET_PX[size];

  const safeColor = sanitizeAvatarColor(avatarColor);
  // Treat the shape as a string id — works for both the local union and the
  // backend enum (whose values are the same strings).
  const shapeId = (
    avatarShape == null ? null : String(avatarShape)
  ) as AvatarShapeId | null;
  const hasCustom = Boolean(shapeId) && Boolean(safeColor);
  // "No Shape" with a color: render the username initial, tinted by the color
  // (Fill) or with a colored container border + neutral letter (BorderOnly).
  const hasColoredInitial = !shapeId && Boolean(safeColor);
  const initial = (username?.trim()?.[0] ?? "?").toUpperCase();
  const label = alt ?? username ?? "User avatar";

  const isBorderOnly = colorMode === "BorderOnly";

  // Container border is colored whenever a safe color is present AND we are
  // rendering something custom (shape OR colored initial).
  const containerStyle =
    hasCustom || hasColoredInitial
      ? { width: px, height: px, borderColor: safeColor ?? undefined }
      : { width: px, height: px };

  // In BorderOnly mode the inner shape uses a neutral fill instead of the
  // selected color. The colored border ring is still applied via containerStyle.
  const shapeColor = hasCustom && isBorderOnly ? undefined : safeColor;
  const shapeClassName = isBorderOnly
    ? "avatar-shape avatar-shape-neutral"
    : "avatar-shape";

  // Initial letter color: in Fill mode with a colored initial, tint the letter.
  // In BorderOnly mode the letter stays neutral (default text color) and only
  // the container border is colored — preserving existing color-mode semantics.
  const initialColor =
    hasColoredInitial && !isBorderOnly ? safeColor : undefined;

  return (
    <div
      className={`avatar-container ${className ?? ""}`}
      style={containerStyle}
      role="img"
      aria-label={label}
      data-ocid="avatar"
    >
      {hasCustom && shapeId ? (
        <div
          className={shapeClassName}
          style={{
            color: shapeColor ?? undefined,
            width: px - shapeInset * 2,
            height: px - shapeInset * 2,
          }}
        >
          {renderAvatarShape(shapeId)}
        </div>
      ) : (
        <span
          className="avatar-default-initial"
          style={{ fontSize: initialFont, color: initialColor ?? undefined }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
