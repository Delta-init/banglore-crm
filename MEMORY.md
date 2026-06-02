# Carlton CRM — Full Project Memory

> Complete history, architecture, endpoints, components, hooks, and feature log.
> Last updated: 2026-03-28

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Environment Variables](#4-environment-variables)
5. [Backend — All API Endpoints](#5-backend--all-api-endpoints)
6. [Backend — Database Models](#6-backend--database-models)
7. [Backend — Services](#7-backend--services)
8. [Backend — Middleware](#8-backend--middleware)
9. [Frontend — Pages](#9-frontend--pages)
10. [Frontend — Components](#10-frontend--components)
11. [Frontend — Hooks](#11-frontend--hooks)
12. [Frontend — Types](#12-frontend--types)
13. [Frontend — Lib / Stores](#13-frontend--lib--stores)
14. [Feature Build History](#14-feature-build-history)
15. [Key Conventions & Patterns](#15-key-conventions--patterns)
16. [Permission System](#16-permission-system)
17. [Lead Status Reference](#17-lead-status-reference)
18. [MCP & AI Configuration](#18-mcp--ai-configuration)

---

## 1. Project Overview

Carlton CRM is a full-stack Customer Relationship Management system for a sales team.
It manages leads, users, teams, courses, reports, reminders, and AI-assisted lead conversations.

**Key capabilities:**
- Lead lifecycle management (create → assign → followup → close/book)
- Role-based access control (RBAC) with granular per-module permissions
- Team management with member statistics and bulk lead operations
- Reports with charts, rankings, and Excel/PDF export
- Push notifications + real-time socket updates
- Google Sheets bulk lead sync (via API key)
- Reminders with browser notifications at due-time and −30 min
- AI Memory assistant per lead (powered by Anthropic Claude)
- MCP integration for Claude Code (MongoDB + filesystem)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Backend framework | Express 4 + TypeScript |
| Database | MongoDB via Mongoose 8 |
| Auth | JWT (access token 7d + refresh token 30d) |
| Validation | Zod |
| Real-time | Socket.io 4 |
| Push | Web Push (VAPID) |
| PDF | PDFKit |
| Excel | xlsx |
| AI | Anthropic SDK (`claude-sonnet-4-6`) |
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript |
| UI | ShadCN (Radix primitives) + TailwindCSS + Framer Motion |
| Server state | TanStack React Query 5 |
| Client state | Zustand 4 |
| Icons | Lucide React |
| Charts | Recharts |
| Toast | Sonner |
| HTTP client | Axios |
| Forms | React Hook Form + Zod |
| PWA | @ducanh2912/next-pwa |

---

## 3. Folder Structure

```
crm/
├── .mcp.json                  ← MCP server config for Claude Code
├── CLAUDE.md                  ← Claude Code project context
├── MEMORY.md                  ← This file
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts    ← MongoDB connect
│   │   │   └── env.ts         ← Zod-validated env schema
│   │   ├── controllers/
│   │   │   ├── aiController.ts
│   │   │   ├── authController.ts
│   │   │   ├── courseController.ts
│   │   │   ├── exportController.ts
│   │   │   ├── leadController.ts
│   │   │   ├── pushController.ts
│   │   │   ├── reportController.ts
│   │   │   ├── roleController.ts
│   │   │   ├── sheetsController.ts
│   │   │   ├── teamController.ts
│   │   │   └── userController.ts
│   │   ├── middleware/
│   │   │   ├── apiKeyAuth.ts
│   │   │   ├── auth.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── permissions.ts
│   │   ├── models/
│   │   │   ├── AiMemory.ts
│   │   │   ├── Course.ts
│   │   │   ├── Lead.ts
│   │   │   ├── PushSubscription.ts
│   │   │   ├── Role.ts
│   │   │   ├── Team.ts
│   │   │   ├── TeamMessage.ts
│   │   │   └── User.ts
│   │   ├── routes/
│   │   │   ├── aiRoutes.ts
│   │   │   ├── authRoutes.ts
│   │   │   ├── courseRoutes.ts
│   │   │   ├── index.ts
│   │   │   ├── leadRoutes.ts
│   │   │   ├── pushRoutes.ts
│   │   │   ├── reportRoutes.ts
│   │   │   ├── roleRoutes.ts
│   │   │   ├── sheetsRoutes.ts
│   │   │   ├── teamRoutes.ts
│   │   │   ├── userLeadRoutes.ts
│   │   │   └── userRoutes.ts
│   │   ├── services/
│   │   │   ├── authService.ts
│   │   │   ├── courseService.ts
│   │   │   ├── excelService.ts
│   │   │   ├── leadService.ts
│   │   │   ├── pushService.ts
│   │   │   ├── reportService.ts
│   │   │   ├── roleService.ts
│   │   │   ├── teamService.ts
│   │   │   └── userService.ts
│   │   ├── types/index.ts
│   │   ├── utils/
│   │   │   ├── jwt.ts
│   │   │   └── response.ts
│   │   ├── validations/
│   │   ├── socket.ts
│   │   └── index.ts           ← Entry point
│   ├── .env
│   └── package.json
└── frontend/
    ├── app/
    │   ├── (auth)/login/
    │   ├── (dashboard)/
    │   │   ├── layout.tsx
    │   │   ├── dashboard/
    │   │   ├── leads/
    │   │   │   ├── page.tsx
    │   │   │   ├── [leadId]/page.tsx
    │   │   │   └── upload/page.tsx
    │   │   ├── reminders/page.tsx
    │   │   ├── teams/
    │   │   │   ├── page.tsx
    │   │   │   └── [teamId]/page.tsx
    │   │   ├── users/
    │   │   │   ├── page.tsx
    │   │   │   └── [userId]/page.tsx
    │   │   ├── roles/page.tsx
    │   │   ├── courses/page.tsx
    │   │   ├── reports/page.tsx
    │   │   └── profile/page.tsx
    │   └── offline/page.tsx
    ├── components/
    │   ├── auth/
    │   ├── courses/
    │   ├── layout/
    │   ├── leads/
    │   ├── notifications/
    │   ├── reports/
    │   ├── roles/
    │   ├── teams/
    │   ├── users/
    │   └── ui/   ← ShadCN primitives
    ├── hooks/
    ├── lib/
    │   ├── axios.ts
    │   ├── socket.ts
    │   ├── utils.ts
    │   └── store/
    ├── types/
    ├── public/
    ├── .env.local
    └── package.json
```

---

## 4. Environment Variables

### Backend (`backend/.env`)
```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/crm_db
JWT_SECRET=...
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=30d
SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_EMAIL=superadmin@crm.com
SUPER_ADMIN_PASSWORD=SuperAdmin@123
CLIENT_URL=http://localhost:3000
SHEETS_API_KEY=carlton_sheets_key_...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@carltoncrm.com
ANTHROPIC_API_KEY=sk-ant-...   ← Required for AI Memory feature
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

---

## 5. Backend — All API Endpoints

All routes prefixed with **`/api/v1`**. Protected routes require `Authorization: Bearer <token>`.

---

### AUTH — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | ✗ | Login with email + password, returns access + refresh tokens |
| POST | `/auth/refresh-token` | ✗ | Exchange refresh token for new access token |
| GET | `/auth/profile` | ✓ | Get authenticated user's own profile |
| PUT | `/auth/change-password` | ✓ | Change own password |

---

### USERS — `/users`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/users` | users.view | List all users (paginated, searchable) |
| POST | `/users` | users.create | Create new user |
| GET | `/users/profile` | self | Get own profile |
| GET | `/users/profile/export-pdf` | self | Export own profile as PDF |
| GET | `/users/:id` | users.view or self | Get user by ID |
| PUT | `/users/:id` | users.edit | Update user |
| DELETE | `/users/:id` | users.delete | Delete user |
| GET | `/users/:id/export-pdf` | users.view | Export user profile as PDF |
| GET | `/users/:userId/leads` | leads.view | Get leads assigned to user |
| GET | `/users/:userId/lead-stats` | leads.view | Get lead statistics for user |

---

### LEADS — `/leads`

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/leads/upload` | leads.create | Bulk upload leads from Excel/CSV |
| POST | `/leads/auto-assign` | leads.approve | Auto-assign unassigned leads |
| PATCH | `/leads/bulk/status` | leads.edit | Bulk update lead statuses |
| DELETE | `/leads/bulk` | leads.delete | Bulk delete leads |
| PATCH | `/leads/bulk/team` | leads.edit | Bulk assign leads to a team |
| GET | `/leads/reminders/mine` | leads.view | Get all reminders for current user |
| GET | `/leads/reminders/count` | leads.view | Get count of undone reminders |
| POST | `/leads` | leads.create | Create new lead (auto-assigns to creator) |
| GET | `/leads` | leads.view | List leads (paginated, filtered) |
| GET | `/leads/:id` | leads.view | Get lead details (notes, reminders, activity) |
| PUT | `/leads/:id` | leads.edit | Update lead fields |
| PATCH | `/leads/:id/status` | leads.edit | Update lead status only |
| PATCH | `/leads/:id/assign` | leads.edit | Assign lead to a user |
| PATCH | `/leads/:id/team` | leads.edit | Assign lead to a team |
| PATCH | `/leads/:id/transfer` | leads.edit | Transfer lead to another team |
| DELETE | `/leads/:id` | leads.delete | Delete lead |
| POST | `/leads/:id/notes` | leads.edit | Add note to lead |
| PUT | `/leads/:id/notes/:noteId` | leads.edit | Update a lead note |
| DELETE | `/leads/:id/notes/:noteId` | leads.edit | Delete a lead note |
| POST | `/leads/:id/reminders` | leads.edit | Add reminder to lead |
| PUT | `/leads/:id/reminders/:reminderId` | leads.edit | Update reminder (title/note/time/isDone) |
| DELETE | `/leads/:id/reminders/:reminderId` | leads.edit | Delete reminder |

**Query params for `GET /leads`:**
`page`, `limit`, `status`, `assignedTo`, `team`, `reporter`, `course`, `search`, `dateFrom`, `dateTo`

---

### TEAMS — `/teams`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/teams` | leads.view | List all teams |
| POST | `/teams` | leads.create | Create team |
| GET | `/teams/mine` | leads.view | Get current user's team |
| GET | `/teams/:id` | leads.view | Get team by ID (with leaders + members populated) |
| PUT | `/teams/:id` | leads.edit | Update team |
| DELETE | `/teams/:id` | leads.delete | Delete team |
| GET | `/teams/:id/dashboard` | leads.view | Team dashboard stats |
| GET | `/teams/:id/leads` | leads.view | Team's lead list (paginated) |
| GET | `/teams/:id/member-stats` | leads.view | Per-member statistics |
| GET | `/teams/:id/logs` | leads.view | Team activity log |
| POST | `/teams/:id/auto-assign` | leads.edit | Auto-assign team leads |
| PATCH | `/teams/:id/leads/bulk/assign` | leads.edit | Bulk assign team leads to a member |
| PATCH | `/teams/:id/leads/bulk/transfer` | leads.edit | Bulk transfer team leads |
| PATCH | `/teams/:id/leads/bulk/status` | leads.edit | Bulk update team lead statuses |
| PATCH | `/teams/:id/leads/:leadId/assign` | leads.edit | Assign single lead to member |
| GET | `/teams/:id/updates` | leads.view | Team updates feed |
| POST | `/teams/:id/messages` | leads.view | Post message to team feed |
| GET | `/teams/:id/export-pdf` | leads.view | Export team report as PDF |

> **Route ordering fix**: bulk routes (`/bulk/*`) are declared BEFORE `/:leadId/assign` to prevent Express treating "bulk" as a leadId.

---

### ROLES — `/roles`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/roles/all` | roles.view | All roles (simple list, no pagination) |
| GET | `/roles` | roles.view | Roles paginated |
| POST | `/roles` | roles.create | Create role |
| GET | `/roles/:id` | roles.view | Get role by ID |
| PUT | `/roles/:id` | roles.edit | Update role + permissions |
| DELETE | `/roles/:id` | roles.delete | Delete role |

---

### COURSES — `/courses`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/courses/all` | ✓ | All courses (dropdown, no pagination) |
| GET | `/courses` | ✓ | Courses paginated |
| GET | `/courses/:id` | ✓ | Get course by ID |
| POST | `/courses` | leads.create | Create course |
| PUT | `/courses/:id` | leads.edit | Update course |
| DELETE | `/courses/:id` | leads.delete | Delete course |

---

### REPORTS — `/reports`

All routes require `reports.view` permission.

| Method | Path | Description |
|---|---|---|
| GET | `/reports/overview` | Overall stats — totals by status, conversion |
| GET | `/reports/timeline` | Daily/weekly/monthly timeline data |
| GET | `/reports/users` | User performance rankings |
| GET | `/reports/teams` | Team performance rankings |
| GET | `/reports/team-split` | Split breakdown per team |
| GET | `/reports/export/excel` | Download Excel report |
| GET | `/reports/export/pdf` | Download PDF report |

**Query params:** `dateFrom` (YYYY-MM-DD), `dateTo` (YYYY-MM-DD), `period` (daily/weekly/monthly)

---

### AI MEMORY — `/ai`

All routes require JWT authentication.

| Method | Path | Description |
|---|---|---|
| POST | `/ai/chat/:leadId` | Send message; AI responds with full lead context + memory |
| GET | `/ai/memory/:leadId` | Get conversation history for this lead (current user) |
| DELETE | `/ai/memory/:leadId` | Clear conversation history |

**POST body:** `{ "message": "string" }`
**Model used:** `claude-sonnet-4-6` (max 40 messages retained per thread)

---

### PUSH NOTIFICATIONS — `/push`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/push/vapid-public-key` | ✓ | Get VAPID public key |
| POST | `/push/subscribe` | ✓ | Subscribe browser to push notifications |
| DELETE | `/push/unsubscribe` | ✓ | Unsubscribe browser |

---

### GOOGLE SHEETS SYNC — `/sheets`

Authentication: `x-api-key` header (value from `SHEETS_API_KEY` env var).

| Method | Path | Description |
|---|---|---|
| POST | `/sheets/sync` | Single-row sync from Google Sheets |
| POST | `/sheets/sync/batch` | Batch sync multiple rows |

---

### HEALTH

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{ status: "ok", timestamp }` |

---

## 6. Backend — Database Models

### User
```
name         String (required, max 100)
email        String (required, unique)
password     String (hashed, min 8)
role         ObjectId → Role
designation  String (max 100)
status       "active" | "inactive"
createdAt, updatedAt
```
Method: `comparePassword(plain) → boolean`

### Lead
```
name         String (required, max 100)
email        String (optional, unique sparse)
phone        String (required)
source       String
course       ObjectId → Course
status       "new" | "assigned" | "followup" | "closed" | "rejected"
             | "cnc" | "booking" | "partialbooking" | "interested"
assignedTo   ObjectId → User
team         ObjectId → Team
reporter     ObjectId → User (required)
notes        [LeadNote]
reminders    [Reminder]
activityLogs [ActivityLog]
createdAt, updatedAt
```

**Nested — LeadNote:**
```
content   String (required, max 2000)
author    ObjectId → User
createdAt, updatedAt
```

**Nested — Reminder:**
```
title     String (max 200)
note      String (max 1000)
remindAt  Date (required)
createdBy ObjectId → User
isDone    Boolean (default false)
createdAt, updatedAt
```

**Nested — ActivityLog:**
```
action        "lead_created" | "lead_updated" | "status_changed" |
              "lead_assigned" | "team_assigned" | "note_added" |
              "note_updated" | "note_deleted"
description   String (required, max 500)
performedBy   ObjectId → User
changes       Mixed
createdAt
```

### Team
```
name         String (required, unique, max 100)
description  String (max 300)
leaders      [ObjectId → User]
members      [ObjectId → User]
status       "active" | "inactive"
createdAt, updatedAt
```

### Role
```
roleName     String (required, unique, max 50)
description  String (max 200)
permissions  { [module]: { view, create, edit, delete, approve, export } }
isSystemRole Boolean
createdAt, updatedAt
```
Modules: `dashboard | users | roles | leads | teams | courses | reports | settings`

### Course
```
name         String (required, unique, max 150)
description  String (max 1000)
amount       Number (required, min 0)
status       "active" | "inactive"
createdAt, updatedAt
```

### AiMemory
```
lead     ObjectId → Lead (required)
user     ObjectId → User (required)
messages [{ role: "user"|"assistant", content: String, createdAt: Date }]
createdAt, updatedAt
```
Index: `{ lead, user }` unique — one conversation thread per lead per user.

### TeamMessage
```
team      ObjectId → Team (required, indexed)
author    ObjectId → User (required)
content   String (required, max 1000)
createdAt, updatedAt
```

### PushSubscription
```
userId    ObjectId → User (required, indexed)
endpoint  String (required, unique)
keys      { p256dh: String, auth: String }
createdAt, updatedAt
```

---

## 7. Backend — Services

| Service | Responsibilities |
|---|---|
| `authService` | Login, password verify, JWT generation |
| `userService` | User CRUD, profile PDF export |
| `leadService` | Lead CRUD, assignment, bulk ops, activity logging, getUserLeadStats |
| `teamService` | Team CRUD, member stats, auto-assign, bulk lead ops, dashboard, team PDF |
| `roleService` | Role CRUD with permission matrix |
| `courseService` | Course CRUD |
| `reportService` | Overview, timeline, user/team rankings, team split, Excel/PDF export. ALL_STATUSES includes `partialbooking` |
| `excelService` | Parse Excel/CSV for bulk lead import |
| `pushService` | VAPID push notification delivery |

---

## 8. Backend — Middleware

| File | Function |
|---|---|
| `auth.ts` | `authenticate` — validates JWT, attaches `req.user` |
| `permissions.ts` | `checkPermission(module, action)` — RBAC gate; Super Admin bypasses |
| `apiKeyAuth.ts` | `apiKeyAuth` — validates `x-api-key` header for Sheets sync |
| `errorHandler.ts` | `notFound` (404) + `errorHandler` (global 500) |

---

## 9. Frontend — Pages

All dashboard pages are under `app/(dashboard)/` and protected by auth check in `layout.tsx`.

| Route | Page | Description |
|---|---|---|
| `/login` | `(auth)/login/page.tsx` | Login form |
| `/dashboard` | `dashboard/page.tsx` | Overview stats, total leads, unassigned count |
| `/leads` | `leads/page.tsx` | Lead list with search, filters (status/team/assignee/course/date), pagination, bulk ops, upload |
| `/leads/:leadId` | `leads/[leadId]/page.tsx` | Full lead detail: info, notes, activity log, reminders, AI chat panel |
| `/leads/upload` | `leads/upload/page.tsx` | Bulk CSV/Excel upload with template download and result summary |
| `/reminders` | `reminders/page.tsx` | All reminders grouped: overdue / due soon / today / upcoming / done. Inline edit, stats strip |
| `/teams` | `teams/page.tsx` | Team list (admins) or own team view (members). Create/edit/delete |
| `/teams/:teamId` | `teams/[teamId]/page.tsx` | Team detail: members, leads, dashboard stats, bulk assign, inline lead assign, PDF export |
| `/users` | `users/page.tsx` | User list with search, filters, sort, create/edit/delete |
| `/users/:userId` | `users/[userId]/page.tsx` | User profile: assigned leads, stats, status distribution |
| `/roles` | `roles/page.tsx` | Role list with permission matrix view. Create/edit/delete |
| `/courses` | `courses/page.tsx` | Course cards with INR amount, CRUD |
| `/reports` | `reports/page.tsx` | Full reports dashboard: area chart, bar chart, pie chart, user/team rankings, date filter, Excel/PDF export |
| `/profile` | `profile/page.tsx` | Own profile with lead stats and status distribution |
| `/offline` | `offline/page.tsx` | Connectivity error page (PWA) |

---

## 10. Frontend — Components

### Layout
| Component | Description |
|---|---|
| `layout/Sidebar.tsx` | Left sidebar with nav items, collapse toggle, badges (leads count + reminder count), mobile drawer |
| `layout/Header.tsx` | Top header with mobile menu trigger, notification bell, user menu |

**`navItems` in Sidebar:**
```
Dashboard → /dashboard
Leads     → /leads       (badge: assigned leads count)
Reminders → /reminders   (badge: undone reminder count)
Teams     → /teams
Courses   → /courses
Reports   → /reports
Users     → /users
Roles     → /roles
```

### Leads
| Component | Description |
|---|---|
| `leads/LeadDialog.tsx` | Create / edit lead form dialog |
| `leads/DeleteLeadDialog.tsx` | Delete confirmation |
| `leads/AssignLeadDialog.tsx` | Assign lead to user / team |
| `leads/ReminderPanel.tsx` | Card panel showing reminders with color states; add/edit/delete/done |
| `leads/AiChatPanel.tsx` | AI chat interface; message bubbles, typing indicator, clear memory |

**ReminderPanel states:**
- `overdue` → red border + badge
- `soon` (≤30 min) → amber
- `upcoming` → blue
- `done` → green, strikethrough

### Users
| Component | Description |
|---|---|
| `users/UserDialog.tsx` | Create / edit user |
| `users/DeleteUserDialog.tsx` | Delete confirmation |

### Roles
| Component | Description |
|---|---|
| `roles/RoleDialog.tsx` | Create / edit role with full permission matrix |
| `roles/DeleteRoleDialog.tsx` | Delete confirmation |
| `roles/PermissionMatrix.tsx` | Grid UI for toggling per-module permissions |

### Teams
| Component | Description |
|---|---|
| `teams/TeamDialog.tsx` | Create / edit team |
| `teams/DeleteTeamDialog.tsx` | Delete confirmation |

### Courses
| Component | Description |
|---|---|
| `courses/CourseDialog.tsx` | Create / edit course |
| `courses/DeleteCourseDialog.tsx` | Delete confirmation |

### Reports
| Component | Description |
|---|---|
| `reports/ExportPdfDialog.tsx` | Date range picker for PDF export |

### Notifications
| Component | Description |
|---|---|
| `notifications/NotificationBell.tsx` | Bell icon with dropdown list of recent notifications |

### Auth
| Component | Description |
|---|---|
| `auth/LoginForm.tsx` | Email + password form, calls `useLogin` |

---

## 11. Frontend — Hooks

### Leads
```ts
useLeads(filters)           // GET /leads — paginated list
useLead(id)                 // GET /leads/:id
useCreateLead()             // POST /leads
useUpdateLead()             // PUT /leads/:id  — also invalidates ["teams"]
useDeleteLead()             // DELETE /leads/:id
useUpdateLeadStatus()       // PATCH /leads/:id/status — also invalidates ["teams"]
useBulkUpdateLeadStatus()   // PATCH /leads/bulk/status
useBulkDeleteLeads()        // DELETE /leads/bulk
useBulkAssignLeadsToTeam()  // PATCH /leads/bulk/team
useAssignLead()             // PATCH /leads/:id/assign
useAssignLeadToTeam()       // PATCH /leads/:id/team
useTransferLeadToTeam()     // PATCH /leads/:id/transfer
useUploadLeads()            // POST /leads/upload
useAutoAssignLeads()        // POST /leads/auto-assign
useAddLeadNote()            // POST /leads/:id/notes — invalidates ["leads"] + ["leads",id]
useUpdateLeadNote()         // PUT /leads/:id/notes/:noteId
useDeleteLeadNote()         // DELETE /leads/:id/notes/:noteId
useUserLeads(userId)        // GET /users/:userId/leads
useUserLeadStats(userId)    // GET /users/:userId/lead-stats
```

### Reminders
```ts
useMyReminders()            // GET /leads/reminders/mine — refetchInterval 60s
useMyReminderCount()        // GET /leads/reminders/count — refetchInterval 60s
useAddReminder(leadId)      // POST /leads/:id/reminders
useUpdateReminder(leadId)   // PUT /leads/:id/reminders/:reminderId
useDeleteReminder(leadId)   // DELETE /leads/:id/reminders/:reminderId
```

### AI Chat
```ts
useAiMemory(leadId)         // GET /ai/memory/:leadId
useAiChat(leadId)           // POST /ai/chat/:leadId — optimistic update to query cache
useClearAiMemory(leadId)    // DELETE /ai/memory/:leadId
```

### Users
```ts
useUsers(filters)           // GET /users
useUser(id)                 // GET /users/:id
useCreateUser()             // POST /users
useUpdateUser()             // PUT /users/:id
useDeleteUser()             // DELETE /users/:id
useUserProfile()            // GET /auth/profile
```

### Teams
```ts
useMyTeam()                 // GET /teams/mine
useTeams(filters)           // GET /teams
useTeam(id)                 // GET /teams/:id
useCreateTeam()             // POST /teams
useUpdateTeam()             // PUT /teams/:id
useDeleteTeam()             // DELETE /teams/:id
useTeamLeads(id, filters)   // GET /teams/:id/leads
useTeamMemberStats(id)      // GET /teams/:id/member-stats
useTeamAutoAssign(id)       // POST /teams/:id/auto-assign
useTeamDashboard(id)        // GET /teams/:id/dashboard
useTeamLogs(id)             // GET /teams/:id/logs
useTeamUpdates(id)          // GET /teams/:id/updates
```

### Roles & Courses
```ts
useRoles() / useRolesSimple() / useRole(id)
useCreateRole() / useUpdateRole() / useDeleteRole()

useCourses() / useAllCourses() / useCourse(id)
useCreateCourse() / useUpdateCourse() / useDeleteCourse()
```

### Reports
```ts
useReportOverview(params)
useReportTimeline(params)
useReportUserRankings(params)
useReportTeamRankings(params)
useReportTeamSplit(params)
```

### Notifications / Real-time
```ts
useSocket()                   // Socket.io singleton
useTeamSocket(teamId)         // Team-scoped socket events
usePushNotification()         // Web Push subscription management
useReminderNotifications()    // Polls useMyReminders, fires toast + browser Notification
                              //   at exact time (overdue) and at −30 min (soon)
                              //   deduplicated via useRef<Set<string>>
```

**`useReminderNotifications` dedup keys:**
- `<id>:soon` — fires when `0 < diff ≤ 30 min`
- `<id>:now`  — fires when `diff ≤ 0`

---

## 12. Frontend — Types

### `types/index.ts`
```ts
User             { _id, name, email, designation?, role, status, createdAt, updatedAt }
ApiResponse<T>   { success, data?, pagination?, message }
LoginResponse    { user, accessToken, refreshToken }
PermissionAction "view"|"create"|"edit"|"delete"|"approve"|"export"
ModulePermissions { view, create, edit, delete, approve, export } (all boolean)
CRM_MODULES      ["dashboard","users","roles","leads","teams","courses","reports","settings"]
Role             { _id, roleName, description, permissions, isSystemRole, ... }
RoleSimple       { _id, roleName }
PaginationMeta   { total, page, limit, totalPages, hasNextPage, hasPrevPage }
```

### `types/lead.ts`
```ts
LeadStatus       "new"|"assigned"|"followup"|"closed"|"rejected"|"cnc"
                 |"booking"|"partialbooking"|"interested"
ActivityAction   (8 variants)
LeadNote         { _id, content, author, createdAt, updatedAt }
Reminder         { _id, title?, note?, remindAt, createdBy, isDone, ... }
ReminderWithLead Reminder + { lead: { _id, name, phone?, email?, status, assignedTo?, team? } }
ActivityLog      { _id, action, description, performedBy, changes?, createdAt }
Lead             { _id, name, email?, phone?, source?, status, course?, assignedTo?,
                   team?, reporter?, notes[], reminders[], activityLogs[], createdAt, updatedAt }
LeadFilters      { page?, limit?, status?, assignedTo?, team?, reporter?, course?,
                   search?, dateFrom?, dateTo? }
LeadStats        { total, new, assigned, followup, closed, rejected, cnc,
                   booking, partialbooking, interested }
```

### `types/team.ts`
```ts
Team             { _id, name, description?, leaders[], members[], status, ... }
TeamMemberStat   { user, total, assigned, followup, closed, rejected, cnc,
                   booking, partialbooking, interested }
TeamDashboard    (aggregate stats per team including partialbooking)
```

### `types/reports.ts`
```ts
TimelinePoint    { date, new, assigned, followup, closed, rejected, cnc,
                   booking, partialbooking, interested, total }
UserRankItem     { user, total, closed, booking, partialbooking, ... }
TeamRankItem     { team, total, closed, booking, partialbooking, ... }
```

### `hooks/useAiChat.ts`
```ts
AiMessage        { role: "user"|"assistant", content: string, createdAt: string }
```

---

## 13. Frontend — Lib / Stores

### `lib/axios.ts`
- Base URL from `NEXT_PUBLIC_API_URL`
- Request interceptor: attaches `Authorization: Bearer <token>` from Zustand auth store
- Response interceptor: on 401 → attempts token refresh → retries original request → on fail → `logout()`

### `lib/socket.ts`
- Returns singleton `socket.io-client` instance
- Connects with `auth: { token }` from auth store

### `lib/store/authStore.ts` (Zustand)
```ts
user            User | null
accessToken     string | null
isAuthenticated boolean
setAuth(user, token)
logout()
hasPermission(module, action) → boolean
```

### `lib/utils.ts`
- `cn(...classes)` — clsx + tailwind-merge
- `formatDate(iso)` — locale string
- `getInitials(name)` — "John Doe" → "JD"

---

## 14. Feature Build History

### Phase 1 — Core CRM
- User auth (login, JWT, refresh)
- Role-based permissions system
- Lead CRUD with status management
- Team management with leader/member structure
- Course catalog
- Reports with Excel/PDF export
- Google Sheets sync (API key auth)

### Phase 2 — Real-time & Notifications
- Socket.io integration
- Web Push notifications (VAPID)
- NotificationBell in header

### Phase 3 — Bug Fixes & Enhancements
**Bugs fixed:**
1. **`bulkAssignMutation` 404** — Express route ordering: bulk static routes moved before parameterized `/:leadId/assign`
2. **Team leaders invisible in assign dropdown** — `bulkAssignLeadsToMember` only checked `team.members`; fixed to also check `team.leaders`. Crown icon + "(Leader)" label added to dropdowns
3. **Auto-assign on manual create** — `leadController.createLead`: if `assignedTo` not provided, set to `req.user.userId`
4. **No "Unassigned" option in lead assignedTo** — Added `X` menu item that calls `updateLead({ assignedTo: null })`

**Cache invalidation improvements:**
- `useAddLeadNote`, `useUpdateLeadNote`, `useDeleteLeadNote` → also invalidate `["leads"]`
- `useUpdateLead`, `useUpdateLeadStatus` → also invalidate `["teams"]`

### Phase 4 — `partialbooking` Status
Added across the entire stack:
- Backend: `Lead.ts` enum, `types/index.ts`, `leadController.ts` (4 Zod schemas), `reportService.ts` ALL_STATUSES, `exportController.ts` (Excel + both PDFs), `teamService.ts` (dashboard + member + statusDistribution), `leadService.ts` getUserLeadStats
- Frontend: `types/lead.ts`, `types/reports.ts`, `types/team.ts`, all page STATUS_CONFIG objects, `reports/page.tsx`, `leads/page.tsx`, `teams/[teamId]/page.tsx`, `users/[userId]/page.tsx`, `profile/page.tsx`
- Color: pink (`bg-pink-500/15 text-pink-400 border-pink-500/30`)

### Phase 5 — Reminders Feature
**Backend:**
- `reminderSchema` embedded in `Lead` model
- `IReminder` interface in `types/index.ts`
- `leadRoutes.ts`: static `/reminders/mine`, `/reminders/count` before parameterized `/:id`
- 5 controllers: `getMyReminders`, `getMyReminderCount`, `addReminder`, `updateReminder`, `deleteReminder`

**Frontend:**
- `hooks/useReminders.ts` — all CRUD + count hooks, `refetchInterval: 60_000`
- `components/leads/ReminderPanel.tsx` — inline add/edit/delete/done, color states, Framer Motion
- `app/(dashboard)/reminders/page.tsx` — grouped page with stats strip, filter (active/all/done), inline edit
- Sidebar: `Bell` icon nav item, live badge from `useMyReminderCount`
- `hooks/useReminderNotifications.ts` — polls every 60s, fires Sonner toast + browser `Notification` at exact time and −30 min, dedup via `useRef<Set>`
- Mounted in `app/(dashboard)/layout.tsx`

### Phase 6 — MCP + AI Memory
**MCP (for Claude Code):**
- `.mcp.json` at project root: `mongodb` server + `filesystem` server
- `CLAUDE.md` with full project context

**AI Memory Feature:**
- `backend/src/models/AiMemory.ts` — per-lead × per-user conversation (max 40 messages)
- `backend/src/controllers/aiController.ts` — buildSystemPrompt() injects live lead data (notes, activity, assignee, team, course)
- `backend/src/routes/aiRoutes.ts` — 3 endpoints
- `backend/src/config/env.ts` + `backend/.env` — `ANTHROPIC_API_KEY` added
- `@anthropic-ai/sdk@0.80.0` installed in backend
- `frontend/hooks/useAiChat.ts` — `useAiMemory`, `useAiChat`, `useClearAiMemory`
- `frontend/components/leads/AiChatPanel.tsx` — chat UI with bubbles, typing indicator, markdown-lite renderer, clear confirm
- Wired into `leads/[leadId]/page.tsx` below ReminderPanel

---

## 15. Key Conventions & Patterns

### Backend
```ts
// Response helpers (utils/response.ts)
sendSuccess(res, "message", data)
sendError(res, "message", statusCode)

// Auth middleware chain
router.get("/path", authenticate, checkPermission("leads", "view"), controller)

// Route file pattern
import { Router } from "express";
const router = Router();
export default router;
```

### Frontend
```ts
// React Query key convention
["leads"]              // all leads
["leads", id]          // single lead
["leads", "stats", userId]
["reminders"]
["reminders", "count"]
["ai-memory", leadId]
["teams"]
["users"]
["roles"]
["courses"]

// Invalidation pattern (after mutation)
qc.invalidateQueries({ queryKey: ["leads"] })
qc.invalidateQueries({ queryKey: ["leads", leadId] })
qc.invalidateQueries({ queryKey: ["teams"] })

// Tailwind color convention for lead statuses
new          → blue-500/15 text-blue-400
assigned     → violet-500/15 text-violet-400
followup     → amber-500/15 text-amber-400
closed       → green-500/15 text-green-400
rejected     → red-500/15 text-red-400
cnc          → gray-500/15 text-gray-400
booking      → emerald-500/15 text-emerald-400
partialbooking → pink-500/15 text-pink-400
interested   → cyan-500/15 text-cyan-400
```

---

## 16. Permission System

```
Modules: dashboard | users | roles | leads | teams | courses | reports | settings
Actions: view | create | edit | delete | approve | export

Super Admin → bypasses all permission checks (isSystemRole = true, roleName = "Super Admin")

checkPermission("leads", "view") middleware:
  1. Extracts req.user.role
  2. If Super Admin → next()
  3. Else checks role.permissions[module][action]
  4. If missing → 403
```

Frontend `hasPermission(module, action)`:
- Reads from Zustand `authStore`
- Used to show/hide nav items, action buttons, and entire pages

---

## 17. Lead Status Reference

| Status | Color | Meaning |
|---|---|---|
| `new` | Blue | Just created, not yet assigned |
| `assigned` | Violet | Assigned to a sales rep |
| `followup` | Amber | Active follow-up in progress |
| `interested` | Cyan | Lead has shown interest |
| `booking` | Emerald | Full booking confirmed |
| `partialbooking` | Pink | Partial/installment booking |
| `closed` | Green | Deal successfully closed |
| `rejected` | Red | Lead rejected the offer |
| `cnc` | Gray | Could Not Contact |

---

## 18. MCP & AI Configuration

### `.mcp.json` (project root)
```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "mongodb-mcp-server"],
      "env": { "MDB_MCP_CONNECTION_STRING": "mongodb://localhost:27017/crm_db" }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem",
               "/Users/mhdabshar/delta/carlton/crm"]
    }
  }
}
```

### AI Memory System Prompt Context
When a user chats about a lead, the AI receives:
- Lead name, phone, email, status, source
- Assigned user, team, course
- Last 10 notes (with author + timestamp)
- Last 10 activity log entries (with actor + timestamp)
- Instructions to be concise, professional, and sales-coaching oriented

Model: `claude-sonnet-4-6` · Max tokens: 1024 · Memory: last 40 messages per thread
