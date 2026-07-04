import { cn } from "@/lib/utils";

export const VALID_ARCHETYPES = [
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
] as const;

export type Archetype = (typeof VALID_ARCHETYPES)[number];

function isValidArchetype(value: string): value is Archetype {
  return VALID_ARCHETYPES.includes(value as Archetype);
}

interface ArchetypeAvatarProps {
  archetype: string;
  size?: number;
  className?: string;
  showFallback?: boolean;
}

// ─── Inline SVG archetype icons ───────────────────────────────────────────────
// Each icon is a distinct geometric / nature-inspired design in emerald accent.

function OakIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 22V14M12 14C8 14 5 11 5 7C5 4 8 2 12 2C16 2 19 4 19 7C19 11 16 14 12 14Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 14C10 12 9 10 9 8M12 14C14 12 15 10 15 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

function RiverIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8C6 8 6 12 9 12C12 12 12 8 15 8C18 8 18 12 21 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 14C6 14 6 18 9 18C12 18 12 14 15 14C18 14 18 18 21 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>
  );
}

function WolfIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 4L8 8L6 6L4 10L6 14L8 12L10 16L12 14L14 16L16 12L18 14L20 10L18 6L16 8L12 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function OwlIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 4C8 4 5 7 5 11V16C5 18 8 20 12 20C16 20 19 18 19 16V11C19 7 16 4 12 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="15" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="11" r="0.8" fill="currentColor" />
      <circle cx="15" cy="11" r="0.8" fill="currentColor" />
      <path
        d="M12 14V16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MountainIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 18L10 8L14 14L18 6L20 18H4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 8L6 18"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

function FireIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 22C16 22 19 18 19 13C19 9 17 6 14 4C14 7 12 9 12 9C12 9 10 7 10 4C7 6 5 9 5 13C5 18 8 22 12 22Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 18C13.5 18 14.5 16.5 14.5 14.5C14.5 12.5 13 11 12 11C11 11 9.5 12.5 9.5 14.5C9.5 16.5 10.5 18 12 18Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>
  );
}

function BambooIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 22V4M14 22V4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10 8H7M10 14H7M14 10H17M14 16H17"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M10 4C10 2 12 2 12 2C12 2 14 2 14 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HoneycombIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 4L16 6.5V11.5L12 14L8 11.5V6.5L12 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 11.5L4 14V19L8 21.5L12 19L16 21.5L20 19V14L16 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 14V19"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

function WindIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 10H16C18 10 19 9 19 7.5C19 6 18 5 16.5 5C15 5 14 6 14 7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 14H12C14 14 15 15 15 16.5C15 18 14 19 12.5 19C11 19 10 18 10 16.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 18H8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TideIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 12C5 10 7 10 9 12C11 14 13 14 15 12C17 10 19 10 21 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 16C5 14 7 14 9 16C11 18 13 18 15 16C17 14 19 14 21 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      <path
        d="M3 8C5 6 7 6 9 8C11 10 13 10 15 8C17 6 19 6 21 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
      />
    </svg>
  );
}

function FallbackIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
      />
      <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6 18C6 15 9 14 12 14C15 14 18 15 18 18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ARCHETYPE_ICONS: Record<
  Archetype,
  React.ComponentType<{ size: number }>
> = {
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

export function ArchetypeAvatar({
  archetype,
  size = 40,
  className,
  showFallback = true,
}: ArchetypeAvatarProps) {
  const normalized = archetype?.trim() ?? "";
  const valid = isValidArchetype(normalized);
  const Icon = valid ? ARCHETYPE_ICONS[normalized as Archetype] : null;

  if (!valid && !showFallback) return null;

  const iconSize = Math.round(size * 0.55);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full flex-shrink-0 select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: "oklch(0.22 0.01 260)",
        boxShadow:
          "inset 2px 2px 4px oklch(0.15 0.01 260), inset -2px -2px 4px oklch(0.28 0.01 260)",
        color: "oklch(var(--color-accent-success))",
      }}
      aria-label={valid ? `${normalized} archetype` : "Default avatar"}
      role="img"
    >
      {Icon ? <Icon size={iconSize} /> : <FallbackIcon size={iconSize} />}
    </div>
  );
}
