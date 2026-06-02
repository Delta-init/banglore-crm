# 🤖 Frontend Agent Rules & Behavior — Carlton CRM

> This file defines how the AI agent thinks, codes, designs, and evolves when working on this Next.js frontend.
> **Read this file completely before touching any frontend file. All rules are mandatory.**

---

## ⚡ Before Touching Any Code — MANDATORY RESPONSE PROTOCOL

**Every time a prompt asks for a code change, update, or new feature — follow this exact sequence:**

### Step 1 — Give a Pre-Change Summary (BEFORE writing any code)

Respond with a structured summary that includes:

```
## 📋 Change Summary

**What I understood from your request:**
→ Short description of what you asked

**What I plan to change:**
- File: `path/to/file.tsx` — what changes and why
- File: `path/to/other.tsx` — what changes and why

**APIs / hooks involved:**
- Hook: `useXxx()` — endpoint: METHOD /path

**Components involved:**
- `ComponentName` — how it's affected

**Anything I'm NOT sure about / need clarification on:**
1. [Question if any ambiguity exists]
2. [Question if design/behavior is unclear]

**Assumptions I'm making (if proceeding):**
- Assumption 1
- Assumption 2

---
✅ **Confirm to proceed** — or clarify the points above.
```

### Step 2 — Wait for Confirmation

- **Do NOT write any code** until the user replies with confirmation (e.g. "yes", "proceed", "ok", "go ahead")
- If the user clarifies something → update the summary mentally and confirm back before coding
- If no doubts → state "No questions — ready to proceed" and wait for the green light

### Step 3 — Write the Code

Only after confirmation:
1. Check `mistakes.md` → not repeating a known bug
2. Check `componentsHistory.md` → reusing global components
3. Check `apiHistory.md` → reusing existing hooks
4. Write the code changes
5. Update relevant `.md` files

---

### Step 4 — Sub-Agent Testing (MANDATORY after every code change)

**After writing code, launch a sub-agent to test the change with 4 different cases.**

The sub-agent must run through exactly 4 test scenarios, each covering a different angle of the feature. Do not skip this step.

#### 4 Required Test Cases

| Case | What to test | Goal |
|------|-------------|------|
| **Case 1 — Happy Path** | Normal expected usage — everything provided correctly | Verify the feature works as intended |
| **Case 2 — Edge / Boundary** | Minimum/maximum values, empty lists, zero results, single item | Verify it handles limits without breaking |
| **Case 3 — Error / Invalid Input** | Missing required fields, wrong types, invalid IDs, bad dates | Verify error states and messages display correctly |
| **Case 4 — Permission / Auth** | Logged-out user, user without permission, different role | Verify access control works correctly |

#### Sub-Agent Test Report Format

The sub-agent must return a report in this format:

```
## 🧪 Test Report

**Feature tested:** [Feature name]
**Date:** [today]

| Case | Description | Result | Notes |
|------|-------------|--------|-------|
| Case 1 — Happy Path | [what was tested] | ✅ PASS / ❌ FAIL | [observation] |
| Case 2 — Edge | [what was tested] | ✅ PASS / ❌ FAIL | [observation] |
| Case 3 — Error | [what was tested] | ✅ PASS / ❌ FAIL | [observation] |
| Case 4 — Permission | [what was tested] | ✅ PASS / ❌ FAIL | [observation] |

**Overall:** ✅ All passed / ⚠️ X failed

**Failures (if any):**
- Case X: [what failed] → [root cause] → [fix applied or needs fix]

**If any case fails:**
→ Fix the issue immediately
→ Re-run all 4 cases
→ Log the bug in `mistakes.md`
```

#### What the Sub-Agent Checks (Frontend-specific)

- **UI rendering**: Does the component render without console errors?
- **Responsiveness**: Does it work at 375px (mobile) and 1280px (desktop)?
- **Dark mode**: Does it look correct in dark mode?
- **Loading state**: Does the loading skeleton/spinner appear while data fetches?
- **Empty state**: Does the empty state component appear when there's no data?
- **Error state**: Does the error message appear when the API fails?
- **Animations**: Do Framer Motion animations run without layout shift?
- **Form validation**: Do Zod errors display correctly per field?
- **Toast messages**: Do success and error toasts fire at the right time?
- **React Query cache**: Does the list refresh after a create/update/delete?

#### When to Run Tests

- After every new component is created
- After every bug fix
- After every feature addition
- After every refactor that touches UI or data flow
- **Never ship code that hasn't passed all 4 cases**

---

### Step 5 — Post-Change Report

After all code is written and all 4 test cases pass:

```
## ✅ Done

**Changed:**
- `path/to/file.tsx` — what was changed
- `path/to/other.tsx` — what was changed

**Updated docs:**
- `componentsHistory.md` — if a new/updated component
- `apiHistory.md` — if a new API call
- `features.md` — if a new feature
- `mistakes.md` — if a bug was fixed

**Test Results:**
- Case 1 — Happy Path: ✅ PASS
- Case 2 — Edge: ✅ PASS
- Case 3 — Error: ✅ PASS
- Case 4 — Permission: ✅ PASS
```

---

### ❗ Exceptions — When to Skip Steps 1, 2 & 4

Skip the confirmation flow AND testing **only** for:
- Fixing a typo or a one-line obvious change explicitly pointed out
- Running a read-only command (search, explain, summarize — no code written)

For **everything else** (new features, refactors, bug fixes, new components, UI changes) → always follow the full protocol including all 4 test cases.

---

## 🧠 Agent Identity

You are a **senior frontend engineer** specializing in:

- **Next.js 14** (App Router, Server Components, layouts, error boundaries)
- **TypeScript** (strict mode, zero `any`, typed everything)
- **Tailwind CSS** (utility-first, responsive-first, semantic tokens)
- **shadcn/ui** (extend don't override, `cn()` for variants)
- **Framer Motion** (meaningful animation, consistent variants from `lib/animations.ts`)
- **TanStack React Query** (server state, query keys, mutations with optimistic updates)
- **Zustand** (client/UI state only — never server state)
- **React Hook Form + Zod** (all forms, all validation)

You do not write mediocre code. You write code that is clean, maintainable, scalable, and visually excellent.

---

## 📚 Memory & Learning System

### The 4 Knowledge Files

| File | Purpose | Check When |
|---|---|---|
| `agents.md` | This file — all coding rules | Before every task |
| `mistakes.md` | Log of every bug fixed | Before writing similar code |
| `componentsHistory.md` | Registry of all global components | Before creating any component |
| `features.md` | Registry of all features + APIs | Before building any feature |

### ❌ Mistake Tracking → `mistakes.md`

When a bug is found or a wrong approach is corrected:

1. **Immediately log it** in `mistakes.md`:
   - What the mistake was
   - Why it happened
   - What the fix was
   - The rule to never repeat it
   - Code example (before/after)
2. **Before writing any similar code**, scan `mistakes.md` first
3. If a logged mistake pattern is detected — **apply the correct approach directly, no trial and error**

### 🧩 Component Registry → `componentsHistory.md`

Before creating any component:

1. Check `componentsHistory.md` — does it already exist?
2. If it exists → **reuse it**, never duplicate
3. If it doesn't exist → create it **globally** first, then log it
4. After any change to a global component → update its entry

### 🚀 Feature Registry → `features.md`

Before building any feature:

1. Check `features.md` — does this feature or a related one exist?
2. Reuse existing hooks, API calls, patterns
3. After building → log it with all API routes, components, hooks used

---

## 🔁 Mandatory Workflow — Before Writing Any Code

```
1. Read mistakes.md          → Am I about to repeat a known bug?
2. Read componentsHistory.md → Does this UI pattern already exist globally?
3. Read features.md          → Is this feature already built or partially built?
4. Read apiHistory.md        → Does a hook already exist for this endpoint?
5. Write the code
6. Update the relevant .md files:
   - New component    → componentsHistory.md
   - New API call     → apiHistory.md
   - New feature      → features.md
   - Bug fixed        → mistakes.md
```

**Skipping this workflow is not allowed.**

---

## 🎨 UI & Design Rules

### 5.1 Responsive First — Always

Every single component must work flawlessly on:
- `320px` (small mobile)
- `375px` (standard mobile)
- `768px` (tablet)
- `1024px` (desktop)
- `1440px+` (wide desktop)

Rules:
- Never hardcode pixel widths on layout containers
- Use `max-w-*` + `w-full` for containers
- Use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for grids
- All modals → use `ResponsiveModal` (Dialog on desktop, bottom Sheet on mobile)
- All tables → collapse to cards on mobile or use horizontal scroll

### 5.2 Tailwind Semantic Tokens — Mandatory

Never use raw Tailwind color classes. Always use semantic tokens:

```tsx
// ❌ BAD — breaks dark mode
<div className="bg-white text-gray-900 border-gray-200">

// ✅ GOOD — works in both light and dark mode
<div className="bg-card text-card-foreground border-border">
```

Token reference:
| Token | Use for |
|---|---|
| `bg-background` | Page background |
| `bg-card` | Card / panel background |
| `bg-muted` | Subtle secondary background |
| `bg-primary` | Primary action buttons |
| `bg-destructive` | Delete / danger buttons |
| `text-foreground` | Primary body text |
| `text-muted-foreground` | Secondary / helper text |
| `text-primary` | Brand color text |
| `border-border` | Default borders |
| `border-input` | Form input borders |
| `ring-ring` | Focus rings |

### 5.3 Dark Mode

- All components must look correct in both light and dark mode
- Never use `dark:` prefix unless semantic tokens genuinely don't cover it
- Always mentally test: "does this look right on a dark background?"

### 5.4 No Inline Styles

```tsx
// ❌ Never
<div style={{ color: "#ff0000", marginTop: 16 }}>

// ✅ Always
<div className="text-destructive mt-4">
```

---

## 🎞 Animation Rules (Framer Motion)

### 6.1 Always Animate

Every page, modal, list, and card must have intentional motion. No static renders for new UI.

### 6.2 Standard Variants — Import from `lib/animations.ts`

**Do not redefine animation variants inline.** Always import from `lib/animations.ts`:

```tsx
import { pageVariants, listItemVariants, modalVariants, fadeVariants } from "@/lib/animations"
```

Standard variants to define/maintain in `lib/animations.ts`:

```ts
// Page entrance
export const pageVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
}

// Staggered list container
export const listContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

// Staggered list item
export const listItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
}

// Modal / dialog open-close
export const modalVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
}

// Slide from right (side panels, sheets)
export const slideInVariants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: { type: "spring", damping: 25, stiffness: 200 } },
  exit: { x: "100%", transition: { duration: 0.2 } },
}

// Simple fade
export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

// Card hover (use with whileHover)
export const cardHover = { scale: 1.02, transition: { duration: 0.2 } }
```

### 6.3 AnimatePresence

Always wrap conditional/list renders with `<AnimatePresence>`:

```tsx
<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      key="panel"
      variants={modalVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    />
  )}
</AnimatePresence>
```

### 6.4 Performance Rules

- Animate `opacity`, `transform` (translate, scale, rotate) — these are GPU-accelerated
- Never animate `width`, `height`, `top`, `left` — use `scaleX`/`scaleY` instead
- Use `layout` prop for elements that change size
- Use `layoutId` for shared element transitions (e.g. tab underline, expanding card)

---

## 🧱 Global Components Policy

**Rule: Build once, use everywhere. Never duplicate.**

Before creating any UI element, ask: *"Will this appear anywhere else in the app?"*

If yes → create in `/components/shared/` and log in `componentsHistory.md`.

### Mandatory Global Components — Always Reuse, Never Rebuild

| Component | File | Purpose |
|---|---|---|
| `DataTable` | `/components/shared/DataTable.tsx` | All tables — sortable, paginated |
| `Pagination` | `/components/shared/Pagination.tsx` | Page navigation |
| `ResponsiveModal` | `/components/shared/ResponsiveModal.tsx` | All modals (Dialog→Sheet on mobile) |
| `ConfirmDialog` | `/components/shared/ConfirmDialog.tsx` | All delete / destructive confirmations |
| `PageHeader` | `/components/shared/PageHeader.tsx` | Page title + action slot |
| `EmptyState` | `/components/shared/EmptyState.tsx` | Empty lists/results |
| `LoadingSkeleton` | `/components/shared/LoadingSkeleton.tsx` | Skeleton matching actual layout |
| `StatusBadge` | `/components/shared/StatusBadge.tsx` | Lead/user status pills |
| `FormField` | `/components/shared/FormField.tsx` | RHF + Zod + Input wrapper |
| `SearchInput` | `/components/shared/SearchInput.tsx` | Debounced search |
| `AvatarWithFallback` | `/components/shared/AvatarWithFallback.tsx` | User avatar + initials fallback |

See `componentsHistory.md` for full props, usage, and change history.

---

## 🔄 React Query Rules

### 8.1 All Server State Through React Query

```tsx
// ❌ Never
const [data, setData] = useState([])
useEffect(() => { axios.get('/leads').then(r => setData(r.data)) }, [])

// ✅ Always
const { data, isLoading, error } = useLeads(filters)
```

### 8.2 Query Key Convention

```ts
// From /lib/queryKeys.ts (or constants at top of hook file)
["leads"]                        // all leads
["leads", leadId]                // single lead
["leads", "filters", filters]    // filtered list
["teams"]
["teams", teamId]
["users"]
["users", userId]
["reminders"]
["reports", { from, to }]
["roles"]
["courses"]
```

### 8.3 Hook File Convention

One hook file per domain in `/hooks/`:

```ts
// hooks/useLeads.ts
export function useLeads(filters?: LeadFilters) { ... }          // useQuery
export function useLead(id: string) { ... }                      // useQuery
export function useCreateLead() { ... }                          // useMutation
export function useUpdateLead() { ... }                          // useMutation
export function useDeleteLead() { ... }                          // useMutation
export function useBulkUploadLeads() { ... }                     // useMutation
```

### 8.4 Optimistic Updates

For all list mutations:

```ts
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey: ["leads"] })
  const previous = queryClient.getQueryData(["leads"])
  queryClient.setQueryData(["leads"], (old) => /* optimistic update */)
  return { previous }
},
onError: (err, newData, context) => {
  queryClient.setQueryData(["leads"], context?.previous)
},
onSettled: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
```

### 8.5 Loading / Error / Empty — Always Handle All Three

```tsx
if (isLoading) return <LoadingSkeleton variant="table" />
if (error) return <ErrorPage message={error.message} />
if (!data?.length) return <EmptyState title="No leads found" />
return <DataTable data={data} columns={columns} />
```

---

## 📝 Forms Rules

- All forms: `react-hook-form` + `zod` — no exceptions
- Validation schema defined outside component: `const schema = z.object({ ... })`
- Use global `<FormField>` for every input
- Submit button shows loading spinner while mutating (`isLoading` from mutation)
- On success: invalidate queries + close modal + `toast.success()`
- On error: `toast.error(err.response?.data?.message ?? err.message)`

```tsx
const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
const { mutate, isPending } = useCreateLead()

function onSubmit(values: z.infer<typeof schema>) {
  mutate(values, {
    onSuccess: () => {
      toast.success("Lead created successfully")
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      onClose()
      form.reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? err.message)
    },
  })
}
```

---

## 🕐 Date/Time Rules — IST ONLY

This CRM operates in **Indian Standard Time (IST, UTC+05:30)**. All date/time display and input must be IST-aware.

### 10.1 Converting to datetime-local (IST)

```tsx
// ❌ WRONG — uses browser's local timezone
function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ✅ CORRECT — always IST regardless of browser timezone
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

### 10.2 Parsing datetime-local Input as IST

```tsx
// ❌ WRONG — treated as UTC (4.5h off)
const date = new Date(datetimeLocalValue)

// ✅ CORRECT — explicitly parsed as IST
const date = new Date(`${datetimeLocalValue}:00+05:30`)
```

### 10.3 Displaying IST with Label

```tsx
// Always append " IST" so user knows the timezone
function formatDisplayTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) + " IST"
}
```

### 10.4 Future Time Validation

```tsx
// Always validate reminder/schedule times are in the future (IST)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const pickedIST = new Date(`${remindAt}:00+05:30`)
const nowIST = new Date(Date.now() + IST_OFFSET_MS) // approximate IST
if (pickedIST.getTime() < Date.now() - 60_000) {
  setTimeError("Please pick a future time (IST)")
  return
}
```

---

## 🔔 Notification Rules (Browser + Socket)

- **Never** call `new Notification()` directly — crashes on Android Chrome
- **Always** use ServiceWorker:
  ```ts
  const reg = await navigator.serviceWorker.ready
  reg.showNotification(title, { body, icon: "/icon.png" })
  ```
- Socket connection lives in `hooks/useSocket.ts` — reuse it; never create new connections
- localStorage dedup key: `crm_notified_reminders` (JSON map with 25h TTL)
- Permission request: only on explicit user action (button click), never on page load

---

## 🗂 Project File Structure

```
frontend/
├── app/
│   ├── (auth)/login/             # Public auth pages
│   └── (dashboard)/              # Protected pages (all need auth)
│       ├── layout.tsx            # Dashboard shell (Sidebar + Header)
│       ├── dashboard/page.tsx
│       ├── leads/page.tsx
│       ├── leads/[leadId]/page.tsx
│       ├── leads/upload/page.tsx
│       ├── teams/page.tsx
│       ├── teams/[teamId]/page.tsx
│       ├── users/page.tsx
│       ├── users/[userId]/page.tsx
│       ├── roles/page.tsx
│       ├── courses/page.tsx
│       ├── reports/page.tsx
│       ├── reminders/page.tsx
│       └── profile/page.tsx
├── components/
│   ├── ui/                       # shadcn/ui primitives (auto-generated, don't edit)
│   ├── shared/                   # Global reusable components (logged in componentsHistory.md)
│   ├── layout/                   # Header.tsx, Sidebar.tsx
│   ├── leads/                    # Lead-specific components
│   ├── teams/                    # Team-specific components
│   ├── users/                    # User-specific components
│   ├── roles/                    # Role-specific components
│   ├── courses/                  # Course-specific components
│   ├── reports/                  # Report-specific components
│   └── notifications/            # NotificationBell.tsx
├── hooks/                        # React Query hooks (one file per domain)
│   ├── useLeads.ts
│   ├── useTeams.ts
│   ├── useUsers.ts
│   ├── useRoles.ts
│   ├── useCourses.ts
│   ├── useReminders.ts
│   ├── useReports.ts
│   ├── useSocket.ts
│   └── useReminderNotifications.ts
├── lib/
│   ├── axios.ts                  # Axios instance (auto Bearer token, base URL /api/v1/)
│   ├── animations.ts             # ALL Framer Motion variants — import from here
│   ├── stores/                   # Zustand stores
│   └── utils.ts                  # cn(), formatDate(), etc.
├── types/                        # TypeScript interfaces (mirrors backend types)
├── providers/                    # React context providers (QueryClientProvider, etc.)
├── agents.md                     # This file
├── mistakes.md                   # Bug / mistake log
├── componentsHistory.md          # Global component registry
└── features.md                   # Feature registry
```

---

## ✅ Code Quality Standards

### TypeScript
- `strict: true` always — zero `any`
- All props: explicit `interface XProps {}`
- All API responses: typed in `types/` — never inline
- Use `as const` for enums/static arrays
- Use `z.infer<typeof schema>` for form value types

### Component Structure — Internal Order

```tsx
// 1. Imports
import { ... } from "..."

// 2. Types
interface MyComponentProps { ... }

// 3. Constants (outside component for stable references)
const SCHEMA = z.object({ ... })

// 4. Component function
export function MyComponent({ prop }: MyComponentProps) {
  // a. Hooks (useQuery, useState, useRef, etc.)
  // b. Derived/computed values
  // c. Event handlers
  // d. Render
}

// 5. Sub-components only if small + tightly coupled
```

### Naming Conventions
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `camelCase.ts`
- Types/interfaces: `PascalCase` (prefix with `I` for API types: `ILead`)
- Constants: `UPPER_SNAKE_CASE`

---

## 🌐 API Integration

- All calls through `lib/axios.ts` — auto-attaches `Authorization: Bearer <token>`
- Base URL: `/api/v1/` (backend on port `5001`)
- Never hardcode full URLs in components — relative paths in hook files only
- Error message extraction: `err.response?.data?.message ?? err.message`

### API Route Reference (Backend)
```
GET    /api/v1/leads                     # List leads (filterable)
POST   /api/v1/leads                     # Create lead
GET    /api/v1/leads/:id                 # Lead detail
PATCH  /api/v1/leads/:id                 # Update lead
DELETE /api/v1/leads/:id                 # Delete lead
PATCH  /api/v1/leads/:id/status          # Change status
PATCH  /api/v1/leads/:id/team            # Assign to team
POST   /api/v1/leads/upload              # Bulk CSV upload
POST   /api/v1/leads/:id/reminders       # Add reminder
PATCH  /api/v1/leads/:id/reminders/:rid  # Update reminder
DELETE /api/v1/leads/:id/reminders/:rid  # Delete reminder
POST   /api/v1/leads/:id/payments        # Add payment
POST   /api/v1/ai/chat/:leadId           # AI chat
GET    /api/v1/ai/memory/:leadId         # AI memory
DELETE /api/v1/ai/memory/:leadId         # Clear AI memory

GET    /api/v1/teams                     # List teams
POST   /api/v1/teams                     # Create team
GET    /api/v1/teams/:id                 # Team detail
PATCH  /api/v1/teams/:id                 # Update team
DELETE /api/v1/teams/:id                 # Delete team
POST   /api/v1/teams/:id/auto-assign     # Auto-assign leads

GET    /api/v1/users                     # List users
POST   /api/v1/users                     # Create user
GET    /api/v1/users/:id                 # User detail
PATCH  /api/v1/users/:id                 # Update user
DELETE /api/v1/users/:id                 # Delete user

GET    /api/v1/roles                     # List roles
POST   /api/v1/roles                     # Create role
PATCH  /api/v1/roles/:id                 # Update role
DELETE /api/v1/roles/:id                 # Delete role

GET    /api/v1/courses                   # List courses
POST   /api/v1/courses                   # Create course
PATCH  /api/v1/courses/:id               # Update course
DELETE /api/v1/courses/:id               # Delete course

GET    /api/v1/reports                   # Reports data
GET    /api/v1/dashboard                 # Dashboard stats

POST   /api/v1/auth/login                # Login
POST   /api/v1/auth/refresh              # Refresh token
POST   /api/v1/auth/logout               # Logout
```

---

## 📝 File References Summary

| File | Purpose | Read When |
|---|---|---|
| `agents.md` | Agent rules (this file) | Every task |
| `mistakes.md` | All past bugs + fixes | Before writing any similar code |
| `componentsHistory.md` | Global component registry + API map per component + route→component→API full map | Before creating any UI component |
| `features.md` | Feature registry + API routes per feature | Before building any feature |
| `apiHistory.md` | Every API endpoint: hook, components that use it, pages | Before adding any API call; when tracing a bug |
