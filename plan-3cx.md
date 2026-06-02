# 3CX Integration — Delta Institutions CRM
> Living document. Update status after every completed step.
> Last updated: 2026-04-28

---

## 🟢 Project Status

| Item | Status |
|------|--------|
| Backend server | ✅ Running on port 5001 |
| Frontend server | ✅ Running on port 3000 |
| 3CX XML uploaded to admin | ✅ Done — `https://api-crm.deltainstitutions.com/api/v1/calls/` |
| Call journaling active | ✅ Inbound/outbound calls auto-log to `call_logs` collection |
| Contact lookup live | ✅ 3CX resolves caller name from CRM on every inbound call |

---

## ✅ Phase 1 — Core Integration (COMPLETE)

| # | What | Files | Status |
|---|------|-------|--------|
| 1.1 | ClickToCall button (leads table + lead detail) | `components/leads/ClickToCall.tsx`, `leads/page.tsx`, `leads/[leadId]/page.tsx` | ✅ Done |
| 1.2 | CallsPanel — call history + recordings per lead | `components/leads/CallsPanel.tsx`, `hooks/useCalls.ts` | ✅ Done |
| 1.3 | 3CX OAuth token cache | `callController.ts` — `get3cxToken()` | ✅ Done |
| 1.4 | CallLog Mongoose model | `backend/src/models/CallLog.ts` | ✅ Done |
| 1.5 | contact-lookup endpoint | `GET /api/v1/calls/contact-lookup` — flat object response | ✅ Done |
| 1.6 | contact-search endpoint | `GET /api/v1/calls/contact-search` — contacts array | ✅ Done |
| 1.7 | contact-create endpoint | `POST /api/v1/calls/contact-create` — idempotent upsert | ✅ Done |
| 1.8 | journal endpoint | `POST /api/v1/calls/journal` — 3CX posts call details | ✅ Done |
| 1.9 | webhook endpoint | `GET+POST /api/v1/calls/webhook` — 3CX Parameters format | ✅ Done |
| 1.10 | click-to-call log endpoint | `POST /api/v1/calls/click` — auth, persists to CallLog | ✅ Done |
| 1.11 | recent calls endpoint | `GET /api/v1/calls/recent` — auth, last N calls | ✅ Done |
| 1.12 | lead call history endpoint | `GET /api/v1/calls/lead/:leadId` — local DB first, 3CX fallback | ✅ Done |
| 1.13 | XML template endpoint | `GET /api/v1/calls/3cx-template` — correct `<Crm>` schema | ✅ Done |
| 1.14 | XML uploaded to 3CX admin | Manual step | ✅ Done |
| 1.15 | Extension saved on all 13 agents in DB | Direct DB update | ✅ Done |

---

## 🔨 Phase 2 — Agent & Manager Tools (IN PROGRESS)

### Step 5 — Extension Field on User Schema ✅ COMPLETE

| Task | File | Status |
|------|------|--------|
| Add `extension` to `IUser` interface | `backend/src/types/index.ts` | ✅ |
| Add `extension` field to User schema | `backend/src/models/User.ts` | ✅ |
| Add `extension` to Zod validation (backend) | `backend/src/validations/userValidation.ts` | ✅ |
| Add `extension` to updateUser service | `backend/src/services/userService.ts` | ✅ |
| Add `extension` to frontend `User` type | `delta/types/index.ts` | ✅ |
| Add `extension` to frontend Zod schema | `delta/lib/validations/userSchema.ts` | ✅ |
| Extension column on Users list table | `delta/app/(dashboard)/users/page.tsx` | ✅ |
| Extension field in Create/Edit User dialog | `delta/components/users/UserDialog.tsx` | ✅ |
| Extension chip on User detail page | `delta/app/(dashboard)/users/[userId]/page.tsx` | ✅ |
| Extension chip on Profile page | `delta/app/(dashboard)/profile/page.tsx` | ✅ |

---

### Step 3 — Recent Calls Dashboard Page ✅ COMPLETE

| Task | File | Status |
|------|------|--------|
| Add `useRecentCalls()` hook + `RecentCallLog` type | `delta/hooks/useCalls.ts` | ✅ |
| Create Recent Calls page | `delta/app/(dashboard)/calls/page.tsx` | ✅ |
| Add `Calls` nav link to sidebar | `delta/components/layout/Sidebar.tsx` | ✅ |

**Page features built:**
- 5 stat cards: Total, Inbound, Outbound, Missed, Recordings
- Table: date/time, lead name (linked to lead detail), phone, call type badge with icon, duration, agent + ext badge, recording player
- Filters: search (lead/phone/agent), call type, direction, agent dropdown
- Animated clear-filters button when filters active
- ClickToCall button per row (hover reveal)
- Empty state with context-aware message

---

### Step 4 — Settings Page — 3CX Setup Guide ✅ COMPLETE
**Goal:** Settings page at `/settings` with XML download + setup steps.

| Task | File | Status |
|------|------|--------|
| Add 3CX section to existing Settings page | `delta/app/(dashboard)/settings/page.tsx` | ✅ |
| XML download button → `/api/v1/calls/3cx-template` | inline in page | ✅ |
| Sidebar nav link | already existed | ✅ |

**3CX section features built:**
- Integration status badges (Contact Lookup, Journaling, Click-to-Call, Recordings — all green)
- API endpoint reference table (Base URL, contact-lookup, contact-search, journal, webhook)
- Setup checklist — 5 steps with green checkmarks (all complete)
- Download XML Template button (opens production URL)
- Copy API URL button (clipboard)
- Open 3CX Admin button

---

### Step 2 — QC Review System ✅ COMPLETE
**Goal:** Managers listen to recordings, rate 1–5 stars, flag/approve calls.

| Task | File | Status |
|------|------|--------|
| `GET /calls/qc-queue` endpoint | `callController.ts` | ✅ |
| `PUT /calls/:callId/qc` endpoint | `callController.ts` | ✅ |
| `GET /calls/:callId` endpoint | `callController.ts` | ✅ |
| Add routes | `callRoutes.ts` | ✅ |
| `useQcQueue()` hook + `useUpdateQc()` + `useCallById()` | `delta/hooks/useCalls.ts` | ✅ |
| QC Review page | `delta/app/(dashboard)/calls/qc/page.tsx` | ✅ |

**Page features built:**
- Expandable QC cards — click to expand rating + notes panel
- Inline recording player (play/pause per card)
- Star rating 1–5 with hover animation
- Notes textarea
- Approve / Flag Issue / Save Draft buttons
- Mini stat badges (Pending / Approved / Flagged counts)
- Status filter dropdown (Pending / Approved / Flagged / All)
- Loading skeletons + empty states per status
- Refresh button

---

### Step 6 — Single Call Detail Page ✅ COMPLETE
**Goal:** Dedicated page per call — full info, recording, QC section.

| Task | File | Status |
|------|------|--------|
| `GET /calls/:callId` endpoint (shared with QC) | `callController.ts` | ✅ |
| Single call detail page | `delta/app/(dashboard)/calls/[callId]/page.tsx` | ✅ |

**Page features built:**
- Breadcrumb with ← back to Calls
- Hero header — call type icon, phone/contact name, call type + QC status badges
- Call Details card — date/time, duration, phone, agent, extension, initiated by, source, lead link
- Recording card — HTML5 audio player or "no recording" empty state
- QC Review panel (sticky sidebar) — current status, star rating 1–5, notes textarea, Approve/Flag/Save buttons
- Loading skeletons + "Call not found" empty state
- Fully linked from QC queue and Calls table

---

## 📦 Endpoints Reference

| Method | Path | Auth | Called By | Status |
|--------|------|------|-----------|--------|
| GET | `/calls/contact-lookup` | None | 3CX (inbound call) | ✅ |
| GET | `/calls/contact-search` | None | 3CX (search) | ✅ |
| POST | `/calls/contact-create` | None | 3CX (unknown caller) | ✅ |
| POST | `/calls/journal` | None | 3CX (call ends) | ✅ |
| GET | `/calls/webhook` | None | 3CX Parameters (GET) | ✅ |
| POST | `/calls/webhook` | None | 3CX ReportCall (POST) | ✅ |
| GET | `/calls/3cx-template` | None | Admin download | ✅ |
| POST | `/calls/click` | Auth | CRM frontend | ✅ |
| GET | `/calls/recent` | Auth | Recent calls page | ✅ |
| GET | `/calls/lead/:leadId` | Auth | Lead detail page | ✅ |
| GET | `/calls/qc-queue` | Auth | QC page | ✅ |
| PUT | `/calls/:callId/qc` | Auth | QC page | ✅ |
| GET | `/calls/:callId` | Auth | Call detail page | ✅ |

---

## 🔑 Key Facts

| Item | Value |
|------|-------|
| 3CX URL | `https://deltainstitutions.3cx.ae:5002` |
| 3CX Client ID | `deltaleads` |
| Production API | `https://api-crm.deltainstitutions.com` |
| Frontend URL | `https://crm.deltainstitutions.com` |
| MongoDB | `mongodb://delta:123@82.25.109.155:27017/crm_db__delta_v1` |
| CallLog collection | `calllogs` |
| Agents with extension | 13 agents — extensions already in DB |

---

## 🐛 Known Issues / Bugs Fixed

| Bug | Fix | Date |
|-----|-----|------|
| XML used wrong `<CRMTemplate>` schema | Rewrote to `<Crm>` schema matching 3CX format | 2026-04-28 |
| `contactLookup` returned `{ contacts: [] }` array | Fixed to return flat `{ contact_id, first_name... }` | 2026-04-28 |
| `journalCall` hung on missing `phone_number` | Added validation guard + try/catch | 2026-04-28 |
| `journalCall` hung on invalid `call_date` | Validate with `isNaN()`, fallback to `new Date()` | 2026-04-28 |
| `req.user._id` doesn't exist on AuthenticatedRequest | Use `req.user.userId` | 2026-04-28 |
| Wrong middleware import path in callRoutes | Fixed to `../middleware/auth.js` | 2026-04-28 |
