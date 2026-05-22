# Design Brief

## Tone & Purpose
Behavioral science PWA (Cumulative) — neumorphic dark-charcoal UI for both light and dark themes, emphasizing calm, tactile accountability. Deep charcoal backgrounds across both modes; only the depth of charcoal differs. Crisp white (#FFFFFF) text throughout. Semantic accent colors tied to behavioral states: success (Emerald Green), skip (Ocean Blue). No neon glows, no Electric Blue legacy colors.

## Differentiation
Dual-shadow neumorphic card pattern — convex emboss in raised state, inset shadows in depressed state. Both themes use charcoal-based shadows. Custom inline ScrollWheel component for all time/duration/offset pickers ensures frictionless mobile UX without native OS popups. Premium tactile aesthetic with professional solid accent colors.

## Color Palette

| Token | Value | Purpose |
|-------|-------|----------|
| Background | `#1C1C1E` (dark), `#2C2C2E` (light) | Canvas base |
| Card | `#2C2C2E` (dark), `#3A3A3C` (light) | Embossed surfaces |
| Foreground | `#FFFFFF` | Crisp white text |
| Muted | `rgba(255,255,255,0.6)` | Secondary text |
| Success (Emerald) | `#10B981` | Completion, progress |
| Skip (Ocean) | `#0369A1` | Justifiable skip |
| Lock-In Gold | `#F59E0B` | Lock-In mode accents |
| Social | oklch(0.62 0.18 32) | Partner reactions |
| Missed | oklch(0.42 0.01 264) | Incomplete |
| Destructive | oklch(0.65 0.19 22) | Error / delete |

## Neumorphic Shadow System

| State | Dark | Light |
|-------|------|-------|
| Embossed | `-4px -4px 10px rgba(60,60,65,0.4), 6px 6px 14px rgba(0,0,0,0.8)` | `-4px -4px 10px rgba(80,80,85,0.5), 6px 6px 14px rgba(0,0,0,0.7)` |
| Inset | `inset 4px 4px 8px rgba(0,0,0,0.7), inset -3px -3px 7px rgba(80,80,85,0.2)` | `inset 4px 4px 8px rgba(0,0,0,0.55), inset -3px -3px 7px rgba(80,80,85,0.3)` |

## Typography
- **Display**: Bricolage Grotesque — geometric, bold, intentional
- **Body**: General Sans — clean, contemporary, high legibility
- **Mono**: JetBrains Mono — fixed-width data/code (ScrollWheel time values)
- **Scale**: sm (12px), base (14px), lg (16px), xl (18px), 2xl (20px)

## Structural Zones

| Zone | Background | Style | Purpose |
|------|-----------|-------|----------|
| Header | Card | Deep shadow bottom | Fixed nav; greeting + progress ring |
| Content | Background | — | Dashboard, WOOP, Partner Feed |
| Bottom Tab | Card | Raised neumorphic buttons | Today / Partner / Analytics |
| Modal/Sheet | Popover | Neumorphic card | Goal creation, obstacles |
| ScrollWheel | Card | Inset neumorphic shadow | Time/duration/offset picker |

## ScrollWheel Component Spec
**Purpose**: Inline touch-friendly time/duration/offset picker. No native OS popups. Used in WOOP wizard Steps 1 & 4, Edit Habit page.

| Property | Specification |
|----------|---------------|
| Container | `oklch(var(--card))` background, inset neumorphic shadow, 3 items tall |
| Center band | Frosted overlay: Emerald Green `rgba(16,185,129,0.15)` (normal), Amber `rgba(245,158,11,0.15)` (Lock-In) |
| Typography | JetBrains Mono, white text, opacity: far (0.35), adjacent (0.65), selected (1.0) |
| Item height | 2.5rem per item (40px total height for 3 items) |
| Interaction | Touch drag + momentum, mouse drag, arrow keys (↑↓), looping at min/max |
| Accessibility | Keyboard nav, aria-valuenow, screen reader labels |
| Animation | Snap-to-item on release: `cubic-bezier(0.34, 1.56, 0.64, 1)` over 250ms |
| Ranges | Hours: 0–23 (loop), Minutes: 0–59 (loop), Offset: ±60 min (5-min steps, capped by intent time) |
| Constraint | Normal: intentTime + offset ≤ 23:55; Lock-In: offset ≤ 0 (before start only) |

## Interaction Model
- **Dashboard**: Dual-swipe (right = Emerald Green success, left = Ocean Blue skip + WOOP sheet)
- **Card locked**: Inset shadow + 4px solid accent border-left; no further swipe
- **Hold-to-undo**: 150ms delay → 1200ms white SVG trace → unlock on completion
- **Touch mechanics**: `touch-action: pan-y` + axis-lock (12px threshold); snap-back on cancel

## Component Patterns
- **Button Primary**: `bg-primary` (Emerald Green), primary-foreground text
- **Card**: Neumorphic embossed, goal state + gesture surface
- **Input (Neumorphic)**: Inset shadow; focus ring Emerald Green; white placeholder
- **Chip Toggle**: Neumorphic emboss; active = Emerald Green border + text
- **Progress Ring**: SVG ring, Emerald Green stroke
- **ScrollWheel**: Inline drum picker, touch/keyboard/mouse, snap-to-item animation

## Motion & Animation
- **Transition Default**: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` — smooth, non-intrusive
- **ScrollWheel snap**: `cubic-bezier(0.34, 1.56, 0.64, 1)` over 250ms — elastic settle
- **Constraint**: Max 400ms animations; no bounce; respect `prefers-reduced-motion`

## Spacing & Rhythm
- **Grid**: 4px baseline; card padding ~22px; gap 1.5rem (24px)
- **ScrollWheel**: 2.5rem item height (40px), 3 items visible (120px total)
- **Density**: Low (calm UI); generous whitespace
- **Container Max**: Full-width on mobile

## Constraints
- **No hardcoded hex/rgb outside accents** — all structure via CSS custom properties
- **No off-white light theme** — both deep charcoal; light = medium charcoal
- **No neon glows** — solid accent borders only
- **No Electric Blue** — removed entirely; Emerald Green + Ocean Blue only
- **No arbitrary Tailwind colors** — semantic token classes exclusively
- **No native time pickers** — custom ScrollWheel only; keeps user on page
- **PWA-first** — responsive mobile-first; installable Web App Manifest
