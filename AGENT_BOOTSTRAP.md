# AGENT BOOTSTRAP — Universal Rules

> Drop into any project. Read fully before every session. All rules are mandatory.
> Carlton CRM specifics → `CLAUDE.md` | Templates & full detail → `AGENT_BOOTSTRAP_DETAIL.md`

---

## 🚀 FIRST LOAD (run automatically, no need to ask)

1. **Check env** — `node/bun/python/go --version`. If missing → install via Homebrew (mac) / apt (linux) / winget (windows)
2. **Install deps** — detect lockfile → run `bun install` / `npm install` / `pip install -r requirements.txt` / `go mod tidy`
3. **Check `PLAN.md`** — missing + new project → run Planning Agent first
4. **Check `PROJECT_STATUS.md`** — missing → create it. Exists → read it fully
5. **Check `.vscode/`** — missing → create `launch.json`, `settings.json`, `extensions.json`, `tasks.json`
6. **Check docs** — missing any of `AGENTS.md`, `mistakes.md`, `features.md`, `servicesHistory.md`, `logicHistory.md`, `middlewareHistory.md`, `socketHistory.md`, `componentsHistory.md`, `apiHistory.md` → create with starter template
7. **Start servers** — run dev server in background → poll port → `preview_start` → `preview_screenshot` → `open http://localhost:PORT`
8. **Confirm ready** — show env detected, stack, server URL, screenshot

---

## ⚡ MANDATORY RESPONSE PROTOCOL (every code change)

**Step 1 — Summarise first (NO code yet)**
```
## 📋 Change Summary
What I understood: →
What I plan to change: file → what + why
APIs / services: hook / method / endpoint
Questions (if any): 1.
✅ Confirm to proceed.
```

**Step 2 — Wait** — no code until user confirms ("yes / go / ok / proceed")

**Step 3 — Pre-code checklist** — read `mistakes.md` → `servicesHistory.md` → `componentsHistory.md` → `apiHistory.md` → then write code → update relevant `.md` files

**Step 4 — Sub-agent: 4 test cases**
| Case | Tests |
|------|-------|
| 1 — Happy Path | Normal usage, valid input |
| 2 — Edge | Empty list, min/max, zero results |
| 3 — Invalid Input | Missing fields, bad IDs, wrong types |
| 4 — Permission/Auth | No token (401), wrong role (403) |

Fix any failure immediately → re-run all 4 → log bug in `mistakes.md`.

**Step 5 — Report** — files changed + docs updated + `Case 1 ✅ | Case 2 ✅ | Case 3 ✅ | Case 4 ✅`

> **Skip steps 1–2 only for:** typo fixes and read-only tasks.

---

## 🗺 PLANNING — Phase → Feature → Confirm

**When:** No `PLAN.md`, or user says "plan / design / new feature".

**Structure:** Plan has phases. Each phase has numbered features. Build one feature at a time.

**Execution loop:**
```
Announce phase → Announce Feature N.X (backend tasks + frontend tasks + tests)
→ Build backend → Build frontend → 4-case test → screenshot
→ Feature report → WAIT FOR CONFIRM → next feature
→ [all features done] → Phase report → WAIT FOR CONFIRM → next phase
```

`PLAN.md` updated continuously: `⬜ Not started` → `🚧 In Progress` → `✅ Done`

**Present plan as:** phase blocks with features listed inside, task counts, goal per phase. End with: *"Ready to start Phase 1 → Feature 1.1. ✅ Confirm to begin."*

---

## 🌐 DEV SERVER & PREVIEW

- Start backend + frontend in background. Poll port (max 10s).
- `preview_start` → `preview_screenshot` → show user → `open http://localhost:PORT`
- After every UI change: reload (`preview_eval: window.location.reload()`) → screenshot → show
- Verify: `preview_console_logs` (errors?) + `preview_resize(375)` (mobile?) + `preview_network` (failed calls?)

---

## 🎨 FRONTEND SCAFFOLDING (Next.js projects)

**Before any code — design interview:**
1. Primary colour + hex  2. Light/Dark/Both (theme switcher always included)  3. Font: **Poppins / DM Sans / Inter** (only these 3)  4. Visual style  5. Border radius  6. Animation feel  7. Density  8. Reference/inspiration

**After interview** → write `frontend/design.md` → then scaffold.

**Scaffold command:** `npx create-next-app@14.2.5 [name] --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git`

**Mandatory packages (pinned):**
`next-themes@^0.3.0` · `framer-motion@^11.3.2` · `@tanstack/react-query@^5.51.1` · `zustand@^4.5.4` · `react-hook-form@^7.52.1` · `zod@^3.23.8` · `axios@^1.7.2` · `sonner@^1.5.0` · `lucide-react@^0.411.0` · `recharts@^3.8.1` · `tailwind-merge@^2.4.0` · `clsx@^2.1.1`

**Always create:** `ThemeProvider.tsx` + `ThemeToggle.tsx` (in header always) + `lib/animations.ts` (all Framer Motion variants here, never inline)

**Design rules (zero exceptions):**
- Never `bg-white` / `text-gray-900` → always semantic tokens (`bg-background`, `text-foreground`, `bg-primary`)
- Framer Motion animation on **every** component — import from `lib/animations.ts`
- `<AnimatePresence>` wraps every conditional render
- Dark mode works on every component from day one
- Mobile-first — every component works at 375px

---

## 🗂 VS CODE — `.vscode/` (create if missing)

| File | Contents |
|------|---------|
| `launch.json` | Debug configs per stack + compound "Full Stack" (F5 starts all) |
| `settings.json` | `formatOnSave`, ESLint fix on save, Tailwind `cn()`/`cva()` regex, TS workspace SDK |
| `extensions.json` | Prettier, ESLint, Tailwind IntelliSense, ErrorLens, GitLens, stack-specific |
| `tasks.json` | Start servers, run tests, build, lint (Cmd+Shift+B) |

---

## 📋 PROJECT_STATUS.md — Every Session

**Create** on first session. **Read first** every new session. **Update** at session end.

Sections: Project summary · What exists (feature status table) · Last working item · Pending issues (P0→P3 with debug steps) · Completed this session · Tech debt · Architecture · Key concepts · DB schema · API endpoints · **Critical warnings** · Health check · Testing status · Integrations · Upcoming tasks · Credentials · Change log

---

## 🧠 MEMORY

Save when: user corrects approach → `feedback` | user mentions preference/timezone → `user` | decision/deadline shared → `project`

Format: `name`, `type`, `description`, body with **Why:** and **How to apply:**

---

## 📚 DOCS — Update After Every Change

| Changed | Update |
|---------|--------|
| New component | `componentsHistory.md` |
| New API call | `apiHistory.md` |
| New service method | `servicesHistory.md` |
| New feature | `features.md` (backend + frontend) |
| Bug fixed | `mistakes.md` |
| New route | `middlewareHistory.md` |
| New socket event | `socketHistory.md` |
| New logic/algorithm | `logicHistory.md` |
