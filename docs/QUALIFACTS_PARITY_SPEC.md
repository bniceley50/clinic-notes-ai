# Qualifacts / CareLogic UI Parity Spec

This spec captures the visible UI tokens and page patterns observed from the currently open Qualifacts public login page and the logged-in CareLogic dashboard shell. Values below are exact hex or px values extracted from screenshots or measured directly from the visible UI.

## 1. Color Tokens

- Primary header color: `#3B276A`
- Active nav color: `#746EB1`
- Link/accent blue: `#0B68BB`
- Border color: `#DEE0E4`
- Neutral background 1: `#FFFFFF`
- Neutral background 2: `#F9F9F9`
- Neutral background 3: `#F0F2F5`
- Qualifacts teal brand: `#17AA98`
- Qualifacts teal hero: `#2FB7AB`
- Login CTA orange: `#F36E47`
- Success green visible in dashboard chart: `#3AC43A`
- Warning orange visible on login CTA and accent areas: `#F36E47`
- Error red visible in alerts/navigation accents: `#FF0000`
- Body text neutral: `#222222`
- Secondary text neutral: `#5A5A5A`

## 2. Typography

- Font stack: `Arial, Helvetica, sans-serif`
- Base body size: `12px`
- Table text size: `12px`
- Section heading size: `18px`
- Page title size: `20px`
- Small utility text size: `11px`
- Body line-height: `16px`
- Table line-height: `16px`
- Heading line-height: `22px`
- Header utility text weight: `700`
- Standard UI label weight: `700`

## 3. Spacing + Geometry

- Top nav height: `32px`
- Secondary nav / icon strip height: `40px`
- Sidebar item line box: `28px`
- Button height: `28px`
- Input height: `28px`
- Select height: `28px`
- Checkbox/radio target box: `14px`
- Dense table row height: `28px`
- Dense subtable row height: `24px`
- Table cell padding: `4px 8px`
- Filter row control gap: `8px`
- Panel/card padding: `12px`
- Section spacing: `12px`
- Border radius: `2px`
- Border thickness: `1px`
- Divider thickness: `1px`
- Shadow usage: `none` on standard enterprise surfaces, or visually negligible only

## 4. Page Patterns

- Dashboard summary strip/card pattern:
  - Simple bordered panels on light gray app background
  - Purple section headings
  - Compact summary blocks before dense tables
  - Charts are secondary and boxed, not hero visuals
- Table pattern:
  - White table body with `1px` gray border
  - Header row on `#F0F2F5` or `#F9F9F9`
  - Dense `12px` text with `28px` rows
  - Minimal or no zebra effect
- Filter row pattern:
  - Inline row of compact controls above the table
  - `28px` control height
  - Light gray strip background with `1px` border
  - Buttons align with inputs rather than floating below
- Schedule / day agenda pattern:
  - Time-first left column
  - White rows with thin dividers
  - Dense agenda rows grouped by day or status
  - Current-day emphasis should use subtle tinting, not modern cards
- Reports table pattern:
  - Compact filter row
  - Dense report table as primary content
  - Summary metrics shown in narrow bordered blocks
  - Charts are boxed, subdued, and secondary to tabular reporting
- Note-entry / documentation pattern:
  - Clinical pane styling with `1px` borders and `12px` body copy
  - Section headings in uppercase
  - Metadata block at top before note body
  - Copy/export output must prepend the required review header block

## 5. Screenshot References

- `Qualifacts Platform Login` tab:
  - `#3B276A`, `#17AA98`, `#2FB7AB`, `#F36E47`
  - Public login typography, button treatment, and public brand bar heights
- `CareLogic` dashboard tab:
  - `#746EB1`, `#0B68BB`, `#DEE0E4`, `#F0F2F5`, `#FFFFFF`, `#FF0000`, `#3AC43A`
  - Logged-in header height, dense nav treatment, dense table treatment, subdued chart treatment
- `CareLogic` invalid route tabs:
  - Confirmed the logged-in shell persists the same enterprise chrome and error-state typography
  - Useful for shell parity, not for page-specific schedule/report detail layouts

## SECOND PASS — CORRECTIONS FROM INTERNAL PAGES

### Schedule Day Agenda

- Observed tab URL: `#/schedule`
- Observed result: authenticated CareLogic shell plus internal `404` error page
- Viewport captured: `220px x 1266px`
- Top purple header height: `32px`
- Header color remains `#3B276A`
- Header utility text remains white on purple
- Search / icon row remains visible above the error state
- Error page primary numeral color: `#3D85C6`
- Error page body background: `#F0F0F0`
- Error page action button border: `#9F9F9F`
- Table styling: not observable on this tab
- Agenda rows: not observable on this tab
- Filter/control bar: not observable on this tab
- Input/select/button heights specific to the schedule page interior: not observable on this tab

### Reports

- Observed tab URL: `#/reports`
- Observed result: authenticated CareLogic shell plus internal `404` error page
- Viewport captured: `220px x 1266px`
- Top purple header height: `32px`
- Header color remains `#3B276A`
- Search / icon row remains visible above the error state
- Error page primary numeral color: `#3D85C6`
- Error page body background: `#F0F0F0`
- Error page action button border: `#9F9F9F`
- Reports filter row: not observable on this tab
- Reports table: not observable on this tab
- Reports summary strip: not observable on this tab
- Reports chart treatment: not observable on this tab

### Session Documentation / Workspace

- Observed tab URL: `#/client-search`
- Observed result: authenticated CareLogic shell plus internal `404` error page
- Viewport captured: `437px x 1266px`
- Top purple header height: `32px`
- Header color remains `#3B276A`
- App header text is left-aligned in the purple bar with white utility text
- Search box is visible in the top utility row and remains compact enterprise styling
- Search box visual height from the captured screen: `22px`
- Error page primary numeral color: `#3D85C6`
- Error page body background: `#F0F0F0`
- Error page action button border: `#9F9F9F`
- Documentation pane layout: not observable on this tab
- Note-entry form controls: not observable on this tab
- Metadata placement in the real documentation workspace: not observable on this tab
- Workspace action toolbar: not observable on this tab

### Corrections to First-Pass Assumptions

- First-pass assumption: direct `#/schedule` and `#/reports` hashes exposed the actual internal pages.
  - Correction: the currently open second-pass tabs resolve to authenticated `404` screens, not the real page interiors.
- First-pass assumption: `#/client-search` was a reasonable stand-in for the session documentation workspace.
  - Correction: this tab also resolves to an authenticated `404` screen and provides no documentation-pane evidence.
- First-pass assumption: page-specific table/filter/workspace layouts for schedule, reports, and session documentation could be inferred from the shell.
  - Correction: those layouts remain unverified from second-pass evidence because the target interiors were not visible.
- First-pass assumption: a time-first agenda, dense reports table with summary strip, and clinical note workspace layout were source-observed.
  - Correction: those were inferred patterns, not observed internal page layouts.
- Verified second-pass evidence:
  - Authenticated shell color and density assumptions remain valid.
  - Internal error-state pages use the same shell chrome, `#3B276A` top header, light gray page field, and blue `404` treatment.
