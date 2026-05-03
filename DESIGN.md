# Design Brief

## Tone & Purpose
Behavioral science PWA (Cumulative) — neumorphic dark-charcoal UI for both light and dark themes, emphasizing calm, tactile accountability. Deep charcoal backgrounds across both modes; only the depth of charcoal differs. Crisp white (#FFFFFF) text throughout. Semantic accent colors tied to behavioral states: success (Emerald Green), skip (Ocean Blue). No neon glows, no Electric Blue legacy colors.

## Differentiation
Dual-shadow neumorphic card pattern — convex emboss (top-left highlight + bottom-right shadow) in the raised state, inset shadows in the depressed/locked state. Both themes use charcoal-based shadows; light charcoal mode uses slightly softer shadows than deep charcoal mode. Tactile, premium aesthetic with professional solid accent colors (not glows).

## Color Palette

| Token | Light Charcoal | Deep Charcoal | Purpose |
|-------|---------------|---------------|---------|
| Background | `#2C2C2E` (~oklch 0.22) | `#1C1C1E` (~oklch 0.14) | Page / canvas base |
| Card | `#3A3A3C` (~oklch 0.27) | `#2C2C2E` (~oklch 0.18) | Embossed card surfaces |
| Foreground | `#FFFFFF` (oklch 0.99) | `#FFFFFF` (oklch 0.99) | Crisp white text on charcoal |
| Muted foreground | `rgba(255,255,255,0.6)` | `rgba(255,255,255,0.6)` | Secondary / hint text |
| Success | `#10B981` Emerald Green | `#10B981` Emerald Green | Keystone completion, progress ring |
| Skip | `#0369A1` Ocean Blue | `#0369A1` Ocean Blue | Justifiable skip action |
| Social | oklch(0.62 0.18 32) coral | oklch(0.62 0.18 32) coral | Partner interactions |
| Missed | oklch(0.42 0.01 264) | oklch(0.42 0.01 264) | Incomplete goals |
| Destructive | oklch(0.65 0.19 22) | oklch(0.65 0.19 22) | Delete / error |

## Neumorphic Shadow System

| State | Light Charcoal | Deep Charcoal |
|-------|---------------|---------------|
| Embossed (raised) | `-4px -4px 10px rgba(80,80,85,0.5), 6px 6px 14px rgba(0,0,0,0.7)` | `-4px -4px 10px rgba(60,60,65,0.4), 6px 6px 14px rgba(0,0,0,0.8)` |
| Inset (depressed) | `inset 4px 4px 8px rgba(0,0,0,0.55), inset -3px -3px 7px rgba(80,80,85,0.3)` | `inset 4px 4px 8px rgba(0,0,0,0.7), inset -3px -3px 7px rgba(80,80,85,0.2)` |
| Trace color | `#FFFFFF` | `#FFFFFF` |

## Typography
- **Display**: Bricolage Grotesque — geometric, bold, intentional
- **Body**: General Sans — clean, contemporary, high legibility
- **Mono**: JetBrains Mono — data/code rendering, fixed-width emphasis
- **Scale**: sm (12px), base (14px), lg (16px), xl (18px), 2xl (20px)

## Structural Zones

| Zone | Background | Style | Purpose |
|------|-----------|-------|---------|
| Header | Card color (charcoal) | Deep shadow bottom | Fixed top nav; greeting + progress ring |
| Content | Background (deeper charcoal) | — | Dashboard, WOOP wizard, Partner Feed |
| Bottom Tab Bar | Card color | Raised neumorphic buttons | Today / Partner Feed / Analytics |
| Modal/Sheet | Popover color | Neumorphic card | Goal creation, obstacle selection |
| Sidebar/Drawer | Card color | Border-right subtle | Profile, settings, connections |

## Interaction Model (Dashboard)
- **Dual-swipe**: Right = Emerald Green success lock; Left = Ocean Blue skip + WOOP obstacle sheet
- **Swipe hint**: `rgba(255,255,255,0.5)` muted white text, hidden permanently after first swipe
- **Card locked**: Inset shadow + 4px solid accent border-left
- **Hold-to-undo**: 150ms delay → 1200ms white SVG trace around perimeter → unlock on completion
- **Swipe mechanics**: `touch-action: none` + `setPointerCapture` + `e.preventDefault()` on pointermove; 60px threshold

## Component Patterns
- **Button Primary**: `bg-primary` (Emerald Green), primary-foreground text
- **Button Secondary**: Mid-charcoal background (#3A3A3C), white text
- **Card**: Neumorphic embossed charcoal, holds goal state + gesture surface
- **Input (Neumorphic)**: Inset shadow; focus ring Emerald Green; placeholder white/50
- **Chip Toggle**: Neumorphic emboss; active = Emerald Green border + text
- **Progress Ring**: SVG ring, Emerald Green stroke, crisp center fraction label

## Motion & Animation
- **Transition Default**: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` — smooth, non-intrusive
- **Drag**: Synchronous with pointer position; no spring on drag, spring snap back on release
- **Constraint**: No animations longer than 400ms; no bounce; respect `prefers-reduced-motion`

## Spacing & Rhythm
- **Grid**: 4px baseline; card padding ~22px; gap between cards 1.5rem (24px)
- **Density**: Low (calm UI); generous whitespace
- **Container Max**: Full-width on mobile

## Constraints
- **No hardcoded hex/rgb outside accents** — all structure colors via CSS custom properties
- **No off-white light theme** — both modes are deep charcoal; light = medium charcoal, dark = deep charcoal
- **No neon glows** — solid accent borders only for state indicators
- **No Electric Blue (#0EA5FF)** — removed entirely; only Emerald Green + Ocean Blue remain
- **No arbitrary Tailwind colors** — use semantic token classes only
- **PWA-first** — responsive mobile-first; installable Web App Manifest
