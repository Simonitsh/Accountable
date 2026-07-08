import type { JSX } from "react";

/**
 * Five inline SVG geometric shape components for the avatar system.
 * Modeled after the goalIcons pattern: stroke-based, viewBox 0 0 24 24,
 * role="presentation" (decorative — aria-label lives on the parent Avatar).
 *
 * Each shape uses `fill="currentColor"` so the parent Avatar can tint the
 * inner shape via the avatarColor token while keeping the container neutral.
 *
 * Per user instructions, avatarShape is restricted to exactly five values:
 * Triangle, Square, Pentagon, Hexagon, Star.
 */

export type AvatarShapeId =
  | "Triangle"
  | "Square"
  | "Pentagon"
  | "Hexagon"
  | "Star";

/**
 * Sentinel id for the "No Shape" avatar option. Kept separate from
 * AVATAR_SHAPE_IDS so it does NOT feed renderAvatarShape (which would break
 * the shape grid). The EditAvatarPage renders a dedicated button for this id
 * that clears the shape state to null.
 */
export const AVATAR_NO_SHAPE_ID = "NoShape" as const;

export const AVATAR_NO_SHAPE_LABEL = "No Shape";

export const AVATAR_SHAPE_IDS: AvatarShapeId[] = [
  "Triangle",
  "Square",
  "Pentagon",
  "Hexagon",
  "Star",
];

export const AVATAR_SHAPE_LABELS: Record<AvatarShapeId, string> = {
  Triangle: "Triangle",
  Square: "Square",
  Pentagon: "Pentagon",
  Hexagon: "Hexagon",
  Star: "Star",
};

const baseSvgProps = {
  role: "presentation",
  viewBox: "0 0 24 24",
  fill: "currentColor",
  stroke: "none",
  "aria-hidden": true,
  focusable: false,
} as const;

export function TriangleShape(): JSX.Element {
  return (
    <svg {...baseSvgProps}>
      <title>Triangle avatar shape</title>
      <path d="M12 3 L21 20 L3 20 Z" />
    </svg>
  );
}

export function SquareShape(): JSX.Element {
  return (
    <svg {...baseSvgProps}>
      <title>Square avatar shape</title>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
    </svg>
  );
}

export function PentagonShape(): JSX.Element {
  return (
    <svg {...baseSvgProps}>
      <title>Pentagon avatar shape</title>
      <path d="M12 3 L21 9.5 L17.5 20 L6.5 20 L3 9.5 Z" />
    </svg>
  );
}

export function HexagonShape(): JSX.Element {
  return (
    <svg {...baseSvgProps}>
      <title>Hexagon avatar shape</title>
      <path d="M7 3 L17 3 L22 12 L17 21 L7 21 L2 12 Z" />
    </svg>
  );
}

export function StarShape(): JSX.Element {
  return (
    <svg {...baseSvgProps}>
      <title>Star avatar shape</title>
      <path d="M12 2 L14.6 8.6 L21.8 9.2 L16.3 13.9 L18 21 L12 17.3 L6 21 L7.7 13.9 L2.2 9.2 L9.4 8.6 Z" />
    </svg>
  );
}

const SHAPE_COMPONENTS: Record<AvatarShapeId, () => JSX.Element> = {
  Triangle: TriangleShape,
  Square: SquareShape,
  Pentagon: PentagonShape,
  Hexagon: HexagonShape,
  Star: StarShape,
};

/** Render the SVG for a given shape id. Returns null for unknown shapes. */
export function renderAvatarShape(
  shape: AvatarShapeId | null | undefined,
): JSX.Element | null {
  if (!shape) return null;
  const Comp = SHAPE_COMPONENTS[shape];
  return Comp ? <Comp /> : null;
}
