# Design System — Delta CRM Frontend

> Single source of truth for colours, typography, spacing, animations, and UI patterns.
> Read this before writing any styles, components, or colour values.

---

## 1. Typography

### Font
- **Primary font**: `Inter` — loaded via `next/font/google`
- Applied globally in `app/layout.tsx` → `className={inter.className}`
- Never use system-ui, Arial, or Helvetica as the primary font

### Scale (Tailwind defaults)
| Class | Size | Use |
|-------|------|-----|
| `text-xs` | 12px | Labels, metadata, badges |
| `text-sm` | 14px | Body, table cells, form inputs |
| `text-base` | 16px | Card titles, section headings |
| `text-lg` | 18px | Sub-page headings |
| `text-xl` | 20px | Page headings |
| `text-2xl` | 24px | Stat numbers, hero numbers |
| `text-3xl+` | 30px+ | Only for dashboard KPI blocks |

### Weight conventions
| Weight | Class | Use |
|--------|-------|-----|
| Regular | `font-normal` | Body text |
| Medium | `font-medium` | Labels, nav items |
| Semibold | `font-semibold` | Card titles, section headers |
| Bold | `font-bold` | Stat numbers, KPI values |

---

## 2. Colour System

### Theme
- **Mode**: Light + Dark, toggled by `next-themes`
- **Default**: `defaultTheme="light"` with `enableSystem` — respects OS preference
- **Primary colour**: Blue-500 `#3b82f6` (HSL `217 91% 60%`)
- **Brand accent**: Top-loader bar + ring = `#3b82f6`

### CSS Custom Properties (defined in `app/globals.css`)

#### Light Mode
| Variable | HSL Value | Hex Approx | Purpose |
|----------|-----------|------------|---------|
| `--background` | `220 33% 98%` | `#f7f8fc` | Page background |
| `--foreground` | `224 71% 4%` | `#060b18` | Primary text |
| `--card` | `0 0% 100%` | `#ffffff` | Card surface |
| `--card-foreground` | `224 71% 4%` | `#060b18` | Text on card |
| `--primary` | `217 91% 60%` | `#3b82f6` | Brand — buttons, active states |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Text on primary |
| `--muted` | `214 32% 91%` | `#e2e8f0` | Subtle backgrounds |
| `--muted-foreground` | `215 16% 47%` | `#64748b` | Helper / secondary text |
| `--border` | `214 32% 91%` | `#e2e8f0` | Default borders |
| `--input` | `214 32% 91%` | `#e2e8f0` | Input borders |
| `--ring` | `217 91% 60%` | `#3b82f6` | Focus rings |
| `--destructive` | `0 84.2% 60.2%` | `#ef4444` | Danger / delete actions |
| `--radius` | `0.875rem` | — | Border radius base |
| `--sidebar-background` | `220 14% 96%` | `#f1f3f8` | Sidebar surface |

#### Dark Mode
| Variable | HSL Value | Hex Approx | Purpose |
|----------|-----------|------------|---------|
| `--background` | `222 84% 5%` | `#030712` | Deep blue-black page bg |
| `--card` | `222 47% 8%` | `#0d1526` | Slightly elevated card |
| `--primary` | `217 91% 60%` | `#3b82f6` | Same blue — consistent |
| `--muted` | `217 33% 18%` | `#1e2d4a` | Muted surface |
| `--muted-foreground` | `215 20% 65%` | `#94a3b8` | Secondary text |
| `--border` | `217 33% 18%` | `#1e2d4a` | Subtle borders |
| `--sidebar-background` | `220 47% 6%` | `#070f1f` | Dark sidebar |

### Semantic Token Rules — MANDATORY

```tsx
// ❌ NEVER hardcode — breaks dark mode
<div className="bg-white text-gray-900 border-gray-200">

// ✅ ALWAYS use semantic tokens
<div className="bg-card text-card-foreground border-border">
```

| Token | Class | Use for |
|-------|-------|---------|
| Page bg | `bg-background` | `<main>`, full-page backgrounds |
| Card bg | `bg-card` | Cards, panels, modals |
| Muted bg | `bg-muted` | Subtle secondary surfaces, table rows |
| Brand | `bg-primary` | Primary buttons, active badges |
| Body text | `text-foreground` | All primary readable text |
| Helper text | `text-muted-foreground` | Labels, timestamps, metadata |
| Borders | `border-border` | All dividers, card outlines |
| Focus | `ring-ring` | Input/button focus rings |
| Danger | `bg-destructive` | Delete, error states |

### Accent Colours (non-semantic, use sparingly)
These are used in charts, badges, and stat cards with low opacity backgrounds:

| Colour | Tailwind | Hex | Used for |
|--------|----------|-----|---------|
| Blue | `blue-400/500` | `#60a5fa / #3b82f6` | Primary, lead stats |
| Green | `green-400/500` | `#4ade80 / #22c55e` | Revenue, paid, success |
| Amber | `amber-400/500` | `#fbbf24 / #f59e0b` | Warnings, follow-up |
| Violet | `violet-400/500` | `#a78bfa / #8b5cf6` | Teams, roles, leads count |
| Rose | `rose-400/500` | `#fb7185 / #f43f5e` | Rejected, overdue |
| Sky | `sky-400/500` | `#38bdf8 / #0ea5e9` | Info, new |
| Orange | `orange-400/500` | `#fb923c / #f97316` | Booking, partial booking |

**Icon + background pattern** (used on every stat card):
```tsx
// Icon container: use /15 opacity background + matching text
<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
  <TrendingUp className="h-5 w-5 text-blue-400" />
</div>
```

---

## 3. Spacing & Layout

### Border Radius
- Base: `--radius: 0.875rem` → Tailwind `rounded-lg` = `0.875rem`
- Cards, modals, panels: `rounded-xl` (1rem) or `rounded-2xl` (1.5rem)
- Buttons: `rounded-lg` (from shadcn default)
- Badges, pills: `rounded-full`
- Small inputs / chips: `rounded-md`

### Container
- Max width: `1400px` (`2xl` breakpoint)
- Padding: `2rem` horizontal

### Page Layout
- Dashboard pages: `space-y-6` between sections
- Card content: `p-4` or `p-6`
- Card header: `pb-3` or `pb-4`
- Grid gaps: `gap-4` (standard), `gap-3` (compact), `gap-6` (wide)

### Breakpoints (standard Tailwind)
| Name | Min width | Use |
|------|-----------|-----|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Small desktop |
| `xl` | 1280px | Desktop |
| `2xl` | 1400px | Wide desktop (container max) |

---

## 4. Component Patterns

### Cards
```tsx
// Standard card
<Card className="border-border/50">
  <CardHeader className="pb-3">
    <CardTitle className="text-base flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      Title
    </CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>

// Accent card (e.g., revenue = green, error = red)
<Card className="border-green-500/20 bg-green-500/3">
```

### Stat Cards (Dashboard KPIs)
```tsx
<div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/8 px-4 py-3">
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
    <Icon className="h-5 w-5 text-blue-400" />
  </div>
  <div>
    <p className="text-xs text-muted-foreground">Label</p>
    <p className="text-2xl font-bold text-blue-400 tabular-nums">42</p>
  </div>
</div>
```

### Badges / Status Pills
```tsx
// Status badge — always include dot
<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-500/10 text-green-400">
  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
  Active
</span>
```

### Buttons
```tsx
// Primary action
<Button className="gap-2">
  <Plus className="h-4 w-4" /> Add Lead
</Button>

// Destructive
<Button variant="destructive" size="sm">Delete</Button>

// Ghost / icon only
<Button variant="ghost" size="icon">
  <MoreHorizontal className="h-4 w-4" />
</Button>
```

### Sidebar Active Item
```tsx
className="bg-primary/10 text-primary border-l-2 border-primary font-medium"
// + whileHover={{ x: 2 }} from Framer Motion
```

### Empty State
```tsx
<EmptyState
  title="No leads found"
  description="Try adjusting your filters"
  action={{ label: "Add Lead", onClick: () => {} }}
/>
// Always icon/illustration + primary action — never just text
```

### Loading State
```tsx
<LoadingSkeleton variant="table" />  // or "card", "list", "form"
// Always matches actual layout shape — not generic spinners for full pages
```

---

## 5. Framer Motion Animations

> **MANDATORY** — every component must have intentional animation.
> Never define variants inline — all variants come from `lib/animations.ts`.

### Where the variants live
`lib/animations.ts` — import from here always:
```tsx
import { pageVariants, listContainerVariants, listItemVariants, modalVariants, slideInVariants, cardHoverVariants } from "@/lib/animations"
```

### Required animation per component type
| Component | Required |
|-----------|----------|
| Every page | `pageVariants` — fade + slide up |
| Every list/grid | `listContainerVariants` + `listItemVariants` — stagger |
| Every card | `listItemVariants` + `whileHover={cardHoverVariants.hover}` |
| Every modal/dialog | `modalVariants` + `AnimatePresence` |
| Every side panel | `slideInVariants` |
| Every button | `whileTap={{ scale: 0.97 }}` |
| Every dropdown | fade + scale from origin |
| Every table row | stagger fade-in |
| Every badge | `initial={{ scale: 0 }} animate={{ scale: 1 }}` |
| Theme toggle icon | `AnimatePresence` y-axis swap |
| Conditional renders | Always wrap with `<AnimatePresence>` |

### Rules
- Never animate `width` or `height` directly — use `scaleX` / `scaleY`
- Use `layout` prop for list reorder animations
- Stagger delay: `0.05s–0.08s` per item (never more than `0.1s`)
- Page transitions: `duration: 0.3`, `ease: "easeOut"`
- Hover transitions: `duration: 0.15`
- Always include `exit` animation when using `AnimatePresence`

---

## 6. Icons

- **Library**: `lucide-react` v0.411.0
- Default size: `h-4 w-4` (16px) for inline / `h-5 w-5` (20px) for standalone
- Stat card icons: `h-5 w-5` inside `h-10 w-10` container
- Never mix icon libraries within the same page

---

## 7. Forms

- **Library**: React Hook Form + Zod resolver
- **Inputs**: shadcn/ui `Input`, `Textarea`, `Select`, `Combobox`
- Label always above input, never placeholder-only
- Required fields: Zod schema enforces, no asterisk required
- Submit button: disabled + spinner when `isPending`
- Error display: `FormMessage` from shadcn — below field, `text-destructive`
- Toast on success: `sonner` toast — `toast.success("...")`
- Toast on error: `toast.error(err.response?.data?.message ?? err.message)`

---

## 8. Data Display

### Tables
- Use `DataTable` from `components/shared/DataTable.tsx` — never build custom tables
- Row hover: `hover:bg-muted/50`
- Sticky header on scroll
- Pagination via `Pagination` component from `components/shared/Pagination.tsx`

### Numbers
- Currency: use `fmtFull` from `lib/currency.ts` (formats as AED)
- Percentages: always one decimal — `42.0%`
- Large numbers: `tabular-nums` class for monospace alignment
- Zero state: show `0` not `—` for counts, show `—` for optional fields

### Dates
- Display format: `"02 Apr 2026, 03:30 PM IST"` via `formatIST()` from `lib/utils.ts`
- Input format: `datetime-local` inputs always use IST conversion via `toDatetimeLocal()`
- Never display raw ISO strings to users

---

## 9. Responsive Design

- Mobile-first: start with base styles, add `sm:` / `md:` for larger screens
- Sidebar: hidden on mobile, visible at `lg:`
- Modals: full-screen drawer on mobile, centered dialog on `md+`
- Tables: horizontal scroll on mobile (`overflow-x-auto`)
- Cards: `grid-cols-1` on mobile, `grid-cols-2` at `sm:`, `grid-cols-3/4` at `md+`

### iOS / PWA
- Safe area insets: use `.pwa-safe-top` / `.pwa-safe-bottom` utility classes
- Input font-size: always `≥ 16px` on mobile to prevent auto-zoom (enforced in `globals.css`)
- Notifications: always via `ServiceWorker.showNotification()` — never `new Notification()`

---

## 10. Dark Mode Rules

- Never hardcode `bg-white`, `text-black`, `border-gray-*`
- Test every new component in both light and dark before shipping
- Date inputs: add `[color-scheme:dark]` class in dark contexts
- Images/avatars: use `AvatarFallback` with initials as default — never `<img>` without fallback
- Charts (`recharts`): use CSS variable colours, not hardcoded hex

---

## 11. Global Shared Components

> Check `componentsHistory.md` before creating any new component.

| Component | File | When to use |
|-----------|------|------------|
| `DataTable` | `shared/DataTable.tsx` | All tabular data |
| `Pagination` | `shared/Pagination.tsx` | Any paginated list |
| `ResponsiveModal` | `shared/ResponsiveModal.tsx` | All create/edit dialogs |
| `ConfirmDialog` | `shared/ConfirmDialog.tsx` | All delete confirmations |
| `PageHeader` | `shared/PageHeader.tsx` | Every page title + action slot |
| `EmptyState` | `shared/EmptyState.tsx` | Empty list/query states |
| `LoadingSkeleton` | `shared/LoadingSkeleton.tsx` | Loading placeholders |
| `SearchInput` | `shared/SearchInput.tsx` | Debounced search fields |
| `ThemeToggle` | `shared/ThemeToggle.tsx` | Light/Dark/System — always in header |

---

## 12. Anti-Patterns — Never Do These

| ❌ Don't | ✅ Do instead |
|----------|--------------|
| `bg-white text-gray-900` | `bg-card text-card-foreground` |
| `useState` + `useEffect` for server data | `useQuery` hook |
| `new Notification(title)` | `serviceWorker.showNotification()` |
| Inline Framer Motion variants | Import from `lib/animations.ts` |
| Build a new table component | Use `DataTable` |
| Build a new modal component | Use `ResponsiveModal` |
| `res.json()` in backend | `sendSuccess()` / `sendError()` |
| `any` TypeScript type | Proper interface or `unknown` |
| Show loading spinner for full page | `LoadingSkeleton` matching layout |
| Animate `width`/`height` | `scaleX`/`scaleY` |
| Hardcode `color: #3b82f6` in JSX | `text-primary` / `bg-primary` |
| Placeholder-only form fields | Label above every input |
