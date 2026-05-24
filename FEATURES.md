# Cumulative — Feature Documentation

> Last updated: May 23 2026

Cumulative is a behavioral-science-driven social accountability PWA built on the Internet Computer. It follows a **Calm Technology** philosophy with a premium Neumorphic aesthetic and strict behavioral guardrails.

---

## 1. Authentication & Onboarding

- **Internet Identity** authentication — decentralized, no passwords
- **Single-screen onboarding** for unique username setup on first login
  - Live green/red availability check as the user types
  - Username is required; display name is optional
  - No avatar emoji anywhere in the app
- **Forced username prompt** — existing users without a username are redirected to set one before accessing the dashboard
- **Logout** available from anywhere in the app at all times

---

## 2. Habit Creation Wizard (WOOP)

### Habit Type Selection
- At the top of the wizard Step 1, users choose **"Regular Habit"** or **"Lock-In Habit"** via two large side-by-side neumorphic tile blocks
- **Regular Habit** tile: Emerald Green accent, default selected/pressed-in state
- **Lock-In Habit** tile: Gold/Amber accent, becomes active on tap
- No intermediate popup — pressing "Create Habit" goes straight into the wizard
- **Type is permanently immutable** — cannot be changed after creation (enforced in both frontend and backend)
- A read-only badge ("Regular Habit" or "Lock-In Habit") replaces the type selector on the edit page

### Regular Habit Wizard Steps
1. **Step 1 (Habit)** — habit type tile, habit name (140 char max), daily duration via scroll wheel
2. **Wish** — macro wish (140 char max)
3. **Outcome** — desired result (140 char max)
4. **Obstacle** — preset obstacles only (no custom obstacles anywhere in the app)
5. **If-Then Plan** — obstacles shown after "IF", input for "then I will" sits below
6. **Final step** — icon, color, and email notification setup

### Lock-In Habit Wizard Steps
1. **Step 1 (Time setup)** — habit type tile + start time and duration via custom golden scroll wheels
   - Duration wheels hidden until start time is set; helper text: "Please select a start time first"
   - Duration capped so sessions cannot spill past 23:55; max hours/minutes dynamically calculated
   - "Ends at HH:MM" live preview updates as you spin the wheels
   - Live overlap detection: conflicting existing habit chip turns red instantly
   - "Current Lock-In Habits" panel shows existing blocks sorted chronologically as amber Neumorphic chips
2. **Wish / Outcome / Obstacle / If-Then Plan** — same as regular
3. **Final step** — icon and email notification setup

### Custom Scroll Wheels
- All time, duration, and reminder offset pickers use a **fully custom inline scroll wheel**
- No native browser popups
- Smooth snap-to-item scrolling with touch/mouse drag support
- **Emerald Green** highlight band for regular habit pickers
- **Gold/Amber** highlight band for Lock-In habit pickers
- 5-minute increments for all pickers (duration, offsets, intent time, Lock-In start time)

### Email Notifications (Final Step)
- Toggle is disabled with helper text if no email is saved on the user's profile; link opens Profile in a new tab
- **Regular habits**: pick intent time (scroll wheel, 5-min steps) + reminder offset scroll wheel (-60 to +60 mins, capped so reminder never fires past 23:55)
- **Lock-In habits**: reminder offset scroll wheel only, restricted to -60 to 0 mins (before start only)
- Live "Sends at HH:MM" preview updates as you scroll the offset wheel
- Warning: "Note: You can only adjust your intent-time and email reminders once per day after creation"
- Email activates immediately after habit creation — no separate edit-page save required
- Both intent time and offset pickers use Emerald Green scroll wheels for regular, Gold for Lock-In

### Field Limits
- All text fields: 140 character max
- Daily minutes: 1440 max
- Character counters: invisible until typing, disappear on blur

---

## 3. Dashboard

### Layout
- **Fixed header**: greeting on the left, progress ring on the right
- **Scrollable center**: keystone habit cards with generous spacing
- **Fixed bottom tab bar**: Dashboard (center), Partners (left), Analytics (right)
- No borders or dividers — only Neumorphic shadows and negative space

### Habit Cards
- Shows only: `"I will [habit] for [X minutes]"` — no "Every day," prefix, no AM/PM
- User-selected minimalist SVG icon
- 7-day color ball tracker (green / blue / grey)
- **Only the habit name text is tappable** to open the timeline — card body does nothing
- Lock-In cards: golden/amber accents, lock icon, time block tag, monospace live countdown timer

### Gesture Interactions (Active Tab)
- **Swipe right** → Complete (Emerald Green border flash, card moves to Done tab)
- **Swipe left** → Triggers WOOP Catch flow (regular) or miss handling (Lock-In)
- Swipe threshold: 60px horizontal, axis-locked (12px horizontal before activating)
- No tap-to-complete; card body taps do nothing for scrollability

### WOOP Catch Flow (Regular habits, swipe left)
1. Bottom sheet shows the user's If-Then plan
2. **"I did my If-Then Plan"** → logs as success with green spark icon, moves to Done tab
3. **"Proceed to skip"** → preset obstacle grid + optional 140-char note → logs skip

### Done Tab
- Cards are visually identical to Active tab but with green (done) or blue (skipped) border
- **Undo** is available for regular habits before midnight
- **No Undo** for Lock-In habits — they stay in Done permanently until the next day
- Failed Lock-In cards show justification inline in the timeline only (not on the card)

### New Habit Animation
- New habit cards get a **shiny animated green border glow** for 3 seconds
- A **"new habit" tag** appears at the bottom right for 10 seconds
- One-time only per habit

---

## 4. Lock-In Habits — Full Lifecycle

### Time Windows
- Check-in window: 5 minutes before/after the scheduled start time
- Check-out window: 5 minutes before/after the scheduled end time

### States
| State | Meaning |
|-------|---------|
| Waiting | Start window not yet open |
| Check-In Window | User must swipe right to start |
| In Progress | Habit is active |
| Check-Out Window | User must swipe right to finish |
| Completed | Both swipes done ✓ |
| MissedCheckIn | Never started within the 5-min start window |
| MissedCheckOut | Started but missed the 5-min checkout window |

### Missed Window Handling
- Cards stay **pinned on the active dashboard** with an amber glow until resolved
- "Log What Happened" button is visible on the card
- Resolution sheet **slides up automatically** when a window expires
- Resolution sheet: preset obstacle grid + optional 140-char note
- After submission: card moves to Done tab; timeline shows obstacle + note
- **#MissedCheckIn** badge = "Missed Start"
- **#MissedCheckOut** badge = "Missed Check-Out"

### Edit Lockout (Ulysses Pact)
- Cannot edit a Lock-In habit during its active window (start-5min to end+5min)
- UI disables edit button with lock icon and tooltip
- Backend enforces the same lockout independently

### Live Countdown Timers
- Cards show a professional digital countdown in monospace for all states: upcoming, check-in window, in progress, check-out window
- No emojis in timers

### Overlap Detection
- Real-time live overlap check during creation wizard as start time or duration changes
- Conflicting existing habit chip turns red instantly
- Backend also hard-validates on save — creation is rejected if overlap exists

---

## 5. Behavioral Timeline

- Tap the habit name on any card to open the full-screen timeline
- Shows last 14 days in reverse chronological order
- **Color-coded nodes**:
  - 🟢 Green: success
  - 🟢+spark: revival (If-Then plan executed)
  - 🔵 Blue: skip (shows obstacle name + optional note below)
  - ⚪ Hollow grey: missed
  - 🟠 Orange node (Lock-In failure): shows obstacle name + custom note
- Justification details for Lock-In failures are only visible here, not on the card
- Timeline correctly starts on the day after habit creation (no false "Missed" on day 1)

---

## 6. Habit Edit Page

- Accessible from My Habits → Edit button
- **Two tabs**:
  - **Habit Details**: freely editable at any time — name, outcome, obstacles, If-Then plan, icon, color
  - **Time & Reminders**: separate Save button + daily edit counter (limited to once per day); uses same scroll wheel pickers as wizard
- Habit type badge displayed prominently ("Regular Habit" in green / "Lock-In Habit" in gold — read-only, with "Habit type is permanent and cannot be changed." note)
- Type switching is impossible — no toggle shown in edit mode; backend also rejects any type change attempt
- Lock-In Ulysses Pact: entire edit page locks during the active window (start-5min to end+5min)
- All scroll wheel pickers match the wizard: Emerald Green for regular, Gold for Lock-In

---

## 7. My Habits Page

- Lists all habits with keystone habit displayed prominently
- "Create Habit" button inline with title as a Neumorphic Emerald Green pill
- No "Habit Management" subtitle
- Edit navigates to the full Edit Habit page

---

## 8. Partner Connections & Feed

- **Mutual consent required** — users must send and accept connection requests
- Partner Feed shows check-in activity from accepted partners only
- **High-Five** reactions on partner check-ins

---

## 9. Analytics

- 30-day trend chart
- Completion rates and consistency tracking (no "streak" language)
- All habit numbers, durations, and check-in data stored as structured Int/Nat fields for analytics
- Raw total Lock-In duration stored as minutes (hours × 60 + minutes) for aggregation
- Timezone-correct data (all stored relative to user's local timezone offset)

---

## 10. User Profile

- **Display name**: optional, editable at any time
- **Username**: required, unique, replaces Principal ID in all UI
- **Macro Wish** ("About Your Journey"): 160-char bio with live counter and smooth save animation
- **Email address**: captured with live format validation and error feedback
- **Timezone**: auto-detected and stored for backend use — hidden from profile UI
- No avatar emoji anywhere
- Editing opens a sub-screen with a single Save button
- Profile info shown in a single card

---

## 11. Theme Switcher

- Sun/moon icon button in the top right corner
- Toggles between light charcoal and deep charcoal Neumorphic themes
- User choice persisted across sessions via localStorage
- System `prefers-color-scheme` is intentionally ignored — only the app toggle controls appearance

---

## 12. Email Notifications

### Sending Logic
- Emails fire exactly **once** per habit per day
- Timer runs on UTC; user's stored `timezoneOffset` (minutes) converts server time to local before comparing
- `lastEmailSentAt` flag is set **before** the send to prevent race-condition duplicates
- Email is **never sent** after a habit has been completed or skipped for the day

### Templates
- **Regular habit** (Emerald Green): dark neumorphic HTML card with strict inline CSS, ⏳ icon, intent time highlighted in emerald, obstacle + If-Then plan reminder, "Open App to Log Action" button
- **Lock-In habit** (Gold): dark neumorphic HTML card with strict inline CSS, 🔒 icon, exact start time highlighted in #D4AF37, obstacle + If-Then plan reminder, "Prepare to Lock In" button
- All template variables dynamically populated: display name, habit name, duration, intent/start time, obstacle, If-Then plan, app link
- No streak or chain language anywhere in email content
- Race-condition duplicate prevention: `lastEmailSentAt` set before the send; timer also checks for completed/skipped check-ins before firing

---

## 13. Obstacles & Skip Notes

- **Preset obstacles only** throughout the entire app — creation wizard, edit page, skip flows, and missed Lock-In resolution
- Custom obstacle input is fully removed from all screens and from the codebase
- "My brain" and "drugs" are filtered from all preset lists
- **Optional 140-character daily note** available whenever a user logs a skip or missed Lock-In justification
- Note is stored per check-in day and displayed in the timeline as a muted italic sub-line below the obstacle name
- Both the obstacle name and the custom note are stored as structured fields for future analytics

---

## 14. Navigation

### Bottom Tab Bar
- Fixed at the bottom of every screen
- Three tabs: **Partners** (left), **Dashboard** (center), **Analytics** (right)
- White readable icons/text at all times
- Selected tab icons light up: Dashboard (Emerald Green), Partners (Yellow/Gold), Analytics (White)
- Active tab is always visually distinct

### Drawer / Hamburger Menu
- Secondary navigation accessible from the header
- Menu items: Profile, Connections, My Habits, Subscription, Admin (dev only)
- Opens as a slide-in drawer, does not navigate away from the current tab

---

## 15. PWA & Development

- Fully installable Web App Manifest
- All service worker and browser caching disabled in development for accurate QA
- Data reset: full canister wipe and redeployment available in dev environment only
- Backend on Internet Computer (Motoko canister)

---

## 16. Removed / Intentionally Excluded Features

The following features were deliberately removed or are intentionally absent from the app:

| Removed Feature | Reason |
|---|---|
| Custom obstacles | Preset obstacles only — maintains behavioral rigor and clean data |
| Streak / chain language | Replaced with "consistency" framing — no gamification pressure |
| AM/PM time display | All times shown in 24-hour format for clarity |
| Avatar / profile emoji | No avatars anywhere — clean identity model |
| Freemium tier restrictions | All tiers removed; app is fully unlocked for all users |
| System `prefers-color-scheme` | App theme is user-controlled only via the toggle |
| Native browser time pickers | Custom scroll wheels used throughout for unified UX |
| Tap-to-complete on cards | Gestures only (swipe) — prevents accidental completions |
| Timezone visible in profile UI | Auto-detected and stored for backend use only |
| `#FailedLockIn` generic state | Replaced by distinct `#MissedCheckIn` and `#MissedCheckOut` states |
| Undo for Lock-In habits | Lock-In completions are permanent — enforced in frontend and backend |
| "Made by Caffeine" branding | Removed from all UI surfaces |

---

## 17. Analytics-Ready Data Model

- All key numeric fields stored as typed `Int`/`Nat` in the backend for future aggregation:
  - Habit duration in minutes (raw total)
  - Lock-In start time (minutes from midnight)
  - Lock-In end time (calculated, stored)
  - Lock-In raw total duration in minutes (hours × 60 + minutes)
  - Email reminder offset in minutes
  - Intent time in minutes from midnight
  - User timezone offset in minutes (for UTC-to-local conversion)
- Check-in records store: obstacle ID, obstacle note (140 chars), timestamp, state (success / skip / MissedCheckIn / MissedCheckOut / revival)
