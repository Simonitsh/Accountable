# Design Brief

## Tone & Purpose
Behavioral science PWA (Cumulative) — neumorphic dark UI emphasizing calm, tactile accountability. Deep charcoal background, embossed matte-black cards, soft dual-shadow depth. No loud animations, no direct messaging. Semantic accent colors tied to behavioral states: success (mint), skip (cyan), social (coral), missed (slate).

## Differentiation
Dual-shadow neumorphic card pattern (convex top-left emboss + concave bottom-right inset). Glowing neon drop-shadows on interactive elements keyed to semantic accent variables. Tactile, muted aesthetic without generic tech defaults.

## Color Palette (OKLCH)

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| Background | `0.98 0 0` | `0.12 0 0` | Page/canvas base |
| Foreground | `0.15 0 0` | `0.95 0 0` | Text/primary content |
| Card | `0.95 0 0` | `0.16 0 0` | Embossed surfaces |
| Success (Cyber Mint) | `0.72 0.18 180` | `0.72 0.18 180` | Keystone completion; glow |
| Skip (Electric Cyan) | `0.68 0.20 200` | `0.68 0.20 200` | Justifiable skip; glow |
| Social (Sunset Coral) | `0.62 0.18 32` | `0.62 0.18 32` | Partner interactions |
| Missed (Muted Slate) | `0.50 0.05 260` | `0.50 0.05 260` | Incomplete goals |
| Destructive | `0.55 0.22 25` | `0.65 0.19 22` | Delete/error states |
| Border | `0.88 0 0` | `0.22 0 0` | Subtle dividers |
| Muted | `0.80 0 0` | `0.20 0 0` | Secondary text, disabled |

## Typography
- **Display**: Bricolage Grotesque — geometric, bold, intentional
- **Body**: General Sans — clean, contemporary, high legibility
- **Mono**: JetBrains Mono — data/code rendering, fixed-width emphasis
- **Scale**: sm (12px), base (14px), lg (16px), xl (18px), 2xl (20px)

## Elevation & Depth
- **Embossed Cards** (`.card-neumorphic`): `-2px -2px 6px rgba(255,255,255,0.08), 2px 2px 6px rgba(0,0,0,0.4)` (light mode); dark mode increases alpha
- **Glowing Neon** (interactive elements): `0 0 16px 2px` colored glow (success/skip/social/missed) on hover/active
- **No sharp shadows**: all shadows use soft blur; depth is achieved through layered emboss + glow interplay

## Structural Zones

| Zone | Background | Style | Purpose |
|------|----------|-------|---------|
| Header | Card color | Border-bottom subtle | Fixed top nav; hamburger menu |
| Content | Background | — | Main dashboard, WOOP wizard, Partner Feed |
| Bottom Tab Bar | Card color | Rounded buttons; glowing icons | Today / Partner Feed / Analytics |
| Modal/Sheet | Popover color | Centered on background; neumorphic | Goal creation, obstacle selection |
| Sidebar/Drawer | Card color | Border-right subtle | Profile, settings, connections |

## Component Patterns
- **Button Primary**: Mint glow on hover; one-tap success confirmation
- **Button Secondary**: Cyan glow on hover; skip/alternative action
- **Button Social**: Coral highlight; Partner Feed interaction (High-Five)
- **Card**: Neumorphic emboss; holds goal state, check-in form, connection request
- **Bottom Tab Bar**: Fixed, three icon buttons; active state uses semantic color glow
- **Modal Overlay**: Dark semi-transparent backdrop; card-based modal center-aligned

## Motion & Animation
- **Transition Default**: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` — smooth, non-intrusive
- **Glow Entry**: Shadow glow fades in on hover/focus (no bounce, no scale)
- **Constraint**: No animations longer than 400ms; no bounce/spring physics

## Spacing & Rhythm
- **Grid**: 4px baseline; card padding 16px–24px; gap 12px–16px
- **Density**: Low (calm UI); generous whitespace around focal interactive elements
- **Container Max**: 1400px (wide screens); full-width on mobile

## Constraints
- **No hardcoded hex/rgb/hsl colors** — all colors via `--color-accent-*` or standard token CSS vars
- **No arbitrary Tailwind colors** — use semantic theme keys only
- **No generic AI defaults** — ban Bootstrap blue (`#3B82F6`), safe greys, rainbow palettes
- **No bounce/scale animations** — respect calm, psychological-safety design
- **PWA-first** — responsive mobile-first; installable Web App Manifest + Service Worker

## Signature Detail
Neumorphic dual-shadow interplay: embossed top-left lightness meets inset bottom-right darkness. Glowing neon accents on interactive elements. Together, these create a tactile, embossed-leather aesthetic — premium, calm, intentional.

## Accent Color CSS Variables (Semantic)
- `--color-accent-success`: Used for Keystone Habit completion, progress, affirmation
- `--color-accent-skip`: Used for Justifiable Skip action, alternative path
- `--color-accent-social`: Used for Partner Feed interactions, connection requests, high-fives
- `--color-accent-missed`: Used for incomplete goals, obstacles, warnings
