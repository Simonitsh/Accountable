# Design Brief

## Tone & Purpose
Behavioral science PWA (Cumulative) — neumorphic dark-charcoal UI for both light and dark themes, emphasizing calm, tactile accountability. Deep charcoal backgrounds across both modes; only the depth of charcoal differs. Crisp white (#FFFFFF) text throughout. Semantic accent colors tied to behavioral states: success (Emerald Green), skip (Ocean Blue). No neon glows, no Electric Blue legacy colors. Avatar system extends this language with five geometric shapes inside neutral circular containers, tinted only by user-chosen colors from a five-base palette.

## Differentiation
Dual-shadow neumorphic card pattern — convex emboss (top-left highlight + bottom-right shadow) in the raised state, inset shadows in the depressed/locked state. Avatar circles reuse the inset neumorphic language: neutral charcoal disc, white default initial, and avatarColor applied ONLY to the border ring and inner SVG shape fill — never to the container background. Tactile, premium aesthetic with professional solid accent colors (not glows).

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
| Avatar bg | oklch(0.27 0.005 264) | oklch(0.2 0.008 264) | Neutral avatar container, never tinted |
| Avatar base Emerald | oklch(0.696 0.17 162) | oklch(0.696 0.17 162) | #10B981 swatch + ±30 RGB range |
| Avatar base Ocean | oklch(0.466 0.14 234) | oklch(0.466 0.14 234) | #0369A1 swatch + ±30 RGB range |
| Avatar base Amber | oklch(0.76 0.16 70) | oklch(0.76 0.16 70) | #F59E0B swatch + ±30 RGB range |
| Avatar base Violet | oklch(0.58 0.21 296) | oklch(0.58 0.21 296) | #8B5CF6 swatch + ±30 RGB range |
| Avatar base Pink | oklch(0.66 0.22 358) | oklch(0.66 0.22 358) | #EC4899 swatch + ±30 RGB range |

## Neumorphic Shadow System

| State | Light Charcoal | Deep Charcoal |
|-------|---------------|---------------|
| Embossed (raised) | `-4px -4px 10px rgba(80,80,85,0.5), 6px 6px 14px rgba(0,0,0,0.7)` | `-4px -4px 10px rgba(60,60,65,0.4), 6px 6px 14px rgba(0,0,0,0.8)` |
| Inset (depressed) | `inset 4px 4px 8px rgba(0,0,0,0.55), inset -3px -3px 7px rgba(80,80,85,0.3)` | `inset 4px 4px 8px rgba(0,0,0,0.7), inset -3px -3px 7px rgba(80,80,85,0.2)` |
| Avatar container | `inset 3px 3px 6px rgba(0,0,0,0.5), inset -2px -2px 5px rgba(80,80,85,0.3)` | `inset 3px 3px 6px rgba(0,0,0,0.6), inset -2px -2px 5px rgba(80,80,85,0.2)` |
| Trace color | `#FFFFFF` | `#FFFFFF` |

## Typography
- **Display**: Bricolage Grotesque — geometric, bold, intentional (also used for default avatar initial)
- **Body**: General Sans — clean, contemporary, high legibility
- **Mono**: JetBrains Mono — data/code rendering, fixed-width emphasis
- **Scale**: sm (12px), base (14px), lg (16px), xl (18px), 2xl (20px)

## Structural Zones

| Zone | Background | Style | Purpose |
|------|-----------|-------|---------|
| Header | Card color (charcoal) | Deep shadow bottom | Fixed top nav; greeting + avatar + progress ring |
| Content | Background (deeper charcoal) | — | Dashboard, WOOP wizard, Partner Feed, Profile |
| Bottom Tab Bar | Card color | Raised neumorphic buttons | Today / Partner Feed / Analytics |
| Modal/Sheet | Popover color | Neumorphic card | Goal creation, obstacle selection, avatar picker |
| Sidebar/Drawer | Card color | Border-right subtle | Profile, settings, connections |
| Avatar container | Neutral charcoal (token) | Inset neumorphic, 2px tinted border | Header, profile, feed, onboarding preview |

## Avatar System

| Element | Treatment |
|---------|-----------|
| Container | Always circular, neutral `--avatar-bg`, inset neumorphic, 2px border (transparent when null, tinted by avatarColor when set) |
| Default (null/null) | First letter of username in `--avatar-default-text` white, `font-display` semibold, centered |
| Shape (Triangle/Square/Pentagon/Hexagon/Star) | Inline SVG, flat fill = avatarColor, no stroke, centered inside container, sized to ~60% of container |
| Border tint | `border-color: avatarColor` applied inline ONLY to the circular container ring |
| Size prop | Same component scales via `size` prop (header 20px, feed 32px, profile 64px, picker preview 96px) |
| Swatch buttons | Neumorphic chip circle, base color fill, active = white border + inset shadow |
| Shape buttons | Neumorphic chip square (rounded-lg), active = Emerald Green border + text |
| RGB sliders | Neumorphic inset track, Emerald Green thumb with white border, clamped ±30 of chosen base |
| Live preview | Reuses the Avatar component; updates synchronously as shape/color change (no animated transitions) |

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
- **Avatar**: Circular neutral container + optional tinted border + inline SVG shape OR white default initial
- **Avatar Swatch**: Neumorphic chip circle, base color fill, active = white ring + inset
- **Avatar Shape Btn**: Neumorphic chip square, active = Emerald Green border + text (mirrors .chip-neumorphic)

## Motion & Animation
- **Transition Default**: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` — smooth, non-intrusive
- **Drag**: Synchronous with pointer position; no spring on drag, spring snap back on release
- **Swatch hover**: `scale(1.05)` via transition-smooth; active swatch gets subtle Emerald pulse ring
- **Constraint**: No animations longer than 400ms; no bounce; respect `prefers-reduced-motion`
- **No animated shape transitions** — shape changes are instant (per scope)

## Spacing & Rhythm
- **Grid**: 4px baseline; card padding ~22px; gap between cards 1.5rem (24px)
- **Density**: Low (calm UI); generous whitespace
- **Container Max**: Full-width on mobile
- **Avatar picker**: shape grid 5-up with 12px gap; swatch row 5-up with 16px gap; sliders full-width with 16px vertical rhythm

## Constraints
- **No hardcoded hex/rgb outside accents** — all structure colors via CSS custom properties
- **No off-white light theme** — both modes are deep charcoal; light = medium charcoal, dark = deep charcoal
- **No neon glows** — solid accent borders only for state indicators
- **No Electric Blue (#0EA5FF)** — removed entirely; only Emerald Green + Ocean Blue remain
- **No arbitrary Tailwind colors** — use semantic token classes only
- **No avatar file uploads** — shape + color only, rendered as inline SVG
- **avatarColor applies ONLY to border + inner shape** — container background always neutral
- **No animated shape transitions** — instant swap on selection
- **No avatar color presets gallery** — only the five base swatches + ±30 RGB sliders
- **PWA-first** — responsive mobile-first; installable Web App Manifest

## Signature Detail
The avatar is a small piece of sculpture: a neutral neumorphic charcoal disc holding a single flat geometric shape, with the user's chosen color appearing in exactly two places — the thin border ring and the shape fill — leaving the rest of the calm charcoal canvas untouched. Default users get a crisp white initial in Bricolage Grotesque, signaling identity without committing to a shape until they're ready.

## Feature — Existing Goal Reuse (WOOP Wizard Step 2: Macro Goal)

### Purpose
When a user creates a new habit, their previously-stored goals (active AND completed) resurface as tappable chips in the Macro Goal step. Tapping one parses the stored "I want to X so that I can Y" string back into action + reason and fills both Macro Goal inputs with a satisfying choreography — no re-typing. A Clear button resets the pick and re-reveals the chips.

### Goal-Reuse Chips
- Full-width neumorphic chips (`.chip-goal-reuse`) showing the COMPLETE goal text; wrap naturally across lines.
- Reuse `.chip-neumorphic` shadow language (embossed raised) but with `px-4 py-3`, `text-left`, `w-full`, `leading-snug` for readability.
- Subtle 3px emerald-tinted left bar (`--goal-reuse-accent` @ 0.35 opacity) — reads as "selectable" without a full border.
- Hover: emerald border + 1px lift + deeper shadow. Active (press): inset shadow (mirrors `.chip-neumorphic.active`).
- `.chip-goal-reuse.filled` — the just-tapped chip flashes emerald border + inset before fading out.
- Stack vertically with `--goal-chips-gap` (10px) rhythm; show ALL goals, not just active ones.

### Tap-to-Fill Choreography
- On tap: tapped chip → `.filled` state → chips animate out (`goal-chips-out`: fade + 8px slide-down + scale 0.96, 280ms ease).
- Both Macro Goal inputs receive parsed values and run `.input-goal-filled` → `goal-fill-pop` keyframe (420ms, `cubic-bezier(0.34,1.56,0.64,1)` — same bounce easing as `card-lock`).
- Pop = scale 1 → 1.015 → 1 with a transient emerald ring (`--goal-fill-glow` @ 0.55) — satisfying tactile settle, no neon.
- Filled input text uses `.madlib-field` emerald treatment to match the wizard's existing emphasis language.

### Clear Button
- `.button-clear-neumorphic` — ghosted secondary neumorphic button (mirrors `.button-secondary-neon` shadow language, smaller `px-3 py-1.5`).
- Appears only after a goal is reused; presses inset (active state) for tactile feedback.
- Hover: emerald border + emerald text. Emerald-tinted caret icon signals "undo my pick".
- On press: empties both Macro Goal inputs and re-reveals chips via `goal-chips-in` (fade + 8px slide-up + scale 1, 320ms bounce easing).

### Motion Tokens
| Keyframe | Duration | Easing | Purpose |
|----------|----------|--------|---------|
| `goal-chips-out` | 280ms | `cubic-bezier(0.4,0,0.2,1)` | Chips fade + collapse on selection |
| `goal-chips-in` | 320ms | `cubic-bezier(0.34,1.56,0.64,1)` | Chips re-enter after Clear (bounce) |
| `goal-fill-pop` | 420ms | `cubic-bezier(0.34,1.56,0.64,1)` | Inputs pop as values land (bounce, reuses card-lock easing) |

### Scope Boundaries
- Fills ONLY Macro Goal fields (goalAction + goalReason) — habit-level fields stay empty.
- No smart deduplication, no fuzzy matching, no typing-time suggestions (per `doNotBuild`).
- Read-only reuse of `listMyGoals` backend query — no endpoint changes.
- Framer Motion `AnimatePresence` drives chip enter/exit; CSS keyframes provide easing + fallback.

## Feature — Goal Wizard (Bloom & Flow)

### Purpose
A premium full-screen goal-creation experience that reframes goal-setting as a calm, blooming ritual. Categories bloom into a tactile grid, a flowing SVG path draws the user's progress between steps, and Fraunces serif display type signals "this is the meaningful part" — distinct from the everyday Bricolage Grotesque app chrome. Extends the existing neumorphic canvas; the WOOP wizard tokens remain untouched.

### Palette
| Token | OKLCH | Purpose |
|-------|-------|---------|
| `--gw-emerald` | `oklch(0.696 0.17 162)` | Primary accent — bloom rings, path stroke, active step |
| `--gw-gold` | `oklch(0.74 0.13 85)` | Highlight — selected category glow, headline emphasis |
| `--gw-gold-soft` | `oklch(0.78 0.09 85)` | Secondary — path pulse, soft hover wash |
| `--gw-warm-surface` | `oklch(0.26 0.008 140)` | Wizard shell background — warmer than canvas charcoal |
| `--gw-gradient` | `linear-gradient(135deg, oklch(0.696 0.17 162), oklch(0.74 0.13 85))` | Bloom ring + path stroke fill |

### Typography
- **Display (wizard only)**: Fraunces — optical serif, warm and editorial; used for wizard headlines, step prompts, and category labels. Replaces Bricolage Grotesque inside the wizard shell only; the rest of the app keeps Bricolage Grotesque.

### Motion Tokens
| Keyframe | Duration | Easing | Purpose |
|----------|----------|--------|---------|
| `goal-wizard-bloom` | 600ms | `cubic-bezier(0.34,1.56,0.64,1)` | Category tiles scale + fade in with staggered bloom |
| `goal-wizard-path-draw` | 800ms | `cubic-bezier(0.4,0,0.2,1)` | SVG progress path stroke draws via dashoffset |
| `goal-wizard-path-pulse` | 1400ms | `cubic-bezier(0.4,0,0.6,1)` | Gold-soft pulse travels along completed path segments |
| `goal-wizard-text-reveal` | 500ms | `cubic-bezier(0.16,1,0.3,1)` | Fraunces headline words fade + 4px rise on step enter |
| `goal-wizard-underline-grow` | 450ms | `cubic-bezier(0.4,0,0.2,1)` | Emerald underline scales from left under active prompt |
| `goal-wizard-step-settle` | 380ms | `cubic-bezier(0.34,1.56,0.64,1)` | Step content settles with subtle bounce after transition |

### Wizard Shell (Structural Zone)
- Full-screen overlay on `--gw-warm-surface`; neumorphic emboss preserved via inherited shadow tokens.
- **Blooming category grid**: neumorphic embossed tiles arranged in a responsive grid; each tile blooms in with `goal-wizard-bloom` stagger (60ms per tile). Selected tile gets `--gw-gold` ring + inset shadow.
- **Flowing SVG progress path**: a curved path connecting step nodes, drawn with `goal-wizard-path-draw`; completed segments pulse via `goal-wizard-path-pulse`. Path stroke uses `--gw-gradient`.
- Step prompts render in Fraunces with `goal-wizard-text-reveal` + `goal-wizard-underline-grow`.
- Honors `prefers-reduced-motion` — blooms and path draws become instant fades.

### Scope Boundaries
- Extends the existing neumorphic canvas and shadow system; introduces no new structural color tokens beyond the `--gw-*` palette above.
- Does NOT modify WOOP wizard tokens, the dashboard swipe model, or avatar system.
- Designed for extensibility: future inputs beyond category / wish / outcome slot in as additional step nodes on the same SVG path without restructuring the shell.
- No backend contract changes — wizard composes inputs and hands off to the existing goal-creation flow.
