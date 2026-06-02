# 🚀 Features Registry

> Every feature built in this project must be logged here.
> Before building a feature, **check here first** to avoid duplicating logic, hooks, or API calls.
> After building, **fill in the entry completely**.

---

## How to Use This File

- **Before building**: Search by feature name, keyword, or related API
- **After building**: Add the complete entry using the template
- **When modifying**: Update the entry — increment version, log the change

---

## 📋 Feature Entry Template

```
### Feature Name
- **ID**: feat-XXX
- **Version**: 1.0.0
- **Created**: YYYY-MM-DD
- **Last Updated**: YYYY-MM-DD
- **Status**: active | deprecated | wip | planned

**Description**: What this feature does from the user's perspective.

**Routes / Pages**:
- `/app/[route]/page.tsx` — description

**Components Used**:
- `/components/shared/ComponentName.tsx`
- `/components/[feature]/SpecificComponent.tsx`

**Hooks Used**:
- `useHookName` — `/hooks/useHookName.ts` — purpose

**API Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resource` | Fetch list |
| POST | `/api/resource` | Create item |

**State Management**:
- React Query keys: `['resource']`, `['resource', id]`
- Zustand store: `/store/resourceStore.ts` (if any)

**Related Features**:
- feat-XXX — name (how they relate)

**Known Issues / Gotchas**:
- Any edge cases or known bugs

**Change Log**:
- 1.0.0 — Initial build
```

---

## 📂 Feature Categories

---

## 🔐 Authentication

---

### Login & Session Management
- **ID**: feat-001
- **Version**: 1.0.0
- **Created**: —
- **Status**: wip

**Description**: User login, logout, and session persistence via NextAuth.js.

**Routes / Pages**:
- `/app/(auth)/login/page.tsx` — Login form page
- `/app/api/auth/[...nextauth]/route.ts` — NextAuth handler

**Components Used**:
- `/components/auth/LoginForm.tsx`
- `/components/shared/FormField.tsx`

**Hooks Used**:
- `useSession` — NextAuth built-in — check auth state

**API Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signin` | NextAuth signin |
| POST | `/api/auth/signout` | NextAuth signout |
| GET | `/api/auth/session` | Get current session |

**State Management**:
- Session state via NextAuth `SessionProvider`
- No Zustand store needed — use `useSession()`

**Known Issues / Gotchas**:
- Always wrap protected routes with auth middleware in `middleware.ts`
- `useSession()` requires `SessionProvider` in root layout

**Change Log**:
- 1.0.0 — Initial setup

---

## 👤 User Management

*(Add features here as they are built)*

---

## 📊 Dashboard

*(Add features here as they are built)*

---

## 💼 [Module Name]

*(Add features here as they are built)*

---

## ➕ How to Add a New Feature

1. Copy the template block above
2. Assign the next `feat-XXX` ID (check the last ID used below)
3. Fill in all sections — don't leave anything blank
4. Place it under the correct category section
5. Cross-reference with `componentsHistory.md` for any shared components

**Last Feature ID Used**: `feat-001`
*(Update this every time you add a new feature)*

---

## 🔗 Cross-Reference Index

Quick lookup: feature name → ID

| Feature | ID | Status |
|---------|-----|--------|
| Login & Session Management | feat-001 | wip |

*(Add new rows as features are created)*