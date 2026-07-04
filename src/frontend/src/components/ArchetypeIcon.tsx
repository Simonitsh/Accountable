import { cn } from "@/lib/utils";

// ─── ArchetypeIcon ─────────────────────────────────────────────────────────────
// 10 inline React SVG icon components for the archetypes.
// Minimalist line-art / flat vector style suitable for deep charcoal/grey
// neumorphic theme. Each accepts className and size props.
// ──────────────────────────────────────────────────────────────────────────────

export type ArchetypeName =
  | "Oak"
  | "River"
  | "Wolf"
  | "Owl"
  | "Mountain"
  | "Fire"
  | "Bamboo"
  | "Honeycomb"
  | "Wind"
  | "Tide";

export const ARCHETYPE_NAMES: ArchetypeName[] = [
  "Oak",
  "River",
  "Wolf",
  "Owl",
  "Mountain",
  "Fire",
  "Bamboo",
  "Honeycomb",
  "Wind",
  "Tide",
];

interface IconProps {
  className?: string;
  size?: number;
}

export function OakIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3C8 3 5 6 5 9C5 12 7 14 9 15C7 16 6 18 6 20H18C18 18 17 16 15 15C17 14 19 12 19 9C19 6 16 3 12 3Z" />
      <path d="M12 15V21" />
    </svg>
  );
}

export function RiverIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12C5 10 7 14 9 12C11 10 13 14 15 12C17 10 19 14 21 12" />
      <path d="M3 16C5 14 7 18 9 16C11 14 13 18 15 16C17 14 19 18 21 16" />
      <path d="M3 8C5 6 7 10 9 8C11 6 13 10 15 8C17 6 19 10 21 8" />
    </svg>
  );
}

export function WolfIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 8L3 5L5 12L8 14L10 18L14 18L16 14L19 12L21 5L18 8L16 6L14 8L12 6L10 8L8 6L6 8Z" />
      <circle cx="9" cy="11" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function OwlIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="12" cy="13" rx="7" ry="6" />
      <circle cx="9" cy="12" r="2.5" />
      <circle cx="15" cy="12" r="2.5" />
      <circle cx="9" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <path d="M12 14.5V16.5" />
      <path d="M5 10L3 7" />
      <path d="M19 10L21 7" />
    </svg>
  );
}

export function MountainIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 20L9 8L13 14L17 6L21 20H3Z" />
      <path d="M9 8L11 4L13 8" />
    </svg>
  );
}

export function FireIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22C16 22 19 18 19 13C19 9 17 6 15 4C14 7 13 9 12 9C11 9 10 7 9 4C7 6 5 9 5 13C5 18 8 22 12 22Z" />
      <path d="M12 18C13.5 18 14.5 16.5 14.5 14.5C14.5 13 13.5 11.5 12 11.5C10.5 11.5 9.5 13 9.5 14.5C9.5 16.5 10.5 18 12 18Z" />
    </svg>
  );
}

export function BambooIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="8" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="16" y2="21" />
      <line x1="5" y1="7" x2="11" y2="7" />
      <line x1="13" y1="11" x2="19" y2="11" />
      <line x1="5" y1="15" x2="11" y2="15" />
      <line x1="13" y1="19" x2="19" y2="19" />
    </svg>
  );
}

export function HoneycombIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2L16 4.5V9.5L12 12L8 9.5V4.5L12 2Z" />
      <path d="M8 9.5L4 12V17L8 19.5L12 17L16 19.5L20 17V12L16 9.5" />
      <path d="M12 12V17" />
      <path d="M8 19.5V22" />
      <path d="M16 19.5V22" />
    </svg>
  );
}

export function WindIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 8H15C16.5 8 17.5 7 17.5 5.5C17.5 4 16.5 3 15 3C13.5 3 12.5 4 12.5 5.5" />
      <path d="M3 12H18C19.5 12 20.5 11 20.5 9.5C20.5 8 19.5 7 18 7" />
      <path d="M3 16H12C13.5 16 14.5 17 14.5 18.5C14.5 20 13.5 21 12 21C10.5 21 9.5 20 9.5 18.5" />
    </svg>
  );
}

export function TideIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12C4 10 6 14 8 12C10 10 12 14 14 12C16 10 18 14 20 12C22 10 24 14 26 12" />
      <path d="M2 16C4 14 6 18 8 16C10 14 12 18 14 16C16 14 18 18 20 16C22 14 24 18 26 16" />
      <path d="M2 8C4 6 6 10 8 8C10 6 12 10 14 8C16 6 18 10 20 8C22 6 24 10 26 8" />
    </svg>
  );
}

// ─── Lookup map ───────────────────────────────────────────────────────────────

const ARCHETYPE_ICON_MAP: Record<ArchetypeName, React.FC<IconProps>> = {
  Oak: OakIcon,
  River: RiverIcon,
  Wolf: WolfIcon,
  Owl: OwlIcon,
  Mountain: MountainIcon,
  Fire: FireIcon,
  Bamboo: BambooIcon,
  Honeycomb: HoneycombIcon,
  Wind: WindIcon,
  Tide: TideIcon,
};

export function getArchetypeIcon(name: ArchetypeName) {
  return ARCHETYPE_ICON_MAP[name];
}

export function ArchetypeIcon({
  name,
  className,
  size = 24,
}: {
  name: ArchetypeName;
  className?: string;
  size?: number;
}) {
  const Icon = ARCHETYPE_ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className} size={size} />;
}
