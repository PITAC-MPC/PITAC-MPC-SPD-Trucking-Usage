# PITAC-MPC SPD Trucking Usage — App Plan

Desktop app for producing the cooperative's monthly **Trucking Services Billing** sheet:
trucks + plate numbers on the rows, days of the month across the columns, day usage blocks entered
as **date ranges** (one destination for the whole sheet), auto totals with manual trip overrides, and a
**landscape A4** print / PDF output that mirrors the existing paper form.

---

## 1. What the paper form actually is

From the sample (`896731386_...jpg`):

| Part | Contents |
|---|---|
| Control no. | `L 000061`, top-right, per sheet |
| Org header | Pitac Multipurpose Cooperative / address / `TRUCKING SERVICES BILLING` |
| Period line | `Date:` month + day range (`March 01-18 2026`) + location / remarks (`Buchanan / MIS OR Relocation`) |
| Grid | `TRUCKS` (no. + type), `PLATE #`, day columns `1..31`, `# OF TRIPS`, `RATE`, `AMOUNT` |
| Totals | `Total` row — total trips and total amount |
| Signatures | `Prepared By` (name, position, date) / `Approved by` (name, `SPD Manager`) |

Two modelling consequences worth calling out early:

1. **A "used day" mark is really a usage *event***, not 31 independent booleans. The sample's marks
   come in runs (`4–6`, `15–19`, `12–18`) because a truck was on a job for a span of days.
   So the source of truth should be **usage entries** `{ startDate, endDate, trips? }`, and the
   day cells are *derived* highlights. This gives you the "input start + end date → highlight the days"
   behaviour for free, handles ranges that straddle month boundaries, and survives month changes.
   **Destination is sheet-level** (all trucks haul to the same place for the month), printed once in the
   header and inherited by every entry — with an optional per-row/per-entry override for the rare
   exception (the sample's "Wood Corn Seeds / Alcala Hauling" rows).
2. **Rates are per truck and per month** (`12,000`, `4,600`, `3,000`, `2,000`, …) and the amount is
   `trips × rate`. Trips should default to the number of marked days but stay overridable (some days can
   have 2+ trips), and should be *snapshotted* onto a month so editing a truck later doesn't rewrite history.

---

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Shell | Electron 3x | Offline desktop, direct printer access, file storage without a server |
| Build | **electron-vite** + TypeScript | Fast HMR for renderer, simple main/preload bundling |
| UI | React 19 + **Bootstrap 5.3** + `bootstrap-icons` | Bootstrap utilities for the editor forms; small amount of custom CSS for the print table (Bootstrap's table styles are not enough for a fixed A4 grid) |
| Routing | `react-router-dom` (hash router) | Two routes: editor and print view |
| State | Zustand + `immer` + `zundo` (undo/redo) | Tiny, no boilerplate, easy snapshots and time-travel undo |
| Validation | Zod | One schema shared by renderer forms, IPC payloads and the JSON store |
| Dates | `dayjs` + `min-max` of plain `YYYY-MM-DD` strings | Local-date–safe; never send `Date` objects over IPC |
| Persistence | JSON file in `app.getPath('userData')`, atomic write + rolling backups | Data volume is tiny; avoids native modules (`better-sqlite3` rebuild pain) |
| Packaging | `electron-builder` → NSIS installer (Windows) | Standard for this kind of in-house app |
| Testing | Vitest for calc/validation, Playwright + `_electron` for the print/layout smoke test | The risky logic is the day-range math and the print fitting |

> Deliberately **no** react-bootstrap: the editor only needs a handful of form controls and you'll be
> overriding table styles for print anyway. Plain Bootstrap classes keep the dependency surface small.
> If you'd rather have typed components, react-bootstrap is a drop-in later.

---

## 3. Process architecture

```
main/                        preload/                  renderer/
  index.ts        window + menu         index.ts     contextBridge: window.api (typed)
  store.ts        read/write JSON,      shared/       types.ts, schemas.ts (zod),
                  backups, migrations                 dates.ts, calc.ts  (pure, unit-tested)
  print.ts        print + printToPDF                 app/
  ipc.ts          channel handlers                   routes/BillingEditor.tsx
  settings.ts     printer, org defaults              routes/PrintSheet.tsx  (A4 landscape)
                                                     features/trucks/  features/sheet/  features/usage/
                                                     components/DayGrid.tsx  SheetHeader.tsx  SignatureBlock.tsx
                                                     store/sheetStore.ts
```

Security baseline: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP set, and
only the channels below exposed. No remote content. `app.requestSingleInstanceLock()` prevents two copies
from writing `data.json` at once; the second launch focuses the existing window.

### IPC surface (typed in `shared/types.ts`)

| Channel | Direction | Payload → Result |
|---|---|---|
| `sheets:list` | invoke | `{ year? }` → `SheetSummary[]` |
| `sheets:get` | invoke | `id` → `BillingSheet \| null` |
| `sheets:save` | invoke | `BillingSheet` → `{ id, updatedAt }` (zod-validated, atomic write) |
| `sheets:duplicate` | invoke | `{ id, month }` → `BillingSheet` |
| `sheets:delete` | invoke | `id` → `void` (soft delete to `trash/`) |
| `trucks:list/save/delete` | invoke | truck CRUD |
| `settings:get/set` | invoke | org name, address, default rate, printer name, default signatories |
| `print:sheet` | invoke | `{ id, mode: 'printer' \| 'pdf' }` → `{ ok }` / `{ pdfPath }` (pdf opens a save dialog) |
| `app:backupNow` | invoke | → `{ path }` |

---

## 4. Data model

```ts
type ISODate = string;        // 'YYYY-MM-DD'
type MonthKey = string;       // '2026-03'

interface Truck {                       // master list (shared across months)
  id: string;
  name: string;                         // "WINGVAN (DA)", "TRAILER"
  plateNumber: string;                  // "NKA-5626"
  defaultRate: number;                  // per trip
  active: boolean;
  sortOrder: number;
}

interface UsageEntry {                  // the "start/end" record driving the highlights
  id: string;
  truckRowId: string;
  startDate: ISODate;
  endDate: ISODate;                     // >= startDate (zod refine)
  locationOverride?: string;            // blank → inherit sheet.destination
  trips: number | null;                 // null = derive from marked days; number = manual
  note?: string;
}

interface SheetRow {                    // a truck as it appears on ONE month's sheet
  id: string;
  truckId: string | null;               // null = ad-hoc row, deleted master truck
  truckName: string;                    // snapshot
  plateNumber: string;                  // snapshot
  rate: number;                         // snapshot, editable for this month
  tripsOverride: number | null;         // e.g. trips done ahead of schedule
  note?: string;                        // optional per-row remark (tooltip / margin)
}

interface BillingSheet {
  id: string;
  month: MonthKey;
  controlNumber: string;                // "L 000061", auto-increment suggestion
  periodLabel?: string;                 // optional "March 01-18 2026" override
  destination: string;                  // sheet-wide: all trucks share it, printed in header
  remarks?: string;                     // extra sheet-level remark line
  rows: SheetRow[];
  usage: UsageEntry[];
  // typed per sheet, prefilled from settings for convenience
  preparedBy: { name: string; position: string; date?: ISODate };
  approvedBy: { name: string; position: string };
  status: 'draft' | 'final';            // final = locked, warns on edit
  pdfPath?: string;
  createdAt: string; updatedAt: string;
}

interface Settings {
  orgName: string; orgAddress: string;
  defaultRate: number;
  nextControlNumber: number;
  printerName?: string;                 // preselected in the native print dialog
  showSlashGlyph: boolean;              // B/W-printer friendly day mark
  sheetRowsPerPage: number;             // default 16, then continue on page 2
  defaultPreparedBy: { name: string; position: string };  // prefill for each sheet
  defaultApprovedBy: { name: string; position: string };
}
```

Store on disk:

```
%APPDATA%/pitac-trucking/
  data.json            { schemaVersion, trucks, sheets, settings }
  backups/data-2026-11-10T09-14-00.json   (keep last 30 + one per day)
  trash/<sheetId>.json
  pdf/                 default folder offered by the Save PDF dialog
```

Atomic write = write `data.json.tmp` → `fsync` → rename. On startup, if the main file fails to parse,
fall back to newest backup and warn the user. Add `data:export` / `data:import` for USB-stick backups.

---

## 5. Screens & UX

### 5.1 Billing editor (`/`)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [Mar 2026 ▾] Destination [Buchanan / MIS OR Relocation]  Control [L000061] │
│                                    [Draft ▾]        [Print]  [Save PDF]    │
├──────────────────────────────────────────┬─────────────────────────────────┤
│ Sheet table (live preview of print)      │ Usage for: WINGVAN (DA)         │
│  #  TRUCK        PLATE  1 2 3 ... 31   ∑ │ ┌─────────────────────────────┐ │
│  1  TRAILER      CCE6441 ··███··········  │ │ Start [03/04] End [03/06]   │ │
│  2  WINGVAN(DA)  NKA5626 ··████···██···   │ │ Dest. Buchanan (sheet)      │ │
│ ...                                      │ │ Trips  (•) auto  ( ) manual │ │
│                                          │ │              [+ Add entry]  │ │
│ TOTAL TRIPS 38                  ₱241,000 │ ├─────────────────────────────┤ │
│                                          │ │ 03/04–03/06          3 trips│ │
│                                          │ │ 03/15–03/19          6 trips│ │
│                                          │ └─────────────────────────────┘ │
└──────────────────────────────────────────┴─────────────────────────────────┘
```

- Month picker decides the **number of day columns** — only the days that actually exist in the selected
  month (`28/29/30/31`), matching the printed form. Column headers are day-of-month numbers, as on paper.
  Weekend columns get a subtle tint (optional setting, off by default because the paper form has none).
- **Destination:** a single sheet-level text field in the header, printed on the form's `Date:` line
  exactly like "Buchanan / MIS OR Relocation". Everything inherits it, so there is no per-truck typing
  in the normal case. A small "override destination" link on an entry (or a row's ⋮ menu) covers the
  rare exception; overridden rows get a subtle marker in the editor and tooltip.
- **Entering usage:** select a truck row → start date, end date → *Add*. The day cells inside the range
  highlight immediately and the tooltip shows the sheet destination. Add a second range in one go for
  split trips; ranges are clamped to the month with a "continues from Feb" / "continues into Apr" marker.
- **Direct grid editing:** click a day cell to toggle a single-day entry, drag across cells to create a
  range entry, keyboard arrows + `Space` for the same. Entries inherit the sheet destination.
- **Trips:** defaults to the count of marked days; a pencil icon on the `# OF TRIPS` cell switches to a
  manual override (badge shows "manual"). Because trips are sometimes done ahead of schedule, an
  override is allowed even with **zero marked days**; show an amber (not blocking) warning when amount
  is non-zero but no days are marked, so the discrepancy is visible to whoever prepares the bill.
- **Amount** = `rate × trips`, right-aligned, formatted `₱24,000`. `RATE` cell is inline-editable per row
  and defaults from `Truck.defaultRate`.
- **Overlapping entries** are allowed but warned (amber underline) — sometimes a truck returns to a
  second location in the same span; the tooltip lists all entries for the day.
- **Truck rows:** add from master list (searchable dropdown), or "add ad-hoc row". Drag to reorder.
  Deleting a master truck does **not** alter existing sheets (rows carry snapshots).
- Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`) covers sheet edits only.
- Finalising sets `status: 'final'` → fields lock (reopen requires a confirmation), and continuation
  months created from it copy the destination, signatories and truck rows.

### 5.2 Trucks (`/trucks`)
Master CRUD: name, plate, default rate, active flag, order. Shows "used in N months" and a warning if a
truck has usage in a finalised sheet. Import/export CSV (`name,plate,rate`) for bulk setup from the office list.

### 5.3 History (`/history`)
Grouped by year/month: control no., total amount, status, quick open/duplicate/print/PDF. Duplicate a
previous month → copies truck rows + rates, clears usage, increments control number.

### 5.4 Print view (`/print/:id`)
The same table rendered at true A4-landscape dimensions, no app chrome. Loaded with `?print=1` after the
renderer signals `sheet-ready`.

---

## 6. Print / A4 landscape specification

**Page:** A4 landscape = `297mm × 210mm`. With 10mm margins the usable box is `277 × 190mm`.
At 16 rows you have ~9mm per row; sample has 16 rows + header + totals + signatures, so the design must be
density-first.

```css
@page { size: A4 landscape; margin: 10mm; }
@media print {
  html, body { width: 297mm; height: 210mm; }
  body { font-family: "Arial Narrow", "Roboto Condensed", Arial, sans-serif; font-size: 7.5pt;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 0 1mm; height: 5.6mm; overflow: hidden; }
  .col-day  { width: var(--day-w, 5.2mm); text-align: center; }  /* computed per sheet */
  .col-truck { width: 58mm; } .col-plate { width: 26mm; }
  .col-trips { width: 11mm; } .col-rate { width: 16mm; } .col-amount { width: 20mm; }
  tr, .sig-block { break-inside: avoid; }
  .day-used { background: #d8d8d8; }             /* reads on B/W laser */
  .day-used::after { content: "/"; }             /* optional glyph mode */
  .page-break { break-before: page; }
  thead { display: table-header-group; }          /* repeat header on page 2+ */
}
```

Layout decisions:

- **Columns:** only the **actual days of the selected month** (28/29/30/31), never padded to 31. Day
  width is computed at render time as `(277mm − fixed columns) / dayCount` and written to a CSS custom
  property (`--day-w`) so the preview and `printToPDF` agree exactly. Fixed mm for the truck/plate/trips/
  rate/amount columns means totals never drift between preview and paper.
- **Day mark:** light gray fill + optional slash glyph. Gray alone can vanish on a faint laser; the glyph
  guarantees legibility. Both are settings, not code changes.
- **Header block:** org name / address / title are three stacked centered rows exactly like the form;
  control number sits in its own bordered box top-right. The `Date:` row holds the month, the optional
  range label and the sheet-wide destination, allowed to wrap to a second line if long.
- **Signatures:** absolutely positioned at the bottom of the sheet (not in the table flow) so the block
  stays at the page bottom regardless of row count: `Prepared By` left with name/position/date lines,
  `Approved by` right with name/`SPD Manager` lines and a signature rule above.
- **Totals:** `Total` row spans TRUCKS…`# OF TRIPS`, then sums trips, then total amount. A sanity line
  under the sheet (not printed) shows `marked days`, `trips`, `amount`.
- **Overflow:** if rows exceed the page (e.g. 20 trucks), switch to "continuation pages": header repeats,
  rows flow, totals + signatures only on the last page. `sheetRowsPerPage` in settings tunes the split.
- **Fit-to-page guard:** before printing, measure the print view's `scrollHeight` against
  `190mm` (in px at 96dpi ≈ 718px) and warn "content exceeds one page — reduce rows or font size"
  with a link to a compact/condensed mode (6.5pt, 5mm rows). This is the #1 thing that will bite you.
- **Printing / PDF:** the primary action is **Print** — `main` reveals the print route, waits for
  `did-finish-load` plus a `sheet-ready` IPC, then calls
  `webContents.print({ silent: false, printBackground: true, pageSize: 'A4', landscape: true,
  margins: { marginType: 'none' } })` (margins come from `@page`/padding), which opens the native print
  dialog with the printer preselected. **Save PDF** is a separate button that opens a save dialog and uses
  `webContents.printToPDF({ landscape: true, pageSize: 'A4', printBackground: true })`; the chosen path is
  stored on the sheet as `pdfPath`. No PDF is generated automatically on print.

---

## 7. Pure logic to unit-test (Vitest)

- `daysInMonth(monthKey)`, `monthDays(monthKey) → ISODate[]` (Feb leap handling).
- `expandEntry(entry) → ISODate[]`; `clampEntryToMonth(entry, monthKey)` — a range entered as
  `Feb 26 – Mar 04` must only highlight Mar 1–4 on the March sheet and *show a "continues from Feb" marker*.
- `buildDayMap(rows, usage) → Map<rowId, Map<ISODate, UsageEntry[]>>` (overlap tolerant).
- `deriveTrips(row, dayMap, entries)`: explicit manual override wins (including trips with zero marked
  days, the "ahead of schedule" case); otherwise count of marked days.
- `destinationFor(entry, sheet)` → `entry.locationOverride || sheet.destination`.
- `computeAmounts(sheet) → { perRow, totalTrips, totalAmount }` (round to 2dp, guard NaN, flag rows with
  amount > 0 and no marked days).
- Zod: `endDate >= startDate`, month format, plate normalisation (`NKA-5626`), rate ≥ 0.
- Control number allocation (never reuse, tolerates manual override).
- Migration from `schemaVersion: 1 → 2` when fields are added.

---

## 8. Phased delivery

| Phase | Scope | Done when |
|---|---|---|
| **0. Scaffold** (0.5–1d) | electron-vite + React + TS + Bootstrap, window, strict CSP, preload bridge, CI lint/test script | `npm run dev` opens the app; `window.api` typed; `npm run build` produces installer |
| **1. Trucks** (1d) | Master-list CRUD + CSV import, settings for org name/address/default rate | Can seed the 16 trucks from the paper list in under 5 minutes |
| **2. Sheet grid** (1.5–2d) | Month picker (actual day columns only), sheet destination field, row add/reorder from trucks, rate/trips columns, totals, click-to-toggle days, derived highlighting | Sheet totals match the sample for a hand-entered month |
| **3. Usage entries** (1.5d) | Start/end form, inherited destination + override, range highlight, tooltips, drag-select, keyboard, trips auto/manual, overlap warnings, undo/redo | Entering `03/04–03/06` highlights exactly those days and inherits the sheet destination |
| **4. Persistence** (1d) | JSON store, atomic writes, backups, autosave (debounced), export/import, trash, single-instance lock | Kill the app mid-edit and lose nothing; corrupt `data.json` recovers from backup |
| **5. Print/PDF** (2d) | `/print/:id` at true A4 landscape, computed day width, `@page` CSS, Print + Save PDF, fit-to-page guard, continuation pages | Printed page matches the paper form 1:1; PDF opens correctly in Acrobat/Chrome |
| **6. History & polish** (1–1.5d) | History list, duplicate month, lock finalised sheets, control-number sequence, validation messages, empty states | Duplicate February → March in 2 clicks; finalised sheet can't be silently edited |
| **7. Package & handover** (0.5–1d) | NSIS installer, icon, version, first-run wizard, short user guide | Installer runs on a clean Windows box with no Node installed |

Roughly **8–11 focused days** for one developer; phases 2–3 and 5 are the risky ones.

---

## 9. Confirmed decisions

| # | Decision |
|---|---|
| 1 | **Destination is sheet-wide** — all trucks share it for the month. One header field, inherited by every entry; optional per-entry override for rare exceptions. |
| 2 | **Trips are auto** (marked days) **with manual override**, including trips done ahead of schedule with no marked days. |
| 3 | **Rate is per truck, editable per month**, snapshotted onto the sheet. No extra allowance/overtime columns for v1. |
| 4 | **Print only the actual days** of the selected month (28/29/30/31) — no 31-column padding. |
| 5 | **Single machine**, JSON file store + backups. Add an Electron single-instance lock so two copies can't fight over `data.json`. |
| 6 | **Straight to printer** by default; **Save PDF** is a separate optional button. |
| 7 | **Signatories typed per sheet**, prefilled from settings defaults (`Prepared By` + position, `Approved by` + `SPD Manager`). |

### Still worth deciding before/while building

- **Control number sequence** — keep `L 000061` as a manually editable field with an auto-increment
  suggestion, or make it strictly sequential and read-only once finalised? (Plan assumes the former.)
- **Period label** — should the printed `Date:` line show the full month (`March 2026`) or a range like the
  sample (`March 01-18 2026`)? Plan keeps an optional free-text override, defaulting to `March 2026`.
- **Currency/locale** — `₱` and comma grouping (`241,000`) with no decimals, as on the sample?
- **Weekend tint** off by default; say if you want it on printed output.
- **Signature images** — typed names only for now, or do you want to store scanned signature images later?

Next step: scaffold Phase 0 (electron-vite + React + TS + Bootstrap) and wire the JSON store, then build
Phase 1 (trucks) and Phase 2 (sheet grid).
