# 🧩 Components History & Registry — Carlton CRM

> Every global/shared component must be logged here.
> **Before creating a new component**: search this file first (Ctrl+F).
> **After creating a global component**: add it here immediately.
> **After updating a global component**: bump version + update change log.

---

## How to Use

- **Before building**: search by name or category
- **After building**: fill the template, add to the correct category
- **When updating**: bump version, update "Used In", update "API Routes", add change log note

---

## 📋 Component Entry Template

```
### ComponentName
- **File**: `/components/[shared|ui|leads|teams|...]/ComponentName.tsx`
- **Version**: 1.0.0
- **Created**: YYYY-MM-DD
- **Last Updated**: YYYY-MM-DD
- **Status**: active | deprecated | wip

**Purpose**: One-line description.

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|

**Used In (Pages)**:
| Route | Why |
|-------|-----|

**Used In (Components)**:
- `components/path/OtherComponent.tsx` — why

**Dependencies**:
- shadcn: ...
- hooks: ...

**Notes**: any gotchas

**Change Log**:
- 1.0.0 — Initial creation
```

---

## 🗂 Categories

---

## 🏗 Layout & Shell

---

### Header
- **File**: `components/layout/Header.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Top navigation bar — logo, page title, notification bell, user avatar/menu.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| GET | `/leads/reminders/count` | `useMyReminderCount()` | Bell badge count |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/layout.tsx` | Shell — renders on every dashboard page |

**Used In (Components)**:
- `components/notifications/NotificationBell.tsx` — renders inside header right side

**Dependencies**:
- shadcn: `<Avatar />`, `<DropdownMenu />`
- hooks: `useLogout()`, `useAuthStore`

**Change Log**:
- 1.0.0 — Initial creation

---

### Sidebar
- **File**: `components/layout/Sidebar.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Left nav with route links, active-state highlighting, role-based visibility.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| GET | `/teams/mine` | `useMyTeam()` | Shows "My Team" link only if user is in a team |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/layout.tsx` | Shell — renders on every dashboard page |

**Dependencies**:
- hooks: `useAuthStore`, `useMyTeam()`

**Notes**:
- Links hidden/shown based on `user.role.permissions`
- Collapses to bottom nav on mobile

**Change Log**:
- 1.0.0 — Initial creation

---

## 🔔 Notifications

---

### NotificationBell
- **File**: `components/notifications/NotificationBell.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Bell icon with badge in header. Opens panel with upcoming/due reminders.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| GET | `/leads/reminders/mine` | `useMyReminders()` | List of user's reminders |
| GET | `/leads/reminders/count` | `useMyReminderCount()` | Unread badge count |

**Socket Events**:
| Event | Direction | Purpose |
|---|---|---|
| `reminder:due` | Server → Client | Real-time alert when reminder fires |
| `reminder:warning` | Server → Client | 30-min advance warning |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/layout.tsx` | Via `Header.tsx` — present on all dashboard pages |

**Used In (Components)**:
- `components/layout/Header.tsx`

**Dependencies**:
- hooks: `useMyReminders()`, `useMyReminderCount()`, `useReminderNotifications()`
- shadcn: `<Popover />` or `<DropdownMenu />`

**Change Log**:
- 1.0.0 — Initial creation

---

## 🪟 Modals & Overlays

---

### ResponsiveModal (responsive-dialog)
- **File**: `components/ui/responsive-dialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Renders `<Dialog />` on desktop, `<Drawer />` bottom sheet on mobile (`< 768px`). Use for ALL modals in the app.

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `open` | `boolean` | ✅ | — | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | ✅ | — | Toggle handler |
| `title` | `string` | ✅ | — | Modal / drawer title |
| `description` | `string` | ❌ | — | Subtitle text |
| `children` | `ReactNode` | ✅ | — | Body |
| `footer` | `ReactNode` | ❌ | — | Footer actions |
| `size` | `"sm"\|"md"\|"lg"\|"xl"` | ❌ | `"md"` | Desktop width |

**API Routes Used**: none (presentation only)

**Used In (Components)**:
- `components/leads/LeadDialog.tsx`
- `components/leads/AssignLeadDialog.tsx`
- `components/leads/ReminderPanel.tsx`
- `components/teams/TeamDialog.tsx`
- `components/users/UserDialog.tsx`
- `components/roles/RoleDialog.tsx`
- `components/courses/CourseDialog.tsx`
- `components/reports/ExportPdfDialog.tsx`

**Dependencies**:
- shadcn: `<Dialog />`, `<Drawer />`

**Notes**: Always prefer this over bare `<Dialog />` or `<Sheet />`

**Change Log**:
- 1.0.0 — Initial creation

---

### DeleteLeadDialog
- **File**: `components/leads/DeleteLeadDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Confirm and delete a single lead.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| DELETE | `/leads/:id` | `useDeleteLead()` | Delete the lead |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/leads/page.tsx` | Delete action in lead row |

**Dependencies**: shadcn: `<AlertDialog />`

**Change Log**:
- 1.0.0 — Initial creation

---

### DeleteUserDialog
- **File**: `components/users/DeleteUserDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Confirm and delete a single user.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| DELETE | `/users/:id` | `useDeleteUser()` | Delete the user |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/users/page.tsx` | Delete action in user row |

**Change Log**:
- 1.0.0 — Initial creation

---

### DeleteTeamDialog
- **File**: `components/teams/DeleteTeamDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Confirm and delete a team.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| DELETE | `/teams/:id` | `useDeleteTeam()` | Delete the team |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/teams/page.tsx` | Delete from list |
| `app/(dashboard)/teams/[teamId]/page.tsx` | Delete from detail page |

**Change Log**:
- 1.0.0 — Initial creation

---

### DeleteRoleDialog
- **File**: `components/roles/DeleteRoleDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Confirm and delete a role.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| DELETE | `/roles/:id` | `useDeleteRole()` | Delete the role |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/roles/page.tsx` | Delete action in role row |

**Change Log**:
- 1.0.0 — Initial creation

---

### DeleteCourseDialog
- **File**: `components/courses/DeleteCourseDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Confirm and delete a course.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| DELETE | `/courses/:id` | `useDeleteCourse()` | Delete the course |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/courses/page.tsx` | Delete action in course row |

**Change Log**:
- 1.0.0 — Initial creation

---

## 📊 Data Display (Planned Global — WIP)

---

### DataTable
- **File**: `components/shared/DataTable.tsx`
- **Version**: 1.0.0
- **Status**: wip

**Purpose**: Generic sortable, filterable, paginated table (TanStack Table). Use for ALL data tables.

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `columns` | `ColumnDef<T>[]` | ✅ | — | Column definitions |
| `data` | `T[]` | ✅ | — | Row data |
| `isLoading` | `boolean` | ❌ | `false` | Shows skeleton |
| `pagination` | `PaginationState` | ❌ | — | Controlled pagination |
| `onPaginationChange` | `OnChangeFn<PaginationState>` | ❌ | — | Pagination handler |
| `sorting` | `SortingState` | ❌ | — | Controlled sort |
| `onSortingChange` | `OnChangeFn<SortingState>` | ❌ | — | Sort handler |
| `emptyMessage` | `string` | ❌ | `"No results"` | Empty state text |

**API Routes Used**: none (presentation — receives data as props)

**Notes**: Always pass `getRowId`; wrap column defs in `useMemo`

**Change Log**:
- 1.0.0 — Initial setup (WIP)

---

### Pagination
- **File**: `components/shared/Pagination.tsx`
- **Version**: 1.0.0
- **Status**: wip

**Purpose**: Standalone pagination bar. Used inside DataTable or standalone.

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `page` | `number` | ✅ | — | Current page (1-based) |
| `totalPages` | `number` | ✅ | — | Total pages |
| `onPageChange` | `(page: number) => void` | ✅ | — | Callback |
| `pageSize` | `number` | ❌ | `10` | Items per page |
| `onPageSizeChange` | `(size: number) => void` | ❌ | — | Page size callback |
| `totalItems` | `number` | ❌ | — | Shows "X of Y" label |

**API Routes Used**: none

**Change Log**:
- 1.0.0 — Initial setup (WIP)

---

## 🔄 Feedback & States

---

### ErrorPage
- **File**: `components/ui/error-page.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Full-page or section-level error display with message and optional retry.

**API Routes Used**: none

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/error.tsx` | Global Next.js error boundary |
| `app/global-error.tsx` | Root-level error |
| `app/(dashboard)/*/error.tsx` | Per-route error pages (all dashboard routes) |

**Change Log**:
- 1.0.0 — Initial creation

---

### LoadingSkeleton *(WIP)*
- **File**: `components/shared/LoadingSkeleton.tsx`
- **Version**: 1.0.0
- **Status**: wip

**Purpose**: Layout-matching skeleton. Pass `variant` matching the content loading.

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `variant` | `"table"\|"card"\|"form"\|"list"` | ✅ | — | Shape to mimic |
| `rows` | `number` | ❌ | `5` | Skeleton row count |

**Change Log**:
- 1.0.0 — Initial setup (WIP)

---

### EmptyState *(WIP)*
- **File**: `components/shared/EmptyState.tsx`
- **Version**: 1.0.0
- **Status**: wip

**Purpose**: Empty list state: icon + message + optional CTA.

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `icon` | `ReactNode` | ❌ | default | Lucide icon |
| `title` | `string` | ✅ | — | Main message |
| `description` | `string` | ❌ | — | Supporting text |
| `action` | `{ label: string; onClick: () => void }` | ❌ | — | CTA button |

**Change Log**:
- 1.0.0 — Initial setup (WIP)

---

## 📝 Forms & Inputs (Planned Global — WIP)

---

### FormField
- **File**: `components/shared/FormField.tsx`
- **Version**: 1.0.0
- **Status**: wip

**Purpose**: RHF `Controller` + shadcn `Input` + label + error — eliminates boilerplate.

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | `string` | ✅ | — | RHF field name |
| `control` | `Control<any>` | ✅ | — | RHF control |
| `label` | `string` | ❌ | — | Label text |
| `placeholder` | `string` | ❌ | — | Placeholder |
| `type` | `string` | ❌ | `"text"` | Input type |
| `disabled` | `boolean` | ❌ | `false` | Disable |

**Change Log**:
- 1.0.0 — Initial setup (WIP)

---

### SearchInput
- **File**: `components/shared/SearchInput.tsx`
- **Version**: 1.0.0
- **Status**: wip

**Purpose**: Debounced search input — calls `onSearch` after user stops typing.

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onSearch` | `(value: string) => void` | ✅ | — | Debounced callback |
| `debounceMs` | `number` | ❌ | `400` | Debounce delay |
| `placeholder` | `string` | ❌ | `"Search..."` | Placeholder |
| `defaultValue` | `string` | ❌ | `""` | Initial value |

**Change Log**:
- 1.0.0 — Initial setup (WIP)

---

## 🎛 Feature-Specific Components

---

### LeadDialog
- **File**: `components/leads/LeadDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Create or edit a lead. Full lead form with all fields.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| POST | `/leads` | `useCreateLead()` | Create new lead |
| PUT | `/leads/:id` | `useUpdateLead()` | Update existing lead |
| GET | `/courses/all` | `useAllCourses()` | Populate course dropdown |
| GET | `/teams` | `useTeams()` | Populate team dropdown |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/leads/page.tsx` | "Add Lead" button + row edit action |

**Used In (Components)**:
- `components/ui/responsive-dialog.tsx` — wraps the form

**Dependencies**:
- hooks: `useCreateLead()`, `useUpdateLead()`, `useAllCourses()`, `useTeams()`
- react-hook-form + zod

**Change Log**:
- 1.0.0 — Initial creation

---

### AssignLeadDialog
- **File**: `components/leads/AssignLeadDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Assign a lead to a team (and optionally a user within the team).

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| GET | `/teams` | `useTeams()` | Team dropdown |
| PATCH | `/leads/:id/team` | `useAssignLeadToTeam()` | Assign to team |
| PATCH | `/leads/:id/assign` | `useAssignLead()` | Assign to specific user |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/leads/page.tsx` | Assign action in lead row |

**Used In (Components)**:
- `components/ui/responsive-dialog.tsx`

**Change Log**:
- 1.0.0 — Initial creation

---

### ReminderPanel
- **File**: `components/leads/ReminderPanel.tsx`
- **Version**: 1.2.0
- **Last Updated**: 2026-04-01
- **Status**: active

**Purpose**: CRUD panel for reminders on a lead. IST-aware time display, add/edit/delete/mark-done.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| POST | `/leads/:leadId/reminders` | `useAddReminder(leadId)` | Create reminder |
| PUT | `/leads/:leadId/reminders/:id` | `useUpdateReminder(leadId)` | Edit reminder |
| DELETE | `/leads/:leadId/reminders/:id` | `useDeleteReminder(leadId)` | Delete reminder |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/leads/[leadId]/page.tsx` | Reminders tab in lead detail |

**Dependencies**:
- hooks: `useAddReminder()`, `useUpdateReminder()`, `useDeleteReminder()`
- `lib/animations.ts`
- shadcn: `<Input type="datetime-local" />`, `<Textarea />`, `<Button />`

**Notes / Gotchas**:
- `toDatetimeLocal(iso)` → uses `sv-SE` + `Asia/Kolkata` — never `getHours()` (see `mistakes.md` M-002)
- `handleSave()` → appends `:00+05:30` before sending (see `mistakes.md` M-003)
- Input has `min={nowIST()}` — blocks past-time selection
- All display times appended with " IST"

**Change Log**:
- 1.0.0 — Initial creation
- 1.1.0 — Added IST-aware time display
- 1.2.0 — Fixed `toDatetimeLocal` (sv-SE/Kolkata); fixed `:00+05:30` parsing; added `min={nowIST()}`; added `timeError` state (2026-04-01)

---

### AiChatPanel
- **File**: `components/leads/AiChatPanel.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: AI chat assistant for a lead. Powered by Anthropic Claude via backend.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| GET | `/ai/memory/lead/:leadId` | `useAiMemory("lead", leadId)` | Load conversation history |
| POST | `/ai/chat/lead/:leadId` | `useAiChat("lead", leadId)` | Send message, get reply |
| DELETE | `/ai/memory/lead/:leadId` | `useClearAiMemory("lead", leadId)` | Clear conversation |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/leads/[leadId]/page.tsx` | AI Chat tab |

**Dependencies**:
- hooks: `useAiMemory()`, `useAiChat()`, `useClearAiMemory()` from `hooks/useAiChat.ts`
- shadcn: `<ScrollArea />`, `<Textarea />`, `<Button />`

**Notes**: Conversations scoped to `leadId + userId` — each user has separate history per lead

**Change Log**:
- 1.0.0 — Initial creation

---

### PaymentPanel
- **File**: `components/leads/PaymentPanel.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Add, edit, delete payment records for a lead. Shows payment history.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| POST | `/leads/:leadId/payments` | `useAddPayment(leadId)` | Add payment |
| PUT | `/leads/:leadId/payments/:id` | `useUpdatePayment(leadId)` | Edit payment |
| DELETE | `/leads/:leadId/payments/:id` | `useDeletePayment(leadId)` | Remove payment |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/leads/[leadId]/page.tsx` | Payments tab |

**Dependencies**: hooks: `useAddPayment()`, `useUpdatePayment()`, `useDeletePayment()` from `hooks/usePayments.ts`

**Change Log**:
- 1.0.0 — Initial creation

---

### LeadsDateFilter
- **File**: `components/leads/LeadsDateFilter.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Date range picker for filtering leads by creation date.

**API Routes Used**: none (emits filter values up via props callback)

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/leads/page.tsx` | Filter bar — `dateFrom`/`dateTo` params |

**Change Log**:
- 1.0.0 — Initial creation

---

### TeamDialog
- **File**: `components/teams/TeamDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Create or edit a team. Fields: name, description, leaders, members.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| POST | `/teams` | `useCreateTeam()` | Create team |
| PUT | `/teams/:id` | `useUpdateTeam()` | Update team |
| GET | `/users` | `useUsers()` | Populate leader/member dropdowns |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/teams/page.tsx` | "Add Team" button |
| `app/(dashboard)/teams/[teamId]/page.tsx` | Edit team |

**Used In (Components)**:
- `components/ui/responsive-dialog.tsx`

**Change Log**:
- 1.0.0 — Initial creation

---

### UserDialog
- **File**: `components/users/UserDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Create or edit a user. Fields: name, email, password, role, designation.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| POST | `/users` | `useCreateUser()` | Create user |
| PUT | `/users/:id` | `useUpdateUser()` | Update user |
| GET | `/roles/all` | `useRolesSimple()` | Role dropdown |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/users/page.tsx` | "Add User" button + row edit |

**Used In (Components)**:
- `components/ui/responsive-dialog.tsx`

**Change Log**:
- 1.0.0 — Initial creation

---

### RoleDialog
- **File**: `components/roles/RoleDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Create or edit a role with a full permission matrix.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| GET | `/roles/:id` | `useRole(id)` | Load existing role for edit |
| POST | `/roles` | `useCreateRole()` | Create role |
| PUT | `/roles/:id` | `useUpdateRole()` | Update role + permissions |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/roles/page.tsx` | "Add Role" + edit actions |

**Used In (Components)**:
- `components/ui/responsive-dialog.tsx`
- `components/roles/PermissionMatrix.tsx`

**Change Log**:
- 1.0.0 — Initial creation

---

### PermissionMatrix
- **File**: `components/roles/PermissionMatrix.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Visual module × action grid with checkboxes. Used only inside `RoleDialog`.

**API Routes Used**: none (receives/emits permissions via props)

**Used In (Components)**:
- `components/roles/RoleDialog.tsx`

**Notes**:
- Modules: `dashboard | leads | teams | users | roles | reports`
- Actions: `view | create | edit | delete`

**Change Log**:
- 1.0.0 — Initial creation

---

### CourseDialog
- **File**: `components/courses/CourseDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Create or edit a course.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| GET | `/courses/:id` | `useCourse(id)` | Load existing course for edit |
| POST | `/courses` | `useCreateCourse()` | Create course |
| PUT | `/courses/:id` | `useUpdateCourse()` | Update course |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/courses/page.tsx` | "Add Course" + row edit |

**Used In (Components)**:
- `components/ui/responsive-dialog.tsx`

**Change Log**:
- 1.0.0 — Initial creation

---

### ExportPdfDialog
- **File**: `components/reports/ExportPdfDialog.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Options modal for exporting report data as PDF.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| GET | `/reports/overview` | `useReportOverview()` | Data to export |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(dashboard)/reports/page.tsx` | Export button |

**Used In (Components)**:
- `components/ui/responsive-dialog.tsx`

**Change Log**:
- 1.0.0 — Initial creation

---

### LoginForm
- **File**: `components/auth/LoginForm.tsx`
- **Version**: 1.0.0
- **Status**: active

**Purpose**: Email + password login form with validation and submit handler.

**API Routes Used**:
| Method | Endpoint | Hook | Purpose |
|--------|----------|------|---------|
| POST | `/auth/login` | `useLogin()` | Authenticate user |

**Used In (Pages)**:
| Route | Why |
|-------|-----|
| `app/(auth)/login/page.tsx` | The login page |

**Dependencies**:
- hooks: `useLogin()` from `hooks/useAuth.ts`
- react-hook-form + zod

**Change Log**:
- 1.0.0 — Initial creation

---

## 🗺 Full Route → Component → API Map

> Quick reference: for each page, what components are used and what APIs are called.

### `app/(auth)/login/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| `LoginForm` | `POST /auth/login` |

---

### `app/(dashboard)/leads/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /leads`, `PATCH /leads/:id/status`, `POST /leads/auto-assign`, `PATCH /leads/bulk/status`, `DELETE /leads/bulk`, `PATCH /leads/bulk/team` |
| `LeadDialog` | `POST /leads`, `PUT /leads/:id`, `GET /courses/all`, `GET /teams` |
| `AssignLeadDialog` | `GET /teams`, `PATCH /leads/:id/team`, `PATCH /leads/:id/assign` |
| `DeleteLeadDialog` | `DELETE /leads/:id` |
| `LeadsDateFilter` | — (emits filter values only) |

---

### `app/(dashboard)/leads/[leadId]/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /leads/:id`, `PUT /leads/:id`, `PATCH /leads/:id/status`, `POST /leads/:leadId/notes`, `PUT /leads/:leadId/notes/:id`, `DELETE /leads/:leadId/notes/:id` |
| `ReminderPanel` | `POST /leads/:leadId/reminders`, `PUT /leads/:leadId/reminders/:id`, `DELETE /leads/:leadId/reminders/:id` |
| `PaymentPanel` | `POST /leads/:leadId/payments`, `PUT /leads/:leadId/payments/:id`, `DELETE /leads/:leadId/payments/:id` |
| `AiChatPanel` | `GET /ai/memory/lead/:id`, `POST /ai/chat/lead/:id`, `DELETE /ai/memory/lead/:id` |

---

### `app/(dashboard)/leads/upload/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `POST /leads/upload` |

---

### `app/(dashboard)/reminders/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /leads/reminders/mine`, `POST /leads/:leadId/reminders`, `PUT /leads/:leadId/reminders/:id`, `DELETE /leads/:leadId/reminders/:id` |

---

### `app/(dashboard)/teams/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /teams` |
| `TeamDialog` | `POST /teams`, `GET /users` |
| `DeleteTeamDialog` | `DELETE /teams/:id` |

---

### `app/(dashboard)/teams/[teamId]/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /teams/:id`, `GET /teams/:id/leads`, `GET /teams/:id/member-stats`, `GET /teams/:id/dashboard`, `GET /teams/:id/logs`, `GET /teams/:id/updates`, `POST /teams/:id/messages`, `POST /teams/:id/auto-assign`, `PATCH /teams/:id/members/:memberId/toggle-active`, `PATCH /teams/:id/leads/:leadId/assign`, `PATCH /teams/:id/leads/bulk/assign`, `PATCH /teams/:id/leads/bulk/transfer`, `PATCH /teams/:id/leads/bulk/status`, `PATCH /leads/:leadId/transfer`, `GET /teams/:id/revenue`, `GET /teams/:id/revenue/timeline` |
| `TeamDialog` | `PUT /teams/:id`, `GET /users` |
| `DeleteTeamDialog` | `DELETE /teams/:id` |

---

### `app/(dashboard)/teams/[teamId]/members/[memberId]/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /teams/:id/members/:memberId`, `GET /teams/:id/members/:memberId/leads` |

---

### `app/(dashboard)/users/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /users` |
| `UserDialog` | `POST /users`, `PUT /users/:id`, `GET /roles/all` |
| `DeleteUserDialog` | `DELETE /users/:id` |

---

### `app/(dashboard)/users/[userId]/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /users/:id`, `PUT /users/:id`, `GET /users/:id/leads`, `GET /users/:id/lead-stats` |

---

### `app/(dashboard)/roles/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /roles` |
| `RoleDialog` | `GET /roles/:id`, `POST /roles`, `PUT /roles/:id` |
| `DeleteRoleDialog` | `DELETE /roles/:id` |

---

### `app/(dashboard)/courses/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /courses` |
| `CourseDialog` | `GET /courses/:id`, `POST /courses`, `PUT /courses/:id` |
| `DeleteCourseDialog` | `DELETE /courses/:id` |

---

### `app/(dashboard)/reports/page.tsx`
| Component | APIs Called |
|-----------|-------------|
| Page direct | `GET /reports/overview`, `GET /reports/timeline`, `GET /reports/users`, `GET /reports/teams`, `GET /reports/team-split`, `GET /reports/revenue/overview`, `GET /reports/revenue/timeline`, `GET /reports/revenue/teams`, `POST /ai/chat/report`, `GET /ai/memory/report/report`, `DELETE /ai/memory/report/report` |
| `ExportPdfDialog` | `GET /reports/overview` |

---

### `app/(dashboard)/layout.tsx` (all dashboard pages)
| Component | APIs Called |
|-----------|-------------|
| `Header` → `NotificationBell` | `GET /leads/reminders/mine`, `GET /leads/reminders/count` |
| `Sidebar` | `GET /teams/mine` |
| Socket (via `useReminderNotifications`) | Events: `reminder:due`, `reminder:warning` |

---

## ➕ Adding a New Component

1. Copy the template at the top
2. Place in the correct category
3. Fill **every section** including "API Routes Used" and "Used In (Pages)"
4. If reusable in 2+ places → `/components/shared/`, status: `active`
5. Update this file's component count

**Component count**: 24
*(Increment every time you add a component)*

---

## TeamRemindersTab (added 2026-04-06)

**File:** `components/teams/TeamRemindersTab.tsx`
**Props:** `teamId: string`, `members: { _id: string; name: string }[]`
**Used in:** `app/(dashboard)/teams/[teamId]/page.tsx` — "Reminders" tab (leader/admin only)
**Hook:** `useTeamReminders(teamId, filters)` from `hooks/useTeams.ts`
**Features:** Search (debounced 400ms), member filter, isDone filter (pending/done), pagination (20/page), overdue badge, Framer Motion stagger list.

---

## MemberSelector (added 2026-04-24)

**File:** `app/(dashboard)/leads/upload/page.tsx` (inline sub-component)
**Props:** `teamId: string`, `members: TeamMember[]`, `inactiveMembers: string[]`, `selected: Set<string>`, `locked?: boolean`, `lockedIds?: string[]`, `onChange: (id: string) => void`
**Used in:** `TeamMemberSelector` → upload page
**Purpose:** Renders member pills with checkboxes. Locked mode (BDE): members can't be deselected. Inactive members shown greyed/disabled. "All/None" quick actions for admins.

---

## TeamMemberSelector (added 2026-04-24)

**File:** `app/(dashboard)/leads/upload/page.tsx` (inline sub-component)
**Props:** `teams: Team[]`, `selectedTeamIds: Set<string>`, `selectedMemberIds: Record<string, Set<string>>`, `lockedTeamId?: string | null`, `lockedMemberId?: string | null`, `onToggleTeam: (id: string) => void`, `onToggleMember: (teamId: string, memberId: string) => void`, `onSetAllMembers: (teamId: string, all: boolean) => void`
**Used in:** upload page
**Purpose:** Vertical list of team rows, each expands to show `MemberSelector`. BDE sees only their team (locked, non-removable). Admins can toggle any team + any member. Framer Motion AnimatePresence for expand/collapse.
