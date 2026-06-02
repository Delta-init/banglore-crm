# ❌ Mistakes Log — Carlton CRM Frontend

> Every bug, wrong approach, or bad pattern found and fixed must be logged here.
> **Before writing code**, scan this file for patterns relevant to your current task.
> If a logged mistake pattern is detected — apply the correct fix directly. No repeats.

---

## How to Use This File

- **Before coding**: Search by keyword (component name, library, pattern, API)
- **When a bug is fixed**: Add it immediately at the **top** of the correct category
- **Entry count**: Increment counter at the bottom each time

---

## 📋 Mistake Entry Template

```
### [SHORT TITLE]
- **Date**: YYYY-MM-DD
- **Category**: notifications | datetime | react-query | nextjs | typescript | tailwind | framer-motion | api | forms | components | general

**What happened**:
Description of the bug or wrong approach.

**Why it happened**:
Root cause.

**Fix**:
What was changed.

**Rule — Never do this again**:
> One-line rule stated clearly.

**Code**:
// ❌ Wrong
...
// ✅ Correct
...
```

---

## 🗂 Categories

---

## 🔔 Notifications & Browser APIs

### Android `new Notification()` Constructor Crash
- **Date**: 2026-04-01
- **Category**: notifications

**What happened**:
`TypeError: Illegal constructor` on Android Chrome when triggering reminder notifications. Desktop browsers worked fine, Android silently crashed.

**Why it happened**:
Android Chrome blocks the direct `new Notification()` constructor. It only allows notifications via `ServiceWorkerRegistration.showNotification()`.

**Fix**:
In `hooks/useReminderNotifications.ts`, replaced all `new Notification(title, options)` with:
```ts
const reg = await navigator.serviceWorker.ready
reg.showNotification(title, options)
```

**Rule — Never do this again**:
> Never call `new Notification()` directly — always route through `navigator.serviceWorker.ready.then(reg => reg.showNotification(...))`.

**Code**:
```ts
// ❌ Wrong — crashes on Android Chrome
function fireBrowserNotification(title: string, body: string) {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icon.png" })
  }
}

// ✅ Correct — works on all platforms
async function fireBrowserNotification(title: string, body: string) {
  if (Notification.permission !== "granted") return
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.ready
    reg.showNotification(title, { body, icon: "/icon.png" })
  } else {
    new Notification(title, { body }) // desktop fallback only
  }
}
```

---

## 🕐 Date / Time (IST)

### `toDatetimeLocal()` Using Browser Timezone Instead of IST
- **Date**: 2026-04-01
- **Category**: datetime

**What happened**:
Reminder times displayed with wrong hours on non-IST browsers (e.g. Vercel preview on UTC server, or users browsing from different timezone).

**Why it happened**:
`d.getHours()` returns hours in the **browser's local timezone**, not IST. On a UTC machine, IST times appear 5h30m off.

**Fix**:
Use `toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" })` which always outputs a string in `YYYY-MM-DD HH:mm:ss` format in IST, regardless of browser timezone.

**Rule — Never do this again**:
> All `datetime-local` conversions MUST use `sv-SE` locale + `Asia/Kolkata` timeZone. Never use `getHours()`, `getDate()`, etc. for IST output.

**Code**:
```ts
// ❌ Wrong — browser-timezone dependent
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ✅ Correct — always IST
function toDatetimeLocal(iso: string): string {
  return new Date(iso)
    .toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" })
    .slice(0, 16)
    .replace(" ", "T")
}
function nowIST(): string {
  return toDatetimeLocal(new Date().toISOString())
}
```

**Files fixed**: `components/leads/ReminderPanel.tsx`, `app/(dashboard)/reminders/page.tsx`

---

### `datetime-local` Input Parsed as UTC Instead of IST
- **Date**: 2026-04-01
- **Category**: datetime

**What happened**:
When saving a reminder, the time was stored 5 hours 30 minutes behind the intended IST time. E.g., user picks `10:00 AM IST`, stored as `04:30 UTC` (correct) but the parsing intermediate step was wrong and some paths stored `10:00 UTC` = `3:30 PM IST`.

**Why it happened**:
`new Date("2024-06-01T10:00")` — a datetime string without timezone is parsed as **UTC** in V8 (Chrome/Node). So `10:00` was treated as `10:00 UTC` = `15:30 IST`.

**Fix**:
Append `:00+05:30` to force IST parsing:
```ts
const pickedIST = new Date(`${remindAt}:00+05:30`)
```

**Rule — Never do this again**:
> All `datetime-local` string parsing must append `:00+05:30` to force IST timezone. Never pass a bare `datetime-local` value to `new Date()`.

**Code**:
```ts
// ❌ Wrong — parsed as UTC
const pickedDate = new Date(remindAt) // "2024-06-01T10:00" → UTC

// ✅ Correct — parsed as IST
const pickedDate = new Date(`${remindAt}:00+05:30`) // explicitly IST
```

**Files fixed**: `components/leads/ReminderPanel.tsx`, `app/(dashboard)/reminders/page.tsx`

---

### Time Display Missing IST Label
- **Date**: 2026-04-01
- **Category**: datetime

**What happened**:
Reminder times displayed without timezone label — users confused whether times were IST or UTC.

**Why it happened**:
`toLocaleString` was called without `timeZone: "Asia/Kolkata"` option, falling back to browser timezone.

**Fix**:
Added `timeZone: "Asia/Kolkata"` to all `toLocaleString` calls that display reminder times, and appended `" IST"` to the output string.

**Rule — Never do this again**:
> All time display for this CRM must use `timeZone: "Asia/Kolkata"` and append `" IST"` so users always see IST-labeled times.

**Code**:
```ts
// ❌ Wrong
function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { ... }) // no timezone
}

// ✅ Correct
function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) + " IST"
}
```

---

## 📦 Components

### Duplicate Delete Dialogs Across Modules
- **Date**: 2026-04-01
- **Category**: components

**What happened**:
6 separate delete dialog components existed (`DeleteLeadDialog`, `DeleteUserDialog`, `DeleteTeamDialog`, `DeleteRoleDialog`, `DeleteCourseDialog`) — all nearly identical. Bug fixed in one was not fixed in others.

**Why it happened**:
No global `ConfirmDialog` existed. Each developer built their own.

**Fix**:
Create `components/shared/ConfirmDialog.tsx` as the single global confirmation dialog. All delete dialogs should use it. Document in `componentsHistory.md`.

**Rule — Never do this again**:
> Before building any modal/dialog, check `componentsHistory.md`. If a `ConfirmDialog` or `ResponsiveModal` exists — use it, never build a new one from scratch.

---

## 🔄 React Query

### Fetching Data in `useEffect` Instead of React Query
- **Date**: 2026-04-01
- **Category**: react-query

**What happened**:
Some components fetched data directly inside `useEffect` with `axios`. Data was not cached, re-fetched on every mount, and loading/error states were manually managed.

**Why it happened**:
Component was written without checking existing hooks.

**Fix**:
Move all data fetching to React Query hooks in `/hooks/`. Use `useQuery` for reads, `useMutation` for writes.

**Rule — Never do this again**:
> Zero raw fetches in components. All server state through React Query hooks in `/hooks/`. No exceptions.

**Code**:
```tsx
// ❌ Wrong
const [leads, setLeads] = useState([])
useEffect(() => {
  axios.get("/leads").then(r => setLeads(r.data))
}, [])

// ✅ Correct
const { data: leads, isLoading, error } = useLeads(filters)
```

---

### Missing `onError` Toast in Mutations
- **Date**: 2026-04-01
- **Category**: react-query

**What happened**:
Mutations failed silently — no error message shown to the user.

**Why it happened**:
`useMutation` was called without an `onError` handler.

**Fix**:
Every `useMutation` must have both `onSuccess` (toast + invalidate) and `onError` (error toast).

**Rule — Never do this again**:
> Every mutation must have `onError: (err) => toast.error(err.response?.data?.message ?? err.message)`.

---

## 🎨 Tailwind CSS

### Raw Color Classes Breaking Dark Mode
- **Date**: 2026-04-01
- **Category**: tailwind

**What happened**:
Some components appeared white-on-white in dark mode because they used `bg-white` and `text-gray-900`.

**Why it happened**:
Raw Tailwind color classes don't invert in dark mode. Semantic tokens like `bg-card` do.

**Fix**:
Replace all raw color classes with semantic token equivalents.

**Rule — Never do this again**:
> Never use raw Tailwind colors (`bg-white`, `text-gray-900`, `border-gray-200`). Always use semantic tokens (`bg-card`, `text-foreground`, `border-border`).

**Code**:
```tsx
// ❌ Wrong
<div className="bg-white text-gray-900 border border-gray-200">

// ✅ Correct
<div className="bg-card text-card-foreground border border-border">
```

---

### Inline `style={}` Instead of Tailwind
- **Date**: 2026-04-01
- **Category**: tailwind

**What happened**:
Responsive breakpoints and dark mode didn't work on elements using inline styles.

**Why it happened**:
Convenience — quick inline style instead of finding the Tailwind class.

**Fix**:
Replace all `style={{ ... }}` with equivalent Tailwind utility classes.

**Rule — Never do this again**:
> Zero inline styles. All styling via Tailwind classes only.

---

## 🌐 General / Other

### No Input Validation for Future Time on Reminder Form
- **Date**: 2026-04-01
- **Category**: forms

**What happened**:
Users could save reminders with past times, causing notifications to fire immediately on creation.

**Why it happened**:
No `min` attribute on `datetime-local` input, and no frontend validation.

**Fix**:
1. Added `min={nowIST()}` on `<input type="datetime-local">` — prevents past-time selection
2. Added `timeError` state with future-time check before save
3. Backend also validates future time (double safety)

**Rule — Never do this again**:
> All `datetime-local` inputs for future-event scheduling must have `min={nowIST()}` and a frontend validation check before submit.

---

## ➕ Adding a New Mistake

Copy the template at the top and place it at the **top** of the correct category section.

**Entry count**: 9
*(Increment every time you add a mistake)*
