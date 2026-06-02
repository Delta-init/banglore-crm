# Carlton CRM — Master Agent Rulebook



> **Read this file completely at the start of every session before touching any code.**
> This file is the single source of truth for how the agent behaves in this project.
> Full universal rules live in `AGENT_BOOTSTRAP.md` — this file extends them for Carlton CRM specifically.

---





## 📋 PROJECT STATUS — Read First Every Session

Before doing anything else, read these two files:

1. **`PROJECT_STATUS.md`** — current state, last working item, pending issues, critical warnings
2. **`PLAN.md`** — phase-by-phase roadmap, what's built, what's next

If either file is missing → create it immediately using the templates in `AGENT_BOOTSTRAP.md`.

---

## ⚡ MANDATORY RESPONSE PROTOCOL — No Exceptions

Every prompt asking for a code change MUST follow this 5-step sequence:

### Step 1 — Pre-Change Summary (BEFORE any code)

```
## 📋 Change Summary

**What I understood:**
→ [short description]

**What I plan to change:**
- File: `path/to/file` — [what + why]

**APIs / services involved:**
- [hook / service method / endpoint]

**Anything I'm NOT sure about:**
1. [question if ambiguous]

---
✅ Confirm to proceed — or clarify above.
```

### Step 2 — Wait for Confirmation
Do NOT write any code until the user says "yes", "proceed", "go", "ok" etc.

### Step 3 — Write the Code
Only after confirmation. Always check in this order first:
1. `backend/mistakes.md` — not repeating a known bug
2. `backend/servicesHistory.md` — method already exists?
3. `backend/middlewareHistory.md` — correct middleware chain?
4. `frontend/mistakes.md` — known frontend bug pattern?
5. `frontend/componentsHistory.md` — global component exists?
6. `frontend/apiHistory.md` — hook already exists?

### Step 4 — Sub-Agent Testing (MANDATORY after every code change)

Launch a sub-agent to run exactly 4 test cases:

| Case | What to test |
|------|-------------|
| Case 1 — Happy Path | Valid input, normal usage |
| Case 2 — Edge / Boundary | Empty arrays, zero results, min/max values |
| Case 3 — Error / Invalid Input | Missing fields, bad IDs, wrong types |
| Case 4 — Permission / Auth | No token (401), wrong role (403), inactive user |

Sub-agent test report format:
```
## 🧪 Test Report — [Feature]
| Case | Description | Result | Notes |
|------|-------------|--------|-------|
| Case 1 | [tested] | ✅ PASS / ❌ FAIL | |
| Case 2 | [tested] | ✅ PASS / ❌ FAIL | |
| Case 3 | [tested] | ✅ PASS / ❌ FAIL | |
| Case 4 | [tested] | ✅ PASS / ❌ FAIL | |
```
If any case fails → fix immediately → re-run all 4 → log in `mistakes.md`.

### Step 5 — Post-Change Report
```
## ✅ Done
**Changed:** [files]
**Docs updated:** [which .md files]
**Tests:** Case 1 ✅ | Case 2 ✅ | Case 3 ✅ | Case 4 ✅
```

**Skip Steps 1–2 ONLY for:** typo fixes and read-only tasks (explain/search/summarise).

---

## 🗺 PLANNING AGENT — Phase by Phase → Feature by Feature

### When to Run
- No `PLAN.md` exists → run planning agent first, always
- New major feature or module → update PLAN.md before coding
- User says "plan", "design", "architect" → run planning agent

### Execution Order (NON-NEGOTIABLE)
```
Phase 1
  └── Feature 1.1 → build backend → build frontend → 4-case test → screenshot → confirm
  └── Feature 1.2 → build backend → build frontend → 4-case test → screenshot → confirm
  └── Phase 1 complete report → confirm Phase 2

Phase 2
  └── Feature 2.1 → ...
```

**One feature at a time. Confirm between every feature. Confirm between every phase.**

### Feature Announce Format
```
## 🔨 Feature [N.X] — [Name]
What it does: [one sentence]

Backend: [ ] task1  [ ] task2
Frontend: [ ] task1  [ ] task2
Tests: 4 cases

Building now...
```

### Feature Complete Format
```
## ✅ Feature [N.X] Done — [Name]
Backend: [what was created]
Frontend: [what was created]
Tests: Case 1 ✅ | Case 2 ✅ | Case 3 ✅ | Case 4 ✅
Preview: [screenshot]

Next: Feature [N.X+1] — [name]
✅ Confirm to continue — or adjust first.
```

### Phase Complete Format
```
## ✅ Phase [N] Complete — [Name]
Features: ✅ [list]
Tests: [N features × 4 cases] ✅
Preview: [screenshot]

Next: Phase [N+1] — [name]
✅ Confirm to start Phase [N+1].
```

---

## 🌐 DEV SERVER — Auto-Start & Browser Preview

Every session start → automatically:
1. Detect start command from `package.json`
2. Start backend: `cd backend && bun run dev &` → port **5001**
3. Start frontend: `cd frontend && bun run dev &` → port **3000**
4. Wait up to 10s for ports to be live
5. Call `preview_start` → `preview_screenshot` → show to user
6. Open real browser: `open http://localhost:3000` (macOS)

After every UI code change → `preview_eval: window.location.reload()` → `preview_screenshot` → show immediately. Never ask the user to "check manually".

**Preview verification checklist after every UI change:**
- `preview_console_logs` → any JS errors?
- `preview_screenshot` → looks correct?
- `preview_resize(375)` → mobile looks correct?
- `preview_network` → any failed API calls?

---

## 🧪 TESTING AGENT — 4 Cases Every Time

Backend tests use `bun test`:
```bash
bun test tests/ --timeout 15000
bun test tests/[module]/ --timeout 15000
bun test tests/ --timeout 15000 --reporter=verbose
```

Test file location: `backend/tests/[module]/[feature].test.ts`
Helpers: `backend/tests/helpers/auth.ts`, `backend/tests/helpers/factory.ts`

```typescript
// Quick backend test template
import { getToken, api } from "../helpers/auth"

describe("[Feature]", () => {
  let token: string
  beforeAll(async () => { token = await getToken() })

  it("Case 1 — happy path", async () => {
    const { status, data } = await api("GET", "/leads", token)
    expect(status).toBe(200)
    expect(data.success).toBe(true)
  })

  it("Case 3 — missing fields", async () => {
    const { status } = await api("POST", "/leads", token, {})
    expect(status).toBe(400)
  })

  it("Case 4 — no auth", async () => {
    const { status } = await api("GET", "/leads")
    expect(status).toBe(401)
  })
})
```

---

## 🏗 CARLTON CRM — Project Context

### Stack
| Layer | Technology |
|-------|-----------|
| Runtime | **Bun** |
| Backend framework | Express + TypeScript |
| Database | MongoDB (Mongoose ODM) |
| Realtime | Socket.io + Web Push (VAPID) |
| Validation | Zod |
| Auth | JWT (access 15m + refresh 7d) |
| Frontend | **Next.js 14.2.5** (App Router) |
| UI | TailwindCSS 3.x + shadcn/ui |
| Animation | **Framer Motion 11** (mandatory on every component) |
| Theme | next-themes (light/dark/system switcher — always in header) |
| Server state | TanStack React Query v5 |
| Client state | Zustand |
| Forms | React Hook Form + Zod |
| HTTP | Axios |
| Charts | Recharts |
| Toasts | Sonner |
| Icons | Lucide React |

### Ports & URIs
- **Backend**: `http://localhost:5001`
- **Frontend**: `http://localhost:3000`
- **MongoDB**: `mongodb://localhost:27017/crm_db`
- **All API routes**: `/api/v1/`
- Backend `.env`: `backend/.env`
- Frontend `.env`: `frontend/.env.local`

### Project Layout
```
crm/
├── CLAUDE.md               ← This file — read every session
├── AGENT_BOOTSTRAP.md      ← Universal agent rules — reference for full detail
├── PLAN.md                 ← Phase-by-phase roadmap (living doc)
├── PROJECT_STATUS.md       ← Current state, pending issues, warnings
├── .vscode/
│   ├── launch.json         ← Debug configs (Bun backend + Next.js frontend + compound)
│   ├── settings.json       ← Format on save, Tailwind IntelliSense, TypeScript
│   ├── extensions.json     ← Recommended extensions
│   └── tasks.json          ← Start servers, run tests, lint (Cmd+Shift+B)
├── backend/
│   ├── src/
│   │   ├── controllers/    ← Thin request handlers (validate → call service → respond)
│   │   ├── services/       ← All business logic
│   │   ├── models/         ← Mongoose schemas
│   │   ├── routes/         ← Express routers
│   │   ├── middleware/      ← auth, permissions, errorHandler, apiKeyAuth
│   │   ├── types/          ← Shared TypeScript interfaces
│   │   ├── validations/    ← Zod schemas
│   │   └── utils/          ← jwt.ts, response.ts
│   ├── tests/              ← bun:test files
│   │   └── helpers/        ← auth.ts, factory.ts
│   ├── AGENTS.md           ← Backend agent rules
│   ├── mistakes.md         ← All past bugs + fixes
│   ├── servicesHistory.md  ← All service methods
│   ├── logicHistory.md     ← All business logic
│   ├── features.md         ← All backend features
│   ├── socketHistory.md    ← Socket.io + Web Push events
│   └── middlewareHistory.md← Middleware stack + permission matrix
└── frontend/
    ├── app/
    │   ├── (auth)/login/   ← Public login page
    │   └── (dashboard)/    ← Protected pages (all need auth)
    ├── components/
    │   ├── ui/             ← shadcn/ui primitives (never edit directly)
    │   └── shared/         ← Global reusable components
    ├── hooks/              ← React Query hooks (one file per domain)
    ├── lib/
    │   ├── axios.ts        ← Axios instance (auto Bearer token)
    │   ├── animations.ts   ← ALL Framer Motion variants (import from here always)
    │   └── stores/         ← Zustand stores
    ├── providers/
    │   ├── QueryProvider.tsx
    │   └── ThemeProvider.tsx ← next-themes wrapper
    ├── agents.md           ← Frontend agent rules
    ├── mistakes.md         ← Frontend bug log
    ├── componentsHistory.md← Component registry + route→component→API map
    ├── apiHistory.md       ← All API hooks + query keys + usage
    ├── features.md         ← All frontend features
    └── design.md           ← Design system (colours, fonts, spacing, animations)
```

### Key Conventions
- All API routes prefixed `/api/v1/`
- Auth middleware chain: `authenticate` → `checkPermission(module, action)`
- Permission modules: `dashboard | leads | teams | users | roles | reports | courses | reminders | settings`
- Response helpers: `sendSuccess(res, data, message)` / `sendError(res, message, status)` from `utils/response.ts`
- Frontend API calls via `lib/axios.ts` (auto Bearer token)
- React Query keys: `["leads"]`, `["teams"]`, `["users"]`, `["reminders"]`, `["roles"]`, `["courses"]`, `["reports"]`
- Lead statuses: `new | assigned | followup | closed | rejected | cnc | booking | partialbooking | interested`

### Database
- **URI**: `mongodb://localhost:27017/crm_db`
- **Collections**: `users`, `leads`, `teams`, `roles`, `courses`, `aiMemories`, `pushSubscriptions`, `teamMessages`

### AI Memory Feature
- Each lead has an AI chat assistant (Anthropic Claude)
- Conversations stored in `AiMemory` collection (per lead + per user)
- API: `POST /api/v1/ai/chat/:leadId` | `GET /api/v1/ai/memory/:leadId` | `DELETE /api/v1/ai/memory/:leadId`
- Frontend: `AiChatPanel` component in lead detail page

---

## 🎨 DESIGN RULES — MANDATORY (Zero Exceptions)

### Font — 3 Approved Options Only
Always one of: **Poppins** / **DM Sans** / **Inter** — loaded via `next/font/google`.
Never system-ui, Arial, or Helvetica as primary. Check `frontend/design.md` for which one this project uses.

### Theme Switcher — Always Present
- `next-themes@^0.3.0` installed always
- `ThemeProvider` wraps the entire app in `layout.tsx`
- `ThemeToggle` component always placed in the top header/navbar
- `defaultTheme="system"` — respect OS preference
- Never hardcode light or dark only without a switcher

### Colours — Semantic Tokens Only
```tsx
// ❌ NEVER — breaks dark mode
<div className="bg-white text-gray-900 border-gray-200">

// ✅ ALWAYS — works in both modes
<div className="bg-card text-card-foreground border-border">
```

| Token | Use for |
|-------|---------|
| `bg-background` | Page background |
| `bg-card` | Card / panel background |
| `bg-muted` | Subtle secondary background |
| `bg-primary` | Brand colour — buttons, active states |
| `text-foreground` | Primary body text |
| `text-muted-foreground` | Secondary / helper text |
| `border-border` | Default borders |
| `ring-ring` | Focus rings |

### Framer Motion — MANDATORY ON EVERY COMPONENT

Every component must have intentional animation. Import variants only from `lib/animations.ts` — never inline.

| Component type | Required animation |
|---------------|-------------------|
| Every page | `pageVariants` — fade + slide up |
| Every list/grid | `listContainerVariants` + `listItemVariants` — stagger |
| Every card | `listItemVariants` + `whileHover={cardHoverVariants.hover}` |
| Every modal/dialog | `modalVariants` with `AnimatePresence` |
| Every side panel | `slideInVariants` |
| Every button | `whileTap={{ scale: 0.97 }}` |
| Every dropdown | fade + scale from origin |
| Every table row | stagger fade in |
| Every badge | `initial={{ scale: 0 }} animate={{ scale: 1 }}` |
| Theme toggle icon | `AnimatePresence` y-axis swap |

```tsx
// ❌ WRONG — inline definition
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

// ✅ CORRECT — from lib/animations.ts
import { listItemVariants } from "@/lib/animations"
<motion.div variants={listItemVariants} initial="hidden" animate="visible">
```

Always wrap conditional renders with `<AnimatePresence>`.
Never animate `width` or `height` — use `scaleX` / `scaleY` instead.

### Admin Panel UI Rules
- Sidebar active item: `bg-primary/10 text-primary border-l-2 border-primary` + `whileHover={{ x: 2 }}`
- Stats cards: coloured icon bg (`bg-primary/10`), gradient accent, coloured badge
- Never all-grey UI — always use primary colour on key elements
- Every loading state: `LoadingSkeleton` matching the actual layout shape
- Every empty state: icon/illustration + primary action button — never just text

---

## 🔧 BACKEND RULES

### Response Helpers (always use these — never `res.json()` directly)
```typescript
sendSuccess(res, data, message, status?)   // from utils/response.ts
sendError(res, message, status)            // from utils/response.ts
```

### Middleware Chain Order
```
authenticate → checkPermission(module, action) → controller
```

### Permission Modules
```
"dashboard" | "users" | "roles" | "leads" | "teams" | "courses" | "reminders" | "reports" | "settings"
```

### Super Admin Bypass
`role.isSystemRole === true && role.roleName === "Super Admin"` → skip all permission checks.

### Mongoose Rules
```typescript
// Read-only → always lean()
const leads = await Lead.find({ team: teamId }).lean()

// Embedded array update → always arrayFilters
await Lead.updateOne(
  { _id: leadId, reminders: { $elemMatch: { _id: reminderId } } },
  { $set: { "reminders.$[r].notifiedAt": new Date() } },
  { arrayFilters: [{ "r._id": reminderId }] }
)

// Populated ObjectId → always use ._id.toString()
// ❌ m.toString()       → "[object Object]"
// ✅ m._id.toString()   → "507f1f..."

// insertMany → always check result length
const result = await Lead.insertMany(docs, { ordered: false })
if (result.length < docs.length) { /* handle silent failures */ }
```

### Route Ordering — Static Before Parameterized
```typescript
// ✅ CORRECT
router.get("/mine", authenticate, getMyLeads)
router.post("/upload", authenticate, uploadLead)
router.get("/:id", authenticate, getLead)      // ← always last

// ❌ WRONG — /mine gets caught by /:id
router.get("/:id", authenticate, getLead)
router.get("/mine", authenticate, getMyLeads)  // never reached
```

### Error Throwing
```typescript
const err = new Error("Lead not found") as any
err.statusCode = 404
throw err  // caught by global errorHandler middleware
```

### IST Timezone
- Store dates as UTC in MongoDB
- Frontend sends IST strings with `+05:30` offset — JS `new Date()` handles conversion
- Reminder scheduler compares `remindAt` (UTC) against `new Date()` (UTC) — no conversion needed

---

## 🖥 FRONTEND RULES

### Package Versions (pinned — same as this project)
```json
{
  "next": "14.2.5",
  "react": "^18.3.1",
  "typescript": "^5.5.3",
  "tailwindcss": "^3.4.6",
  "framer-motion": "^11.3.2",
  "next-themes": "^0.3.0",
  "@tanstack/react-query": "^5.51.1",
  "zustand": "^4.5.4",
  "react-hook-form": "^7.52.1",
  "zod": "^3.23.8",
  "axios": "^1.7.2",
  "sonner": "^1.5.0",
  "lucide-react": "^0.411.0",
  "recharts": "^3.8.1",
  "socket.io-client": "^4.8.3"
}
```

### All Server State Through React Query
```tsx
// ❌ Never
const [data, setData] = useState([])
useEffect(() => { axios.get('/leads').then(r => setData(r.data)) }, [])

// ✅ Always
const { data, isLoading, error } = useLeads(filters)
```

### Always Handle All Three States
```tsx
if (isLoading) return <LoadingSkeleton variant="table" />
if (error) return <ErrorState message={error.message} />
if (!data?.length) return <EmptyState title="No leads found" />
return <DataTable data={data} columns={columns} />
```

### Form Pattern
```tsx
const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
const { mutate, isPending } = useCreateLead()

function onSubmit(values: z.infer<typeof schema>) {
  mutate(values, {
    onSuccess: () => {
      toast.success("Lead created")
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      onClose()
      form.reset()
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? err.message),
  })
}
```

### IST Date Rules
```tsx
// Convert ISO → datetime-local input (always IST)
function toDatetimeLocal(iso: string): string {
  return new Date(iso)
    .toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" })
    .slice(0, 16).replace(" ", "T")
}

// Parse datetime-local as IST (not UTC)
const date = new Date(`${datetimeLocalValue}:00+05:30`)

// Display with IST label
function formatIST(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  }) + " IST"
}
```

### Notification Rules
```typescript
// ❌ Never — crashes Android Chrome
new Notification(title, { body })

// ✅ Always — use ServiceWorker
const reg = await navigator.serviceWorker.ready
reg.showNotification(title, { body, icon: "/icon.png" })
```

### Global Components — Always Reuse, Never Rebuild
| Component | File | Purpose |
|-----------|------|---------|
| `DataTable` | `shared/DataTable.tsx` | All tables |
| `Pagination` | `shared/Pagination.tsx` | Page navigation |
| `ResponsiveModal` | `shared/ResponsiveModal.tsx` | All modals |
| `ConfirmDialog` | `shared/ConfirmDialog.tsx` | All delete confirmations |
| `PageHeader` | `shared/PageHeader.tsx` | Page title + action slot |
| `EmptyState` | `shared/EmptyState.tsx` | Empty lists |
| `LoadingSkeleton` | `shared/LoadingSkeleton.tsx` | Loading placeholders |
| `SearchInput` | `shared/SearchInput.tsx` | Debounced search |
| `ThemeToggle` | `shared/ThemeToggle.tsx` | Light/Dark/System switcher |

Check `frontend/componentsHistory.md` before creating any new component.

---

## 🔌 REALTIME — Socket.io Events

### Helper Functions
```typescript
emitToUser(userId, event, payload)       // emit to specific user
emitTeamUpdate(teamId, event, payload)   // emit to team room
```

### Key Events
| Event | Direction | When |
|-------|-----------|------|
| `reminder:due` | server→client | Reminder fires exactly on time |
| `reminder:warning` | server→client | 30 min before reminder |
| `team:update` | server→client | Any team change |
| `lead:assigned` | server→client | Lead assigned to user |
| `join:team` | client→server | User joins team room |

See `backend/socketHistory.md` for full event list, rooms, and payload shapes.

---

## 🗂 VS CODE CONFIG — Auto-Create If Missing

On first session, create `.vscode/` with:

**`launch.json`** — 4 configs:
- `Bun — Dev Server` (backend on port 5001)
- `Bun — Run Tests` (`bun test tests/ --timeout 15000`)
- `Next.js — Dev Server` (frontend on port 3000, `serverReadyAction` → opens browser)
- `🚀 Full Stack — Backend + Frontend` (compound, starts both)

**`settings.json`** — Key settings:
- `"editor.formatOnSave": true`
- `"editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" }`
- `"typescript.tsdk": "node_modules/typescript/lib"`
- `"tailwindCSS.experimental.classRegex"` → `cn()`, `cva()`, `cx()` support
- `"files.exclude"` → hide `node_modules`, `.next`, `dist`

**`extensions.json`** — Recommended:
`esbenp.prettier-vscode`, `dbaeumer.vscode-eslint`, `bradlc.vscode-tailwindcss`,
`usernamehw.errorlens`, `eamodio.gitlens`, `mongodb.mongodb-vscode`,
`ms-vscode.vscode-typescript-next`, `PKief.material-icon-theme`

**`tasks.json`** — Tasks (Cmd+Shift+B):
- `🟢 Backend: Start Dev Server`
- `🌐 Frontend: Start Dev Server`
- `🚀 Full Stack: Start Both Servers`
- `🧪 Backend: Run All Tests`
- `🏗 Frontend: Build`
- `🔍 Frontend: Type Check`

---

## 🧠 MEMORY SYSTEM

Memory lives at: `~/.claude/projects/-Users-mhdabshar-delta-carlton-crm/memory/`

| File | Contents |
|------|---------|
| `MEMORY.md` | Index of all memory files |
| `user_profile.md` | Developer, full-stack, IST timezone |
| `feedback_confirm_before_code.md` | Summarise + ask before writing code |
| `feedback_testing_subagent.md` | 4-case sub-agent testing after every change |
| `project_overview.md` | Full Carlton CRM stack, ports, collections |
| `project_docs_system.md` | All MD files and their purposes |

Save a memory when:
- User corrects an approach → `feedback` memory
- User mentions a preference or timezone → `user` memory
- User shares a decision, deadline, or "why" → `project` memory

---

## 📚 DOCUMENTATION FILES — Read Before Coding

### Backend (read before any backend change)
| File | Read When |
|------|-----------|
| `backend/AGENTS.md` | Every backend task |
| `backend/mistakes.md` | Before Mongoose array ops, bulk inserts, route definitions |
| `backend/servicesHistory.md` | Before creating any service method |
| `backend/logicHistory.md` | Before implementing any business logic |
| `backend/features.md` | Before building any feature |
| `backend/socketHistory.md` | Before emitting any socket event |
| `backend/middlewareHistory.md` | Before adding any route |

### Frontend (read before any frontend change)
| File | Read When |
|------|-----------|
| `frontend/agents.md` | Every frontend task |
| `frontend/mistakes.md` | Before writing similar code to a past bug |
| `frontend/componentsHistory.md` | Before creating any UI component |
| `frontend/apiHistory.md` | Before adding any API call |
| `frontend/features.md` | Before building any feature |
| `frontend/design.md` | Before writing any styles or colours |

### Project-Level
| File | Read When |
|------|-----------|
| `PROJECT_STATUS.md` | **Start of every session — read first** |
| `PLAN.md` | Before every task — understand current phase + feature |
| `AGENT_BOOTSTRAP.md` | Full universal rules — reference for any topic not covered here |

---

## 🔁 QUICK REFERENCE — What Happens Automatically

| Trigger | Auto action |
|---------|-------------|
| Session starts | Read `PROJECT_STATUS.md` → Read `PLAN.md` → detect env → install deps → create `.vscode/` if missing → start both servers → open browser → screenshot |
| No `PLAN.md` | Planning agent → phase-by-phase plan → wait for approval |
| Phase starts | Announce phase + feature list → start Feature 1 |
| Feature starts | Announce feature + tasks → build backend → build frontend → 4-case test → screenshot → wait for confirm |
| Feature confirmed | Tick ✅ in `PLAN.md` → announce next feature → wait for confirm |
| Phase complete | All features ✅ → phase report + screenshot → wait for confirm before Phase N+1 |
| New Next.js frontend | Design interview → `design.md` → `create-next-app@14.2.5` → install pinned packages → `ThemeProvider` + `ThemeToggle` → start server → screenshot light + dark |
| Any UI code change | Reload preview → screenshot → show to user immediately |
| Any code change | Sub-agent 4-case test → report |
| Test fails | Fix immediately → re-run all 4 → log in `mistakes.md` |
| New component | Log in `frontend/componentsHistory.md` |
| New API call | Log in `frontend/apiHistory.md` |
| New service method | Log in `backend/servicesHistory.md` |
| New feature built | Log in `features.md` (backend + frontend) |
| Bug found + fixed | Log in `mistakes.md` (backend or frontend) |
| Session ends | Update `PROJECT_STATUS.md` — last item, pending issues, health check, change log |
| User corrects approach | Save feedback memory immediately |

---

## 📝 CODE QUALITY — Universal Rules

### TypeScript
- **Zero `any`** — use proper types or `unknown` + narrow
- All props: explicit `interface XProps {}`
- All API responses: typed in `types/` — never inline
- Use `z.infer<typeof schema>` for form value types

### Component Structure Order
```tsx
// 1. Imports
// 2. Types / interfaces
// 3. Constants + Zod schemas (outside component)
// 4. Component function
//    a. Hooks (useQuery, useState, etc.)
//    b. Derived values
//    c. Event handlers
//    d. Return JSX
// 5. Tightly-coupled sub-components (if small)
```

### Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Services: `camelCase` class, `verbNoun` methods (`getLeads`, `createLead`)
- Constants: `UPPER_SNAKE_CASE`
- API types: `ILead`, `ITeam`, `IUser`

### Git Commits
```
feat(leads): add bulk status update endpoint
fix(reminders): prevent duplicate notifications on reload
refactor(teams): extract member toggle into service method
```
Never commit `.env` files, secrets, or large binaries.
