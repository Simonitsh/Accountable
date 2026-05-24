# Design Brief

## Tone & Purpose
Behavioral science PWA (Cumulative) — neumorphic dark-charcoal UI for both light and dark themes, emphasizing calm, tactile accountability. Deep charcoal backgrounds across both modes; only the depth of charcoal differs. Crisp white (#FFFFFF) text throughout. Semantic accent colors tied to behavioral states: success (Emerald Green #10B981), skip (Ocean Blue #0369A1), Lock-In premium (Gold/Amber #D4AF37). No neon glows, no Electric Blue legacy colors.

## Differentiation
Dual-shadow neumorphic card pattern — convex emboss (top-left highlight + bottom-right shadow) in the raised state, inset shadows in the depressed/locked state. Both themes use charcoal-based shadows; light charcoal mode uses slightly softer shadows than deep charcoal mode. Unified custom scroll wheel picker with theme-aware highlight bands (Emerald Green for regular habits, Gold for Lock-In). Intentional habit type selection via two large side-by-side tile cards with raised default → inset-selected state transitions. Premium, tactile, professional aesthetic.

## Color Palette

| Token | Light Charcoal | Deep Charcoal | Purpose |
|-------|---------------|---------------|----------|
| Background | `#2C2C2E` (~oklch 0.22) | `#1C1C1E` (~oklch 0.14) | Page / canvas base |
| Card | `#3A3A3C` (~oklch 0.27) | `#2C2C2E` (~oklch 0.18) | Embossed card surfaces |
| Foreground | `#FFFFFF` (oklch 0.99) | `#FFFFFF` (oklch 0.99) | Crisp white text on charcoal |
| Muted foreground | `rgba(255,255,255,0.6)` | `rgba(255,255,255,0.6)` | Secondary / hint text |
| Success | `#10B981` Emerald Green | `#10B981` Emerald Green | Keystone completion, scroll wheel highlight |
| Skip | `#0369A1` Ocean Blue | `#0369A1` Ocean Blue | Justifiable skip action |
| Lock-In | `#D4AF37` Gold/Amber | `#D4AF37` Gold/Amber | Premium habit type, scroll wheel highlight |
| Social | oklch(0.62 0.18 32) coral | oklch(0.62 0.18 32) coral | Partner interactions |
| Missed | oklch(0.42 0.01 264) | oklch(0.42 0.01 264) | Incomplete goals |
| Destructive | oklch(0.65 0.19 22) | oklch(0.65 0.19 22) | Delete / error |

## Neumorphic Shadow System

| State | Light Charcoal | Deep Charcoal |
|-------|---------------|---------------|
| Embossed (raised) | `-4px -4px 10px rgba(80,80,85,0.5), 6px 6px 14px rgba(0,0,0,0.7)` | `-4px -4px 10px rgba(60,60,65,0.4), 6px 6px 14px rgba(0,0,0,0.8)` |
| Inset (depressed/selected) | `inset 4px 4px 8px rgba(0,0,0,0.55), inset -3px -3px 7px rgba(80,80,85,0.3)` | `inset 4px 4px 8px rgba(0,0,0,0.7), inset -3px -3px 7px rgba(80,80,85,0.2)` |
| Trace color | `#FFFFFF` | `#FFFFFF` |

## Typography
- **Display**: Bricolage Grotesque — geometric, bold, intentional
- **Body**: General Sans — clean, contemporary, high legibility
- **Mono**: JetBrains Mono — data/code rendering, scroll wheel values
- **Scale**: sm (12px), base (14px), lg (16px), xl (18px), 2xl (20px)

## Custom Components

### Scroll Wheel Picker (`.scroll-wheel-track`)
Inline drum-style vertical scroller. Base class has h-32, overflow-y-auto, snap-scroll center, dark inset container. Variants: `.scroll-wheel-track--green` (Emerald highlight band for regular habits), `.scroll-wheel-track--gold` (Gold highlight band for Lock-In habits). Center highlight band shows selected value with semi-transparent accent overlay. No native popups, touch/mouse drag support.

### Habit Type Tile (`.habit-type-tile`)
Two large side-by-side cards (flex-1 each) for Regular vs Lock-In selection. Default: raised embossed state with subtle shadow. Selected: inset-pressed shadow, accent border (green or gold), colored text. `.habit-type-tile--green` (Regular, default-selected), `.habit-type-tile--gold` (Lock-In). Min-height 140px, generous padding, centered content.

## Structural Zones

| Zone | Background | Style | Purpose |
|------|-----------|-------|----------|
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
- **Scroll Wheel**: Dark inset track, monospace text, snap-scroll center, theme-aware highlight
- **Habit Type Tile**: Neumorphic emboss, raised default, inset-selected, accent borders

## Motion & Animation
- **Transition Default**: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` — smooth, non-intrusive
- **Scroll Wheel**: Snap-to-item on drag release, smooth scroll deceleration
- **Tile Selection**: Press animation 110ms → sheet slides in 300ms, no overshoot
- **Constraint**: No animations longer than 400ms; no bounce; respect `prefers-reduced-motion`

## Spacing & Rhythm
- **Grid**: 4px baseline; card padding ~22px; gap between cards 1.5rem (24px); tile gaps 1rem (16px)
- **Density**: Low (calm UI); generous whitespace
- **Container Max**: Full-width on mobile

## Constraints
- **No hardcoded hex/rgb outside accents** — all structure colors via CSS custom properties
- **No off-white light theme** — both modes are deep charcoal; light = medium charcoal, dark = deep charcoal
- **No neon glows** — solid accent borders only for state indicators
- **No Electric Blue (#0EA5FF)** — removed entirely; only Emerald Green + Ocean Blue remain
- **No arbitrary Tailwind colors** — use semantic token classes only
- **PWA-first** — responsive mobile-first; installable Web App Manifest
