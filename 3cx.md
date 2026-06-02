# 3CX Integration — Delta Institutions CRM

> Full implementation guide based on the working 3cxExample project.
> Our stack: Express + TypeScript + MongoDB + Next.js 14.

---

## Overview

The 3CX integration connects our CRM phone system so agents can:

- **Click-to-call** any lead directly from the leads table or lead detail page
- **Auto-log every call** (inbound, outbound, missed) with duration + agent name
- **Play call recordings** inside the CRM
- **Inbound caller lookup** — when a lead calls, 3CX shows their name + opens their CRM page
- **Auto-create leads** from unknown inbound numbers
- **QC review** — rate calls, add notes, flag issues
- **Recent calls dashboard** per agent (filtered by extension)

---

## How 3CX ↔ CRM Works (Big Picture)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         3CX Phone System                            │
│                                                                     │
│  Call received ──→ 3CX reads XML template ──→ HTTP → CRM backend   │
│  Call ends     ──→ 3CX posts call journal  ──→ HTTP → CRM backend   │
└─────────────────────────────────────────────────────────────────────┘
          ↕ REST API
┌─────────────────────────────────────────────────────────────────────┐
│                       CRM Backend (Express)                         │
│                                                                     │
│  /api/v1/calls/contact-lookup   ← 3CX queries on inbound call      │
│  /api/v1/calls/contact-search   ← 3CX searches by name/text        │
│  /api/v1/calls/contact-create   ← 3CX creates lead for unknowns    │
│  /api/v1/calls/journal          ← 3CX posts when call ends         │
│  /api/v1/calls/lead/:leadId     ← CRM fetches history for a lead   │
│  /api/v1/calls/click            ← CRM logs outbound click-to-call  │
│  /api/v1/calls/recent           ← Agent's recent call list         │
│  /api/v1/calls/qc-queue         ← QC dashboard data               │
│  /api/v1/calls/:callId/qc       ← Save QC review                  │
│  /api/v1/calls/3cx-template     ← Download XML setup template      │
└─────────────────────────────────────────────────────────────────────┘
          ↕ React Query
┌─────────────────────────────────────────────────────────────────────┐
│                       CRM Frontend (Next.js)                        │
│                                                                     │
│  ClickToCall component  → dropdown: 3CX Web Client / tel: / copy   │
│  CallsPanel component   → call history + recordings per lead       │
│  QCDashboard page       → review queue, ratings, notes             │
│  Settings page          → XML template download + setup guide      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3CX Configuration (XML Template)

The XML template tells 3CX how to talk to our backend. It defines **4 scenarios**:

### Scenario 1 — LookupContactByPhoneNumber
- **When:** Every inbound call
- **What:** `GET /api/v1/calls/contact-lookup?phone_number=[Number]`
- **Result:** 3CX shows caller's name, opens CRM page on agent's screen

### Scenario 2 — LookupByEmail
- **When:** Alternative search
- **What:** `GET /api/v1/calls/contact-search?search_text=[Email]`

### Scenario 3 — CreateContactRecord
- **When:** Inbound call from unknown number
- **What:** `POST /api/v1/calls/contact-create`
- **Result:** Auto-creates new lead in CRM with source = "inbound_call"

### Scenario 4 — ReportCall (4 variants)
- **When:** Call ends (answered / missed / outbound / not-answered)
- **What:** `POST /api/v1/calls/journal`
- **Payload includes:** duration, agent extension, recording file URL, timestamps

> The XML template is served by our backend at `GET /api/v1/calls/3cx-template`
> Admin downloads it → uploads to 3CX Admin → Integrations → CRM

---

## What We Need to Build

### Already Done ✅
- Extension field saved on all 13 agents in production DB
- `GET /api/v1/calls/lead/:leadId` — fetches call logs from 3CX XAPI
- `CallsPanel` component on lead detail page
- Call button on leads table (both mobile + desktop)
- Call button next to phone number on lead detail page
- 3CX OAuth token fetch + cache

### Still To Build 🔨

#### Backend (callController.ts)
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/calls/contact-lookup` | GET | None | 3CX queries — find lead by phone |
| `/calls/contact-search` | GET | None | 3CX queries — search by name/text |
| `/calls/contact-create` | POST | None | 3CX creates lead from unknown caller |
| `/calls/journal` | POST | None | 3CX posts call details when call ends |
| `/calls/lead/:leadId` | GET | Auth | ✅ Done — call history for a lead |
| `/calls/click` | POST | Auth | Log outbound click-to-call attempt |
| `/calls/recent` | GET | Auth | Agent's recent calls (by extension) |
| `/calls/qc-queue` | GET | Auth | Calls pending QC review |
| `/calls/:callId/qc` | PUT | Auth | Save QC rating/notes/status |
| `/calls/:callId` | GET | Auth | Single call detail |
| `/calls/3cx-template` | GET | None | Download XML template |

#### Database — New Collection: `call_logs`
```typescript
{
  _id:                ObjectId,
  leadId:             ObjectId | null,     // linked lead
  contactType:        "lead" | "unknown",
  contactName:        string | null,
  phoneNumber:        string,
  callType:           "Inbound" | "Outbound" | "Missed" | "Notanswered",
  callDirection:      "Inbound" | "Outbound",
  callDuration:       number,              // seconds
  callDate:           Date,
  recordingUrl:       string | null,
  agentExtension:     string | null,
  agentName:          string | null,
  notes:              string | null,
  initiatedBy:        ObjectId | null,     // for click-to-call
  status:             "initiated" | "completed",
  qcRating:           number | null,       // 1–5
  qcNotes:            string | null,
  qcStatus:           "pending" | "reviewed" | "flagged",
  qcReviewedBy:       ObjectId | null,
  qcReviewedAt:       Date | null,
  source:             "3cx" | "click2call",
  createdAt:          Date,
  updatedAt:          Date,
}
```

#### Frontend Components / Pages
| File | What |
|---|---|
| `components/leads/ClickToCall.tsx` | Dropdown button: 3CX Web Client / tel: / copy |
| `components/leads/CallsPanel.tsx` | ✅ Done — call history + recordings per lead |
| `app/(dashboard)/calls/page.tsx` | Recent calls dashboard (all agents or filtered) |
| `app/(dashboard)/calls/qc/page.tsx` | QC review queue |

---

## Endpoint Specs (What Each Must Do)

### `GET /calls/contact-lookup?phone_number=+971501234567`
> Called by 3CX on every inbound call. **No auth required.**

```typescript
// 1. Normalize phone (strip non-digits)
// 2. Search Lead collection by phone
// 3. If found → return contact details
// 4. If not found → return { found: false }

// Response (found):
{
  found: true,
  contact_id: lead._id,
  first_name: "Anfas",
  last_name: "",
  email: "anfas@example.com",
  phone_mobile: "+971501234567",
  company_name: null,
  contact_url: "https://crm.deltainstitutions.com/leads/{leadId}",
  contact_type: "lead"
}

// Response (not found):
{ found: false }
```

### `POST /calls/contact-create`
> Called by 3CX when inbound number has no match. **No auth required.**

```typescript
// Body: { phone_number, first_name, last_name }
// 1. Check if lead with phone already exists → return existing
// 2. Create new Lead with:
//    - source: "inbound_call"
//    - status: "new"
//    - reporter: Super Admin ID

// Response:
{ success: true, contact_id: "...", contact_url: "...", message: "Created" }
```

### `POST /calls/journal`
> Called by 3CX when call ends. **No auth required.**

```typescript
// Body:
{
  call_type: "Inbound" | "Outbound" | "Missed" | "Notanswered",
  phone_number: "+971501234567",
  call_direction: "Inbound" | "Outbound",
  name: "John Doe",
  contact_id: "lead ObjectId or null",
  call_duration: 300,
  timestamp: "2026-04-27T10:30:00Z",
  recording_file: "https://3cx.../recording.wav",
  agent_extension: "416",
  agent_name: "Anfas"
}

// Actions:
// 1. Insert into call_logs collection
// 2. If contact_id given → add activityLog to Lead ("call_logged")
// 3. If recording_file given → update lead with last recording URL
```

### `POST /calls/click`
> CRM frontend logs when agent clicks call button. **Auth required.**

```typescript
// Query params: phone_number, lead_id
// Actions:
// 1. Lookup agent's extension from User model
// 2. Insert into call_logs: { status: "initiated", source: "click2call" }
// 3. Return: { success: true, call_id, extension, phone_number }
```

### `GET /calls/recent?limit=50&extension=416`
> Agent's recent call list. **Auth required.**
> Filters by extension if provided, else returns all (admin only).

### `GET /calls/qc-queue?status=pending&limit=100`
> Calls for QC review. **Auth required.**

### `PUT /calls/:callId/qc`
> Save QC review. **Auth required.**
```typescript
// Body: { recording_url, qc_rating: 1-5, qc_notes, qc_status }
```

### `GET /calls/3cx-template`
> Returns XML template for 3CX admin to download and upload. **No auth.**
> XML tells 3CX: use our backend for contact lookup, create, journal.

---

## ClickToCall Component (Full Spec)

Replaces the simple green anchor tag we have now with a proper dropdown.

```tsx
// Props
interface ClickToCallProps {
  phoneNumber: string;
  leadId?: string;
  leadName?: string;
  variant?: "ghost" | "outline";
  showLabel?: boolean;
}

// Dropdown options:
// 1. "Call via 3CX Web Client"
//    → window.open(`${THREECX_URL}/#/make-call/${cleanPhone}`, '_blank')
//    → POST /calls/click { phone_number, lead_id }
//    → toast: "Opening 3CX..."

// 2. "Call via tel: protocol"
//    → window.location.href = `tel:${cleanPhone}`
//    → POST /calls/click { phone_number, lead_id }
//    → toast: "Dialing..."

// 3. separator
// 4. "Copy number" → clipboard + toast
// 5. separator  
// 6. disabled item showing the raw phone number (info)
```

---

## QC Dashboard (Full Spec)

New page at `/calls/qc`.

**Layout:**
- Stats row: Pending | Reviewed | Flagged | Total
- Filter: status dropdown + date range
- Table: Type icon | Contact | Phone | Duration | Date | Extension | Recording | Rating | QC Status | Review button
- Review modal: call info (read-only) + recording URL input + star rating (1–5) + status dropdown + notes textarea

**Access:** Admin + managers only

---

## User Extension Field

Already stored in production DB. Also needs to be on the User model and returned in API:

```typescript
// backend/src/models/User.ts — add field:
extension: {
  type: String,
  trim: true,
  default: null,
}

// Also expose in user profile response so frontend knows current user's extension
```

---

## Phone Number Normalization

Critical for accurate matching. Use this everywhere:

```typescript
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "");
}

// Match strategy (MongoDB):
// 1. Exact match after normalization
// 2. Last-10-digits match (handles country code variations)
// Pattern: { $regex: normalizePhone(phone) + "$" }
```

---

## 3CX Auth (Already Working)

```typescript
// Token endpoint: POST /connect/token
// grant_type: client_credentials
// client_id: deltaleads
// client_secret: <THREECX_API_KEY from .env>
// Token expires in 60s — auto-refreshed with 10s buffer

// Role must be Admin in 3CX service principal for:
// - ActiveCalls
// - ReportCallLogData
// - Recordings
```

**Current Status:** Token fetches successfully (HTTP 200). `MaxRole: users` because service principal role needs to be changed to **Admin** in 3CX admin panel.

---

## Environment Variables

```bash
# backend/.env
THREECX_URL=https://deltainstitutions.3cx.ae:5002
THREECX_CLIENT_ID=deltaleads
THREECX_API_KEY=reGPssktMJqzppVTVB2iL0o62Lcuqnmw

# frontend — add to next.config.js publicRuntimeConfig or .env.local
NEXT_PUBLIC_THREECX_URL=https://deltainstitutions.3cx.ae:5002
```

---

## Agent Extension Map (Production)

| Agent | DB Email | Extension |
|---|---|---|
| Abrar | abrar@deltainstitutions.com | 400 |
| Theertha | theertha@deltainstitutions.com | 402 |
| Yamini | yamini@deltainstitutions.com | 403 |
| Shahana | shahana@deltainstitutions.com | 405 |
| Nusra | nusra@deltainstitutions.com | 411 |
| Ria | ria@deltainstitutions.com | 413 |
| Gopika | gopika@deltainstitutions.com | 414 |
| Jalwa | jalwa@deltainstitutions.com | 415 |
| Anfas | anfas@deltainstitutions.com | 416 |
| Ayna | ayna@deltainstitutions.com | 417 |
| Sunaina | sunaina@deltainstitutions.com | 418 |
| Neethu | neethu@deltainstitutions.com | 419 |
| Athira | athira@deltainstitutions.com | 428 |

> Extensions already saved in production DB via mongosh. Also need `extension` field on User Mongoose model.

---

## 3CX XML Template — What to Include

The XML file you upload to 3CX Admin → Integrations → CRM must point to your **production backend URL**.

```xml
<!-- Key endpoints used by 3CX -->
Contact Lookup:  GET  https://api-crm.deltainstitutions.com/api/v1/calls/contact-lookup?phone_number=[Number]
Contact Search:  GET  https://api-crm.deltainstitutions.com/api/v1/calls/contact-search?search_text=[SearchText]
Contact Create:  POST https://api-crm.deltainstitutions.com/api/v1/calls/contact-create
Call Journal:    POST https://api-crm.deltainstitutions.com/api/v1/calls/journal
```

> These endpoints must be **publicly accessible** (no auth header) because 3CX calls them directly.
> Use IP whitelisting on nginx if security is a concern.

---

## Build Order (What to Implement Next)

```
Step 1 — Add CallLog Mongoose model  (new file: models/CallLog.ts)
Step 2 — Add remaining endpoints to callController.ts:
          contact-lookup, contact-search, contact-create, journal, click, recent, qc-queue, :id/qc, 3cx-template
Step 3 — Update callRoutes.ts with all new routes
Step 4 — Add extension field to User model (already in DB, just needs schema)
Step 5 — Replace simple call button with ClickToCall dropdown component
Step 6 — Add /calls page (recent calls for agents)
Step 7 — Add /calls/qc page (QC dashboard for managers)
Step 8 — Upload XML template to 3CX admin and test
Step 9 — Change 3CX service principal role to Admin → get new API key → test call log fetch
```

---

## Current State (What's Live)

| Feature | Status |
|---|---|
| Extensions saved in DB | ✅ Done |
| Call button on leads table | ✅ Done (simple link) |
| Call button on lead detail | ✅ Done (simple link) |
| CallsPanel on lead detail | ✅ Done (fetches from 3CX XAPI) |
| 3CX OAuth token fetch | ✅ Done (HTTP 200) |
| Call logs loading from 3CX | ⚠️ Needs Admin role on service principal |
| ClickToCall dropdown component | 🔨 To build (replace simple link) |
| contact-lookup endpoint | 🔨 To build |
| contact-create endpoint | 🔨 To build |
| call-journal endpoint | 🔨 To build |
| CallLog DB collection | 🔨 To build |
| Recent calls page | 🔨 To build |
| QC dashboard | 🔨 To build |
| XML template endpoint | 🔨 To build |
| Upload XML to 3CX | ⏳ After backend is ready |
