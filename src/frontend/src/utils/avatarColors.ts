/**
 * Avatar color system — seven approved base colors, basic palette only.
 *
 * Per user instructions:
 *  - avatarColor is restricted to one of seven base palette swatches:
 *    #10B981 (emerald), #0369A1 (ocean), #F59E0B (amber), #8B5CF6 (violet),
 *    #EC4899 (pink), #EF4444 (red), #FDE047 (yellow)
 *  - No RGB fine-tuning / per-channel offsets.
 *  - No file uploads or stored image files for avatars.
 *  - avatarColor applies ONLY to the avatar border ring + inner SVG shape fill
 *    (Fill mode), or to the border ring only with a neutral inner shape
 *    (BorderOnly mode — handled by the Avatar component).
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface AvatarBaseColor {
  id: "emerald" | "ocean" | "amber" | "violet" | "pink" | "red" | "yellow";
  label: string;
  hex: string;
  rgb: RGB;
}

const clamp = (n: number): number => Math.max(0, Math.min(255, n));

const hexToRgb = (hex: string): RGB => {
  const clean = hex.replace("#", "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
};

export const rgbToHex = ({ r, g, b }: RGB): string => {
  const toHex = (n: number) =>
    clamp(Math.round(n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/** Seven approved base colors. */
export const AVATAR_BASE_COLORS: AvatarBaseColor[] = [
  { id: "emerald", label: "Emerald", hex: "#10B981", rgb: hexToRgb("#10B981") },
  { id: "ocean", label: "Ocean", hex: "#0369A1", rgb: hexToRgb("#0369A1") },
  { id: "amber", label: "Amber", hex: "#F59E0B", rgb: hexToRgb("#F59E0B") },
  { id: "violet", label: "Violet", hex: "#8B5CF6", rgb: hexToRgb("#8B5CF6") },
  { id: "pink", label: "Pink", hex: "#EC4899", rgb: hexToRgb("#EC4899") },
  { id: "red", label: "Red", hex: "#EF4444", rgb: hexToRgb("#EF4444") },
  { id: "yellow", label: "Yellow", hex: "#FDE047", rgb: hexToRgb("#FDE047") },
];

export const AVATAR_BASE_COLOR_IDS = AVATAR_BASE_COLORS.map((c) => c.id);

/**
 * Given a candidate hex color, find the nearest base color by Euclidean RGB distance.
 * Returns null if the candidate is empty/invalid.
 */
export function findNearestBaseColor(
  hex: string | null | undefined,
): AvatarBaseColor | null {
  if (!hex || !hex.trim()) return null;
  const candidate = hexToRgb(hex);
  let nearest = AVATAR_BASE_COLORS[0];
  let nearestDist = Number.POSITIVE_INFINITY;
  for (const base of AVATAR_BASE_COLORS) {
    const dr = candidate.r - base.rgb.r;
    const dg = candidate.g - base.rgb.g;
    const db = candidate.b - base.rgb.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = base;
    }
  }
  return nearest;
}

/**
 * Returns the exact base palette swatch hex for the given base color id.
 * No per-channel offset adjustment — basic palette only.
 */
export function buildAvatarColor(baseId: AvatarBaseColor["id"]): string {
  const base =
    AVATAR_BASE_COLORS.find((c) => c.id === baseId) ?? AVATAR_BASE_COLORS[0];
  return base.hex;
}

/**
 * Sanitize an arbitrary hex string into a valid avatar color.
 *
 * With the basic-palette-only system, any incoming color (including
 * previously-saved offset-derived colors) is mapped to the nearest base
 * palette swatch. Returns null for empty/invalid input.
 */
export function sanitizeAvatarColor(
  hex: string | null | undefined,
): string | null {
  if (!hex || !hex.trim()) return null;
  const trimmed = hex.trim();
  // Accept #rgb or #rrggbb; anything else snaps to nearest base.
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return findNearestBaseColor(trimmed)?.hex ?? null;
  }
  // Map any incoming color (including previously-saved offset-derived colors)
  // to the nearest base palette swatch.
  return findNearestBaseColor(trimmed)?.hex ?? null;
}
