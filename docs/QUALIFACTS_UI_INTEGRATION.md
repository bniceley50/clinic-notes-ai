# Qualifacts CareLogic UI Integration Plan
# Clinic Notes AI — Companion App

> **Date:** 2026-03-04
> **Author:** Claude (research + planning)
> **Status:** READY FOR IMPLEMENTATION
> **Scope:** Visual alignment + workflow integration with Qualifacts CareLogic

---

## 1. Executive Summary

This document covers the complete plan to align Clinic Notes AI's UI with
Qualifacts CareLogic so clinicians experience a seamless visual handoff between
the two tools. The companion app handles the note-drafting burden; CareLogic
remains the system of record. The integration is **non-invasive** — we adapt
our theme/components to match their palette, and output in the format CareLogic
expects. We do NOT attempt to log into or automate CareLogic on the user's behalf.

---

## 2. Qualifacts CareLogic Design Tokens (Extracted Live)

> Source: Live inspection of `https://login.qualifacts.org/carelogic/#/`
> Session: Marksberry, Gillian (50448) — Community Behavioral Health
> Captured: 2026-03-04

### 2.1 Color Palette

| Token Name              | Hex       | RGB                   | Usage in CareLogic                        |
|-------------------------|-----------|-----------------------|-------------------------------------------|
| `ql-purple-deep`        | `#3B276A` | rgb(59, 39, 106)      | Top banner, primary buttons, Submit/Reset |
| `ql-purple-medium`      | `#746EB1` | rgb(116, 110, 177)    | Active nav item background                |
| `ql-purple-light`       | `#7E7DB5` | rgb(126, 125, 181)    | PRODUCTION badge, secondary accents       |
| `ql-purple-muted`       | `#CCCBe4` | rgb(204, 203, 228)    | Hover states, muted backgrounds           |
| `ql-blue-link`          | `#517AB7` | rgb(51, 122, 183)     | Hyperlinks, Reports nav item, data links  |
| `ql-teal-accent`        | `#00B0A0` | ~teal                 | Dashboards nav item (visual inspection)  |
| `ql-green-chart`        | `#4CAF50` | ~green                | Bar chart fill, positive indicators       |
| `ql-red-alert`          | `#FF0000` | rgb(255, 0, 0)        | OARS Rx nav, My Alerts nav, failed states |
| `ql-bg-nav`             | `#F9F9F9` | rgb(249, 249, 249)    | Navigation bar background                 |
| `ql-bg-white`           | `#FFFFFF` | rgb(255, 255, 255)    | Content panels, table rows, cards         |
| `ql-bg-row-alt`         | `#F0F0F0` | ~light gray           | Alternating table rows, section headers   |
| `ql-text-primary`       | `#333333` | rgb(51, 51, 51)       | Body text, nav items (default)            |
| `ql-text-dark`          | `#0B1215` | rgb(11, 18, 21)       | Active nav text, bold headings            |
| `ql-text-muted`         | `#777777` | rgb(119, 119, 119)    | Secondary labels, timestamps              |
| `ql-border-subtle`      | `#E7E9EC` | rgb(231, 233, 236)    | Card borders, separator lines             |
| `ql-border-table`       | `#D0D0D0` | ~light gray           | Table cell borders                        |

### 2.2 Typography

| Element              | Font Family | Size   | Weight | Notes                          |
|----------------------|-------------|--------|--------|--------------------------------|
| Body / Default       | Arial       | 13px   | 400    | System sans-serif              |
| Nav items (default)  | Arial       | 13px   | 400    | `#0B1215`                      |
| Nav items (active)   | Arial       | 13px   | 700    | Bold, white on `#746EB1`       |
| Favorites nav        | Arial       | 13px   | 700    | Always bold                    |
| Section headings     | Arial       | 14px   | 700    | Blue (`#517AB7`), all-caps     |
| Button text          | Arial       | 14px   | 400    | White on `#3B276A`             |
| Table header text    | Arial       | 13px   | 700    | Dark on `#F0F0F0` bg           |
| Table body text      | Arial       | 13px   | 400    | `#333333`                      |
| Badge/label text     | Arial       | 11px   | 400    | Uppercase, various bg          |

### 2.3 Layout & Spacing

| Element               | Value              | Notes                                    |
|-----------------------|--------------------|------------------------------------------|
| Top banner height     | 32px               | Purple `#3B276A`, org name + env badge   |
| Nav bar height        | 74px               | White/light gray, logo + main nav        |
| Nav item padding      | ~8px 12px          | Horizontal nav, dropdown on hover        |
| Button border-radius  | 2px                | Flat, nearly square corners              |
| Button padding        | 4px 16px           | Compact, tight vertical padding          |
| Card border           | 1px solid `#E7E9EC`| No border-radius on cards                |
| Card border-radius    | 0px                | Completely flat/square cards             |
| Table cell padding    | ~4px 8px           | Compact table density                    |
| Page content padding  | ~16px              | Loose internal page margin               |
| Content max-width     | Full viewport      | No max-width constraint, edge-to-edge    |

### 2.4 UI Patterns & Widgets

| Pattern               | Description                                          |
|-----------------------|------------------------------------------------------|
| Navigation            | Horizontal top nav with dropdown submenus            |
| Active state          | Purple bg + white text on active nav item            |
| Buttons               | Flat `#3B276A` fill, white text, 2px radius          |
| Tables                | Bordered, zebra rows (white / `#F0F0F0`), dense      |
| Data entry rows       | Row with [C][G][S] mini-buttons for context actions  |
| Charts                | Green bar charts, multicolor pie charts (inline)     |
| Badges/chips          | Colored bg, uppercase, 11px font, no border-radius   |
| Date picker           | Left sidebar mini-calendar, week view                |
| Search bar            | Input with border in nav area                        |
| Alerts/flags          | Red text, red icons for alerts and flagged items     |
| Page titles           | Inline `h4`/`p` level, not large hero headings       |

---

## 3. Current App Analysis

### 3.1 What's In Place

| File                                          | Current State                              |
|-----------------------------------------------|--------------------------------------------|
| `src/app/globals.css`                         | Only `@import "tailwindcss"` — blank slate |
| `src/app/layout.tsx`                          | Inter font, no theme vars yet              |
| `src/components/jobs/CreateJobForm.tsx`       | `bg-blue-600` buttons, `border-gray-300`  |
| `src/components/jobs/JobStatusPanel.tsx`      | `bg-blue-500` progress bar, generic colors |
| `src/components/sessions/CreateSessionForm.tsx`| `bg-blue-600` button, generic gray labels  |
| `src/app/(dashboard)/layout.tsx`              | Not created yet (Milestone 0)              |
| `src/components/layout/Sidebar.tsx`           | Not created yet (Milestone 0)              |
| `src/components/layout/Header.tsx`            | Not created yet (Milestone 0)              |

### 3.2 Gaps vs CareLogic

| Gap Area                        | Current                    | Target (CareLogic-aligned)       |
|---------------------------------|----------------------------|----------------------------------|
| Font family                     | Inter (Google Font)        | System sans-serif / Arial        |
| Primary action color            | `blue-600` (#2563EB)       | `#3B276A` (deep purple)          |
| Card border-radius              | `rounded-lg` (8px)         | 0px (square corners)             |
| Card shadow                     | `shadow-sm`                | 1px border only, no shadow       |
| Button border-radius            | `rounded-md` (6px)         | `2px` (near-flat)                |
| Button padding                  | `px-4 py-2`                | `px-4 py-1` (compact)            |
| Status badges                   | Colored bg + text          | Keep, but adjust colors          |
| Progress bar                    | `bg-blue-500`              | `bg-[#3B276A]` (purple)          |
| Focus ring                      | `focus:ring-blue-500`      | `focus:ring-[#746EB1]` (medium purple) |
| Section heading color           | `text-gray-900`            | `text-[#517AB7]` (CareLogic blue)|

---

## 4. Implementation Plan

### Phase 1: Theme Foundation (globals.css + layout.tsx)
**Effort: ~1 hour | Risk: LOW**

Replace Inter with system fonts and define Qualifacts-aligned CSS custom
properties in `globals.css`:

```css
/* src/app/globals.css */
@import "tailwindcss";

@layer base {
  :root {
    /* Qualifacts CareLogic Color System */
    --ql-purple-deep:    59 39 106;    /* #3B276A - primary actions */
    --ql-purple-medium:  116 110 177;  /* #746EB1 - active states */
    --ql-purple-light:   126 125 181;  /* #7E7DB5 - accents/badges */
    --ql-blue-link:      51 122 183;   /* #517AB7 - links/headings */
    --ql-red-alert:      255 0 0;      /* #FF0000 - alerts/errors */
    --ql-green-success:  76 175 80;    /* #4CAF50 - success states */
    --ql-teal:           0 176 160;    /* #00B0A0 - secondary accent */

    /* Backgrounds */
    --ql-bg-nav:         249 249 249;  /* #F9F9F9 - nav background */
    --ql-bg-white:       255 255 255;  /* #FFFFFF - content */
    --ql-bg-row-alt:     240 240 240;  /* #F0F0F0 - zebra row */

    /* Text */
    --ql-text-primary:   51 51 51;     /* #333333 - body text */
    --ql-text-dark:      11 18 21;     /* #0B1215 - nav items */
    --ql-text-muted:     119 119 119;  /* #777777 - secondary */

    /* Borders */
    --ql-border-subtle:  231 233 236;  /* #E7E9EC - card borders */
  }
}
```

In `layout.tsx`, drop the Inter import and use system fonts:

```tsx
// Remove: import { Inter } from "next/font/google";
// Replace with:
<html lang="en">
  <body style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}>
    {children}
  </body>
</html>
```

### Phase 2: shadcn/ui Theme Override (components.json + CSS vars)
**Effort: ~2 hours | Risk: LOW**

shadcn's zinc theme currently maps `--primary` to zinc. Override it to match
CareLogic's purple:

Add to `globals.css` after the Tailwind import:

```css
@layer base {
  :root {
    --background: 255 255 255;
    --foreground: 51 51 51;
    --card: 255 255 255;
    --card-foreground: 51 51 51;
    --primary: 59 39 106;          /* #3B276A — deep purple */
    --primary-foreground: 255 255 255;
    --secondary: 116 110 177;      /* #746EB1 — medium purple */
    --secondary-foreground: 255 255 255;
    --accent: 51 122 183;          /* #517AB7 — CareLogic blue */
    --accent-foreground: 255 255 255;
    --destructive: 255 0 0;
    --destructive-foreground: 255 255 255;
    --border: 231 233 236;
    --input: 231 233 236;
    --ring: 116 110 177;           /* #746EB1 — focus ring */
    --radius: 0.125rem;            /* 2px — flat CareLogic style */
    --muted: 249 249 249;
    --muted-foreground: 119 119 119;
  }
}
```

**Key override:** `--radius: 0.125rem` (2px) makes ALL shadcn components
use CareLogic's flat corner style globally.

### Phase 3: Component Updates
**Effort: ~3 hours | Risk: LOW**

#### 3a. CreateJobForm.tsx and CreateSessionForm.tsx
Replace hardcoded `blue-600` → `primary` (which now maps to `#3B276A`):

```tsx
// Before:
className="...bg-blue-600 hover:bg-blue-700 focus:ring-blue-500..."

// After:
className="...bg-primary hover:bg-primary/90 focus:ring-primary/50..."
```

Replace input focus rings:
```tsx
// Before: focus:border-blue-500 focus:ring-blue-500
// After:  focus:border-secondary focus:ring-secondary/50
```

#### 3b. JobStatusPanel.tsx
Map status colors to CareLogic conventions:

```tsx
const JOB_STATUS_STYLE: Record<string, string> = {
  queued:    "bg-[#FFF8E7] text-[#3B276A] border border-[#CCCBe4]",
  running:   "bg-[#EEF2FF] text-[#746EB1] border border-[#CCCBe4]",
  complete:  "bg-[#E8F5E9] text-[#2E7D32]",
  failed:    "bg-red-50 text-[#FF0000]",
  cancelled: "bg-[#F9F9F9] text-[#777777]",
};
```

Progress bar:
```tsx
// Before: bg-blue-500
// After:  bg-[#3B276A]
```

### Phase 4: Dashboard Shell (New Components)
**Effort: ~4 hours | Risk: MEDIUM — new files**

When building the dashboard layout (Milestone 0/A), structure it to mirror
CareLogic's layout pattern. CareLogic uses a horizontal top nav — our app
should match this (or use a left sidebar with matching purple branding).

#### 4a. `src/components/layout/Header.tsx`

```tsx
// Design spec:
// - Top banner: 32px, bg-[#3B276A], white text, org name + env badge
// - Nav bar: 74px, bg-[#F9F9F9], logo + horizontal nav items
// - Active nav: bg-[#746EB1] text-white
// - Logo: Use Qualifacts-inspired green circle or clinic name mark
// - Search bar: inline in nav, matches CareLogic search field style
```

#### 4b. `src/components/layout/Sidebar.tsx`

If using a sidebar instead of top-nav (better for mobile-first), use these tokens:
```tsx
// Sidebar brand bar: bg-[#3B276A]
// Sidebar bg: bg-[#F9F9F9] 
// Active item: bg-[#746EB1] text-white rounded-[2px]
// Item text: text-[#0B1215] text-sm font-normal
// Border: border-r border-[#E7E9EC]
```

### Phase 5: Export Format for CareLogic Transfer
**Effort: ~2 hours | Risk: LOW**

This is the actual workflow bridge. Clinicians complete a note in Clinic Notes AI,
then paste/transfer it into CareLogic. The export must be formatted for easy paste.

#### 5a. Plain Text Export (Primary)

CareLogic's note entry fields are plain text areas. Export format:

```
SOAP NOTE — [Session Date]
Patient: [Patient Label]
Provider: [Provider Name]
Generated by: Clinic Notes AI | AI-GENERATED — REVIEW REQUIRED

--- SUBJECTIVE ---
[Content]

--- OBJECTIVE ---
[Content]

--- ASSESSMENT ---
[Content]

--- PLAN ---
[Content]
```

#### 5b. One-Click Copy Button

Add a "Copy for CareLogic" button to the note viewer that:
1. Formats the note with the header above
2. Copies to clipboard via `navigator.clipboard.writeText()`
3. Shows a toast: "Copied! Ready to paste into CareLogic."

#### 5c. DOCX Export (Secondary)

The existing `docx` dependency handles this. Add CareLogic-formatted DOCX export
with matching Arial font, 13px body text, section headers in `#517AB7`.

### Phase 6: CareLogic-Style Table Components
**Effort: ~2 hours | Risk: LOW**

The session list and job history should mirror CareLogic's table style:

```tsx
// Table design spec (CareLogic-aligned):
// - No border-radius on table wrapper
// - Header row: bg-[#F0F0F0], font-bold, text-[#333333], border-b
// - Body rows: alternating white / #F9F9F9
// - Cell padding: py-1 px-2 (compact, CareLogic-dense)
// - Border: border border-[#D0D0D0] border-collapse
// - Row hover: bg-[#EEF2FF] (subtle purple tint)
// - Font: text-sm (13px equivalent)
```

---

## 5. File-by-File Change Summary

| File                                           | Change Type   | What Changes                                    |
|------------------------------------------------|---------------|-------------------------------------------------|
| `src/app/globals.css`                          | REWRITE       | Add all CSS vars, font override, base styles    |
| `src/app/layout.tsx`                           | EDIT          | Remove Inter, use system fonts                  |
| `src/components/jobs/CreateJobForm.tsx`        | EDIT          | blue-600 → primary throughout                   |
| `src/components/jobs/JobStatusPanel.tsx`       | EDIT          | Status colors, progress bar color               |
| `src/components/sessions/CreateSessionForm.tsx`| EDIT          | blue-600 → primary throughout                   |
| `src/components/layout/Header.tsx`             | CREATE NEW    | CareLogic-aligned top header                    |
| `src/components/layout/Sidebar.tsx`            | CREATE NEW    | CareLogic-aligned sidebar navigation            |
| `src/lib/export/docx.ts`                       | EDIT          | CareLogic DOCX format (Arial, section headers)  |
| `src/components/session/NoteViewer.tsx`        | CREATE NEW    | "Copy for CareLogic" button                     |

---

## 6. Tailwind v4 Implementation Notes

Your project uses Tailwind v4 (confirmed via `@tailwindcss/postcss` in package.json).
In v4, the CSS variable syntax changed — use raw CSS custom properties instead of
the v3 `theme.extend` approach:

```css
/* globals.css — Tailwind v4 way */
@import "tailwindcss";

@theme {
  --color-primary: #3B276A;
  --color-primary-hover: #4d3880;
  --color-secondary: #746EB1;
  --color-accent: #517AB7;
  --color-destructive: #FF0000;
  --color-muted: #F9F9F9;
  --color-border: #E7E9EC;
  --color-text-primary: #333333;
  --color-text-muted: #777777;
  --font-family-base: Arial, "Helvetica Neue", Helvetica, sans-serif;
  --radius-sm: 2px;
  --radius-md: 2px;
  --radius-lg: 4px;
}
```

Then in components, use: `bg-primary`, `text-accent`, `border-border`, etc.

---

## 7. HIPAA & Interoperability Checklist

| Item                                          | Status      | Notes                                             |
|-----------------------------------------------|-------------|---------------------------------------------------|
| No PHI in browser storage or logs             | Required    | Already in SECURITY.md — maintain                 |
| No direct API calls to CareLogic              | Required    | Integration is copy-paste only, not API           |
| No patient names in Clinic Notes AI export    | Required    | Use patient labels only (already in schema)       |
| AI-generated watermark on all exports         | Required    | "AI-GENERATED — REVIEW REQUIRED" in all exports  |
| Clinician must review before CareLogic paste  | Required    | UI should enforce review step before copy         |
| No CareLogic credentials stored in app        | Required    | App never handles CareLogic auth                  |
| Audit log for note exports                    | Recommended | Add `exported_at` timestamp to `notes` table      |
| BAA with Supabase before real PHI             | Required    | Milestone C gate — documented in SECURITY.md      |

---

## 8. Questions Before Implementation

Before writing any code, clarify these with Brian:

1. **Navigation pattern:** Does the companion app use a TOP horizontal nav
   (matching CareLogic exactly) or a LEFT sidebar (better for mobile/tablet)?
   A left sidebar is recommended for the note-taking workflow since clinicians
   need a session list always visible.

2. **Logo/branding:** Should the companion app show a custom clinic logo or
   the Clinic Notes AI branding? CareLogic shows "Community Behavioral Health"
   prominently in the banner.

3. **"Copy for CareLogic" UX:** Should the copy button appear automatically
   after AI draft generation, or only after clinician review/sign-off?

4. **Dark mode:** CareLogic is light-mode only. Should the companion app
   match (light only) or support dark mode for night documentation?

5. **Density preference:** CareLogic is very compact (4px cell padding, 13px font).
   Should we match that exact density, or use a slightly more comfortable layout
   given we're building for the documentation workflow (more reading/editing)?

---

## 9. Implementation Order (Recommended)

```
Week 1 (Milestone 0):
  1. globals.css — add all CSS vars (30 min)
  2. layout.tsx — swap font (5 min)
  3. Header.tsx — build CareLogic-aligned header (2 hrs)
  4. Sidebar.tsx — build sidebar with purple nav (2 hrs)

Week 2 (Milestone A):
  5. Update CreateJobForm + CreateSessionForm colors (1 hr)
  6. Update JobStatusPanel colors (30 min)
  7. Build session table with CareLogic table style (2 hrs)
  8. Build NoteViewer with "Copy for CareLogic" button (2 hrs)
  9. Update docx.ts for CareLogic-formatted export (1 hr)

Week 3+ (Milestone B/C):
  10. Mobile responsive pass (ensure tablet works in clinic)
  11. Test copy-paste flow end-to-end with real CareLogic instance
  12. WCAG 2.1 AA contrast check on all purple/white combos
```

---

## 10. Color Contrast Verification

Before shipping, verify WCAG AA compliance (4.5:1 minimum for normal text):

| Foreground     | Background    | Ratio (approx) | AA Pass? |
|----------------|---------------|----------------|----------|
| `#FFFFFF`      | `#3B276A`     | ~9.5:1         | ✅ PASS  |
| `#FFFFFF`      | `#746EB1`     | ~4.6:1         | ✅ PASS  |
| `#333333`      | `#FFFFFF`     | ~12.6:1        | ✅ PASS  |
| `#333333`      | `#F9F9F9`     | ~11.9:1        | ✅ PASS  |
| `#517AB7`      | `#FFFFFF`     | ~4.0:1         | ⚠️ BORDERLINE — use bold |
| `#FF0000`      | `#FFFFFF`     | ~4.0:1         | ⚠️ BORDERLINE — use bold |

---

## 11. Reference Screenshots

The following were captured during this research session:

- Dashboard overview: Full dashboard with task panel, appointment table,
  Cash Collections chart, Claim Engine summary
- Schedule view: Week-view calendar, time-slot table, day sidebar
- Reports submenu: Dropdown showing "Available Reports" / "eMAR Beta Reports"
- Nav detail: OARS Rx (red), My Alerts (red), Reports (blue), Dashboards (teal)
  confirm these are CSS class-driven color overrides, not inline styles

---

*End of document — proceed with Phase 1 (globals.css) to start implementation.*
