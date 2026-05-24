# Cumulative — Product Requirements Document

> **Status:** Current as of May 2026
> **Purpose:** Complete reference for developers and AI agents on what this app does, how it works, and what has been deliberately excluded.

---

## 1. App Overview

**Cumulative** is a behavioral-science-driven social accountability Progressive Web App (PWA). It is designed around the "Calm Technology" philosophy and a premium Neumorphic aesthetic. The app helps users build and maintain habits through the WOOP method (Wish, Outcome, Obstacle, Plan), with a secure decentralized backend on the Internet Computer (IC).

---

## 2. Philosophy & Design Principles

- **Calm Technology:** The UI should inform without demanding attention. No intrusive popups, no streaks, no pressure gamification.
- **Neumorphic Aesthetic:** True Neumorphism in both light and dark themes — soft extruded shadows, subtle pressed-in states, and negative space as a separator. No neon glows or Electric Blue accents.
- **Color System:**
  - Success / Regular habits: **Emerald Green** `#10B981`
  - Skip / Ocean: **Ocean Blue** `#0369A1`
  - Lock-In habits: **Golden/Amber** `#F59E0B` and `#D4AF37`
- **Typography:** Deep charcoals and crisp white text; light and dark greys for surfaces and buttons.
- **No avatar emoji anywhere in the app.**
- **No "Made by Caffeine" branding.**
- **No streak language or chain-based gamification anywhere in the app.**
- **No AM/PM notation on any card or time display** — 24-hour format only.

---

## 3. Technical Architecture

| Layer | Technology |
|---|---|
| Backend | Internet Computer (IC) — Motoko canisters |
| Frontend | React + TypeScript + Tailwind CSS |
| Auth | Internet Identity |
| Storage | Built-in canister state (no external database) |
| Email | Platform email extension (transactional) |
| Deployment | Fully installable PWA |

- All caching (service worker + browser) is disabled in development for accurate QA.
- Backend modularity: goal storage is isolated in a dedicated module with a typed API and explicit error returns.

---

## 4. Navigation

### Primary Navigation
Fixed Bottom Tab Bar (always visible):
- **Partners** (left) — yellow icon when active
- **Dashboard** (center) — green icon when active
- **Analytics** (right) — white icon when active

### Secondary Navigation
Drawer / Hamburger menu:
- Profile
- Subscription
- Connections
- Admin
- My Habits

### Page Layout
- **Fixed header:** greeting text (left), circular progress ring (right)
- **Scrollable center:** habit cards with generous spacing
- **Fixed bottom tab bar:** overlays content
- No borders or dividers — only Neumorphic shadows and negative space for visual separation.

---

## 5. Authentication & Onboarding

- **Internet Identity** is the sole authentication method.
- On first login, a single-screen onboarding flow requires the user to set a **unique username**.
  - Live green/red availability check as the user types.
  - Display name is optional and can be set or changed later.
- Existing users who do not have a username are forced to set one before they can access the app.
- **Logout is always accessible** from any screen, including during onboarding.

---

## 6. User Profile

| Field | Notes |
|---|---|
| Username | Required, unique. Replaces Principal ID in all UI. |
| Display Name | Optional, editable. |
| Email Address | Captured with live format validation. Required to enable email notifications. |
| Macro Wish ("About Your Journey") | 160-character bio. Live character counter. Smooth save animation after backend confirmation. |
| Timezone | Auto-detected and stored for habit tracking and midnight resets. **Hidden from the profile UI.** |

- Profile is displayed in a single card. Editing opens a sub-screen with a single Save button.
- No duplicate fields, no Principal ID visible in the UI.

### Theme Switcher
- Sun/moon icon button in the header.
- Toggles between dark and light Neumorphic themes.
- Choice persists across sessions.
- **System color scheme preference is deliberately ignored** — only the in-app toggle controls appearance.

---

## 7. Habit Creation — WOOP Wizard

### 7.1 Type Selection (Before the Wizard)
When the user taps "Create Habit", they see **two large side-by-side Neumorphic tile blocks**:
- **Regular Habit** (Emerald Green accent, default selected with pressed-in shadow)
- **Lock-In Habit** (Golden/Amber accent, raised when not selected)

**Type is permanent.** Once a habit is created as Regular or Lock-In, it **cannot be changed** — enforced in both the frontend (read-only badge in edit mode) and the backend (explicit rejection if `isLockIn` differs from the stored value).

---

### 7.2 Regular Habit — Wizard Steps

**Step 1: Wish**
- Habit action text (max 140 chars)
- Duration in minutes (max 1440)
- Character counters: invisible until typing, fade out on blur

**Step 2: Outcome**
- What achieving this habit looks like (max 140 chars)

**Step 3: Obstacle**
- Preset obstacle list only — **no custom obstacles anywhere in the app**
- Selected obstacle is shown after "IF" in the plan step

**Step 4: If-Then Plan**
- Format: "If [obstacle] happens, then I will [plan]."
- Input for "then I will" sits below the obstacle display

**Step 5: Final Step — Email Notifications**
- Toggle: "Enable Email Reminders" (disabled and shows helper link if no email on profile)
- If enabled:
  - **Intent time** picker (scroll wheel, 5-min increments)
  - **Reminder offset** picker (scroll wheel, 5-min increments, range -60 to +60 mins, capped so reminder never exceeds 23:55)
  - Warning shown: *"Note: You can only adjust your intent-time and email reminders once per day after creation."*
- Notifications activate **immediately** on habit creation — no additional edit step required.

---

### 7.3 Lock-In Habit — Wizard Steps

**Step 1: Start Time**
- Custom scroll wheel: hours (0–23) + minutes (5-min steps), golden/amber styling

**Step 2: Duration**
- Custom scroll wheel: hours + minutes (5-min steps)
- Duration dynamically capped so session cannot end past 23:55
- Live **"Ends at HH:MM"** preview shown as user adjusts wheels
- Existing Lock-In blocks shown as Neumorphic chips below the duration wheels, sorted chronologically
- Conflicting chip highlights red instantly on overlap

**Steps 3–4: Wish, Outcome, Obstacle, If-Then Plan**
- Same as Regular habit steps 1–4 above

**Step 5: Final Step — Email Notifications**
- Toggle: "Enable Email Reminders"
- If enabled:
  - **Reminder offset** picker (scroll wheel, 5-min increments, range **-60 to 0 only** — before start time)
  - Live **"Sends at HH:MM"** preview shown

---

### 7.4 Custom Scroll Wheels

All time, duration, and reminder offset pickers throughout the app use a **custom inline scroll wheel component** — no native browser time/date popups.

| Theme | Accent |
|---|---|
| Regular habit wheels | Dark Neumorphic surface + Emerald Green highlight band on selected value |
| Lock-In habit wheels | Dark Neumorphic surface + Golden/Amber highlight band on selected value |

- 5-minute increments throughout
- Smooth snap-to-value behaviour
- Touch and mouse drag both supported

---

### 7.5 Post-Creation Animation
After a habit is created:
- User is redirected to the dashboard
- New habit card gets a **shiny animated green border glow for 3 seconds**
- **"New habit" tag** appears at bottom right of card for 10 seconds (shown once only)

---

## 8. Dashboard

### 8.1 Habit Cards (Active Tab)
- Shows only user-created keystone habits
- Each card displays:
  - Keystone habit name (prominent, tappable to open timeline)
  - User-selected minimalist SVG icon
  - 7-day color ball tracker (green = done, blue = skipped, grey = missed)
  - Card text: **"I will [habit] for [duration]"** only — no "Every day," prefix
- Time displayed in **24-hour format** only
- **Only the habit name is tappable** to open the timeline — card body taps do nothing (by design, for scrollability)

### 8.2 Gesture Interactions

| Gesture | Regular Habit | Lock-In Habit |
|---|---|---|
| Swipe right | Complete → Emerald Green border → moves to Done tab | Check-in (within window) or Check-out (within window) |
| Swipe left | WOOP Catch sheet → then obstacle selection if still skipping | Obstacle + optional note sheet |

- Swipe gestures use axis lock and drag threshold to prevent conflicts with vertical page scroll.

### 8.3 WOOP Catch (Regular Habit Skip Flow)
1. Swiping left triggers the **WOOP Catch** bottom sheet showing the user's If-Then plan.
2. User can either:
   - Confirm they executed the plan → **logged as success** with a green spark icon
   - Proceed to skip → preset obstacle list appears → user selects obstacle + optional 140-char note → logged to backend

### 8.4 Done Tab & Undo
- After a swipe, the habit moves from Active to the **Done tab**
- **Regular habits:** Undo is available until midnight
- **Lock-In habits:** **No Undo ever** — both frontend and backend enforce this
- Done tab cards are visually identical to Active cards, with a green (done) or blue (skipped) border

---

## 9. Lock-In Habits — Full Lifecycle

Lock-In habits are strict time-blocked sessions with a fundamentally different lifecycle from Regular habits.

### 9.1 States
| State | Description |
|---|---|
| Upcoming | Before the check-in window opens |
| Check-In Window | Start time −5 min to start time +5 min. User must swipe to start. |
| In Progress (#InProgress) | User has checked in. Session is running. |
| Check-Out Window | End time −5 min to end time +5 min. User must swipe to finish. |
| #MissedCheckIn | User never swiped to start within the check-in window |
| #MissedCheckOut | User started (#InProgress) but missed the check-out window |
| Completed | Successfully checked in and checked out |

### 9.2 Missed Window Flow

When a window expires without the user acting:

1. Card **locks** — swipe is disabled
2. Card displays the relevant message:
   - **"Missed Start Window. Tap to log reason."** for #MissedCheckIn
   - **"Missed Check-Out. Tap to log reason."** for #MissedCheckOut
3. **Resolution sheet auto-slides up once** when the window closes
4. Resolution sheet contains: preset obstacle grid + optional 140-char custom note
5. **Card stays anchored on the active dashboard** until the user submits a reason
6. After submission, the card moves to the Done tab

### 9.3 Done Tab Display for Failed Lock-In Cards
- A **muted Neumorphic inset box** is shown on the card bottom half
- Displays a badge ("Missed Start" or "Missed Check-Out")
- Full justification details (obstacle + note) are only visible in the **timeline**, not on the card face

### 9.4 Edit Lockout (Ulysses Pact)
- Lock-In habits **cannot be edited during the active window** (start −5 min to end +5 min)
- UI disables edit with a lock icon and tooltip
- Backend enforces this with an explicit error

### 9.5 Live Timers
- Cards show live countdown timers for all states
- Professional digital clock format: monospace, no emojis
- Checkout window shows amber pulse animation

### 9.6 Same-Day Habit Safeguard
- If a Lock-In habit was created **after** the start window had already expired for that day, it shows "waiting" (no missed state)
- If it was created **before** the start time, the missed-start state triggers correctly if the window is missed

---

## 10. Behavioral Timeline (Goal Insight)

Accessed by **tapping the habit name** on any card (not the card body).

- Full-screen, reverse-chronological view of the **last 14 days**
- Color-coded timeline nodes:

| Node Color | Meaning |
|---|---|
| Green | Completed |
| Green + spark icon | Completed after executing the If-Then plan (WOOP revival / "grit") |
| Blue | Skipped — shows obstacle name and optional note in a muted italic sub-line below |
| Hollow grey | Missed |
| Orange | Obstacle (labeled "Obstacle") |

- **Lock-In failure nodes:** Ocean Blue, shows obstacle name + custom note as a sub-line below
- No "Missed" node on the first day for a newly created Lock-In habit

---

## 11. My Habits Page

- Renamed from "My Goals" — no "Habit Management" subtitle
- Keystone habit is more prominent in the list
- All habit fields are accessible for editing
- **"Create Habit"** button inline with the page title, styled as a Neumorphic Emerald Green pill

---

## 12. Edit Habit Page (Two Tabs)

### Tab 1: Habit Details
- Freely editable, no daily limit
- Editable fields: habit name, outcome, obstacles (preset only), If-Then plan, icon, color, duration
- **Habit type shown as a static read-only badge** at the top:
  - "Regular Habit" (green badge)
  - "Lock-In Habit" (golden badge)
  - Text below: *"Habit type is permanent and cannot be changed."*

### Tab 2: Time & Reminders
- Email notification toggle
- Regular habits: intent time picker + reminder offset (scroll wheel, -60 to +60 mins)
- Lock-In habits: start time + duration pickers + reminder offset (scroll wheel, -60 to 0 mins)
- All pickers use the same custom scroll wheels as the creation wizard
- **Separate Save button** with a counter showing edits remaining today
- Time/reminder edits limited to **once per day**; if already edited today, inputs lock with a warning banner
- Lock-In habits: edit fully blocked during active window (both tabs)

---

## 13. Partner Connections & Feed

- **Mutual consent required** — users must send and accept connection requests before seeing each other's activity
- Partner Feed displays check-in activity from accepted partners only
- **"High-Five"** reactions on feed items

---

## 14. Analytics

- 30-day trend chart
- Completion rates
- Consistency tracking
- **No "streak" language anywhere in the app**
- All habit data stored as typed numeric fields for future analytics aggregation (see Section 16)

---

## 15. Email Notifications

### System Behavior
- Emails fire **once per day** at the correct local time
- The IC backend runs on UTC; the user's stored `timezoneOffsetMinutes` is applied before comparing against `intentTime` or `lockInStartTime`
- `lastEmailSentAt` field is set **before** the send call to prevent re-entrant ticks from firing a duplicate
- If the habit has already been **completed or skipped** for that day, no email is sent

### Template: Regular Habit (Emerald Green)
- Subject: *"Action required: [Habit Action]"*
- Dark Neumorphic card with `#10B981` accents
- Body: display name, habit name, duration, intent time, obstacle + If-Then plan
- CTA button: **"Open App to Log Action"**
- Footer: *"Own your actions."*

### Template: Lock-In Habit (Premium Gold)
- Subject: *"Lock-In Starting Soon: [Habit Action]"*
- Dark Neumorphic card with `#D4AF37` accents
- Body: display name, habit name, duration, exact start time, obstacle + If-Then plan
- CTA button: **"Prepare to Lock In"**
- Footer: *"Protect your time."*

---

## 16. Data Model — Analytics-Ready Fields

All key numeric values are stored as typed integer fields so they can be queried and aggregated for future analytics.

| Field | Type | Notes |
|---|---|---|
| `durationMinutes` | `Nat` | Raw total duration in minutes |
| `lockInStartMinutes` | `Int` | Start time as minutes from midnight |
| `lockInEndMinutes` | `Int` | End time as minutes from midnight |
| `lockInDurationMinutes` | `Nat` | Total Lock-In session length in minutes |
| `reminderOffsetMinutes` | `Int` | Signed integer; negative = before, positive = after |
| `intentTimeMinutes` | `Int` | Intent time as minutes from midnight (Regular habits) |
| `timezoneOffsetMinutes` | `Int` | User's local UTC offset in minutes (e.g., -120 for UTC+2) |
| `lastEmailSentAt` | `Int` | IC nanosecond timestamp; 0 = never sent |
| `createdAt` | `Int` | IC nanosecond timestamp |
| Check-in state | `variant` | `#Completed`, `#Skipped`, `#MissedCheckIn`, `#MissedCheckOut`, `#InProgress` |
| Obstacle | `Text` | Preset list only; no custom obstacles |
| Obstacle note | `?Text` | Optional, max 140 characters |

---

## 17. Explicitly NOT in This App

The following features and patterns are **deliberately excluded** and must not be added without an explicit product decision:

| Excluded | Reason |
|---|---|
| Custom obstacles | Preset list only; enforced in all flows (creation, edit, skip, missed Lock-In) |
| Streak language or chain gamification | Contrary to the Calm Technology philosophy |
| Avatar emoji | Design decision; no emoji in usernames or profile cards |
| AM/PM time notation | 24-hour format only throughout |
| Native browser time/date pickers | All replaced with custom scroll wheels |
| Timezone visible in profile UI | Auto-detected and stored server-side; hidden from user |
| Reason box on Lock-In Done tab cards | Justification details only visible in the timeline |
| Tier-based access restrictions | App fully unlocked for all users; freemium tiers removed |
| "Made by Caffeine" branding | Removed |
| Undo for Lock-In habits | Permanent; enforced in both frontend and backend |
| Habit type switching after creation | Type immutability enforced full-stack |

---

## 18. Key UX Micro-Decisions

- **Card body taps do nothing** for scrollability — only the habit name text triggers the timeline
- **Back and Next buttons in the wizard are both green** — visual consistency
- **Character counters** are invisible until the user starts typing, then fade out on blur
- **Scroll wheels** use snap-to-value with both touch and mouse drag
- **Lock-In duration wheels hide** until a start time is selected, then dynamically cap based on remaining time until 23:55
- **"Ends at HH:MM"** live preview updates as the user adjusts Lock-In duration wheels
- **"Sends at HH:MM"** live preview updates as the user adjusts the reminder offset wheel
- **Same-day habits:** The missed-start state only fires if the habit was created *before* the start time. Habits created after the window expired show "waiting" that day.
- **Obstacle note** is optional at all times (skip flow, missed Lock-In resolution, edit page)

---

*This document reflects the complete production state of Cumulative as of May 2026. It is intended as a living reference — update it whenever a feature is added, changed, or removed.*
