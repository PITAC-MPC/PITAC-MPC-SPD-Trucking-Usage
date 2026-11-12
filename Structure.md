# Structure.md — how this app is put together

A plain-language guide to the project for someone new to the codebase.
Read this first, then open the files it points at.

---

## 1. What this app is

PITAC Trucking Billing is a **desktop app** for the cooperative's monthly
*Trucking Services Billing* sheet.

- It is a **Electron** app: Electron is a browser (Chromium) wrapped in a
  desktop window. The screen part of the app is a normal React web page.
- The sheet is printed on **A4 landscape** paper (297mm wide × 210mm tall).
- Everything you type is saved **on the computer**, in the browser's
  `localStorage` (see `src/store.js`). There is no server and no database.

The screen shows **the actual paper**: the same table, header, notes area and
signature blocks that come out of the printer — and every field on it is
editable. The chrome around it (top bar, buttons, toasts) is just decoration
for the app; none of it is printed.

---

## 2. Running it

```bash
npm install     # once
npm run dev     # development: Vite + Electron with hot reload
npm start       # production: builds the page, then opens Electron
npm run dist    # builds the Windows installer into release/
```

`npm run dev` is a small script (`scripts/dev.mjs`) that starts the Vite
dev server, waits for it, and only then starts Electron pointed at the dev
server. Doing it this way means Electron can never load a half-built page.

---

## 3. The big picture

```
        ┌──────────────────────── Electron (electron/main.cjs) ───────────────────────┐
        │  Creates the window, handles "Print" and "Save as PDF" (via IPC)               │
        └───────────────┬──────────────────────────────────────────┬─────────────────────┘
                        │ loads the page                          │ exposes 2 functions
                        ▼                                          ▼
   ┌────────────────────────────────────────────┐      ┌────────────────────────────┐
   │  The React app (src/)                      │      │  window.desktop.print()    │
   │                                            │      │  window.desktop.savePdf()  │
   │  App.jsx ── useBilling() ── Sheet.jsx      │      └────────────────────────────┘
   │      │            │             │          │
   │      │            │             └── SheetTable / SheetHead / SheetNotes /  │
   │      │            │                 SheetSignatures / SheetSummary            │
   │      │            │                                                      │
   │      │            └── store.js  (data + helpers + save/load)              │
   │      │                                                      │
   │      └── useFitScale() (makes the wide sheet fit the window)                │
   └────────────────────────────────────────────┘
```

**The one idea to understand:** the same React component (`Sheet`) is drawn
**twice**.

| Copy | Where it is | `mode` | What it is |
|------|-------------|--------|------------|
| Editing copy | the main screen | `"screen"` | real `<input>` elements you can click and type in |
| Paper copy | bottom of the DOM, hidden with CSS | `"print"` | plain text, millimetre widths, black rules |

Every sheet component receives `mode` and asks "am I on screen or on paper?".
On screen it renders inputs; on paper it renders text. That is why the
printed sheet always looks exactly like the one on the screen.

---

## 4. The files, one by one

### 4.1 Root files

| File | What it does |
|------|--------------|
| `package.json` | The project manifest: name, version, scripts (`dev`, `build`, `start`, `dist`) and the list of dependencies. The `build` section here is read by **electron-builder** and decides the installer's name, icon and shortcuts. |
| `index.html` | The one HTML page Electron loads. It contains an empty `<div id="root">` and a `<script>` that starts `src/main.jsx`. Nothing else lives here. |
| `vite.config.mjs` | Settings for **Vite** (the build tool). `base: './'` makes the built files work from a `file://` URL, which is how Electron loads them. |
| `README.md` | The user-facing manual: how to install, how to use the app, what is saved. |
| `PLAN.md` | The original design document for the app (written before the code). Useful background; the code has moved on since. |

### 4.2 `electron/` — the desktop shell

| File | What it does |
|------|--------------|
| `electron/main.cjs` | The Electron "main process". It creates the window (1600×960, minimised sizes, `contextIsolation: true`, `sandbox: true` so the page cannot touch the system), opens external links in the real browser, and handles the two printing actions. It also grabs a **single-instance lock**: running the app twice would mean two copies fighting over the same saved data. |
| `electron/preload.cjs` | The tiny bridge between the page and Electron. `contextBridge` exposes exactly two functions on `window.desktop`: `print()` and `savePdf(name)`. The React app checks `window.desktop?.print` and falls back to `window.print()` when it runs in a plain browser. |

**Printing, in detail**

- `sheet:print` → `webContents.print({ pageSize: 'A4', landscape: true })` — opens the
  system print dialog with A4 landscape already chosen.
- `sheet:save-pdf` → asks the user where to save the file, then
  `webContents.printToPDF({ preferCSSPageSize: true })` and writes the bytes to disk.
  `preferCSSPageSize` means the PDF obeys the `@page` rule in `styles.css`
  (A4 landscape, 8mm margins).

### 4.3 `scripts/`

| File | What it does |
|------|--------------|
| `scripts/dev.mjs` | The `npm run dev` runner. Starts Vite in-process, reads back the port it actually bound to, then starts Electron with `VITE_DEV_SERVER_URL` pointing at it. When Electron closes, it kills the Vite server too. |

### 4.4 `src/` — the React app

| File | What it does |
|------|--------------|
| `src/main.jsx` | The entry point. Mounts `<App />` into `#root` and imports the two stylesheets: Bootstrap (buttons, layout helpers) and `styles.css` (everything that is actually ours). |
| `src/App.jsx` | The screen composition: it puts together the app bar, the editable sheet, the optional paper preview, the "saved automatically" note and the toast. It also renders the **hidden print copy** of the sheet (`.print-root`), which is the only thing that is printed. |
| `src/store.js` | The data model and all the "pure" helpers — see below. No React inside; you can call these from anywhere (or from a test). |
| `src/styles.css` | All the styling: the screen design (white card, maroon accent, soft inputs) and the print design (millimetre sizes, A4 landscape, black rules). See section 6. |

#### `src/store.js` — the data

Think of this as the app's "model layer". It holds:

- **Date helpers** — `currentMonth()`, `daysInMonth()`, `monthDays()`, `formatMonth()`,
  `formatPeriod()`, `addDays()`, `countDays()`. A *month key* is a string like
  `"2026-11"`.
- **The truck roster** — `monthTrucks()`, `patchMonthRow()`, `rowDays()`,
  `rowTrips()`, `setRowDays()`, `isRowDayUsed()`.
- **The billing period** — `periodBounds()` decides the start and end date shown on the
  `Date:` line; `formatPeriod()` turns it into words like `"NOVEMBER 2026"`.
- **Saving and loading** — `loadData()` and `saveData()` read/write `localStorage` under
  the key `pitac-trucking-v1`.

**Two rules worth knowing as a junior dev:**

1. **The truck list is global, the sheet data is not.** A truck's *name and plate*
   are saved once and show up in every month. Everything else (rate, trips, used
   days, destination, notes, signatories) belongs to the sheet you are filling in
   and is **not** written to disk. `loadData()` even throws away saved months on
   purpose.
2. **The month follows the period start date.** There is no month picker. Choosing a
   start date in another month opens that month's sheet (`handlePeriodStart` in
   `useBilling.js`).

#### `src/hooks/` — stateful helpers

A *hook* is a function that starts with `use` and may hold React state.

| File | What it does |
|------|--------------|
| `src/hooks/useBilling.js` | The brain of the app. It holds **all** the state (the roster, the current sheet, the toast message) and returns every action the UI can trigger: `addTruck`, `handleDeleteTruck`, `handleToggleDays`, `patchRow`, `patchTruck`, `patchSheet`, `handlePeriodStart`, `handlePeriodEnd`, `handleCreateNew`, `handlePrint`, `handleSavePdf`. It also computes `totals` and auto-saves whenever the data changes. |
| `src/hooks/useFitScale.js` | The sheet is very wide (31 day columns). This hook measures its container and returns a zoom factor (between 0.45 and 1) so the whole sheet fits on screen. It re-measures with a `ResizeObserver` when the window changes size. |

#### `src/components/` — the pieces on screen

They are grouped in folders by role.

**`components/app/` — the app's own furniture (never printed)**

| File | What it does |
|------|--------------|
| `AppBar.jsx` | The sticky top bar: the brand on the left, and the buttons *Create new*, *Paper preview*, *Save as PDF* and *Print* on the right. It only receives callbacks and labels — no logic. |
| `Toast.jsx` | The small message that slides in at the bottom-right corner ("Hino 500 added to this sheet."). It disappears by itself after a few seconds. |

**`components/ui/` — small reusable bits**

| File | What it does |
|------|--------------|
| `SectionHeading.jsx` | The small "eyebrow + title + optional button on the right" heading used above each section. |

**`components/preview/`**

| File | What it does |
|------|--------------|
| `PaperPreview.jsx` | Shows the printed A4 landscape sheet inline on the same page, so you can check the paper without printing. It renders `Sheet` with `mode="print"` and scales it down with the `useFitScale` zoom. |

**`components/sheet/` — the sheet itself**

| File | What it does |
|------|--------------|
| `Sheet.jsx` | The sheet. It decides the column widths (pixels on screen, millimetres on paper), draws the `<table>`, and puts the three blocks underneath it together: the total, the notes and the signatures. It also exports `PRINT_WIDTH_MM` (276mm) and `docNaturalWidth()`, used by the zoom hook. |
| `SheetHead.jsx` | Two exports: `SheetControl` (the control number at the top right) and `SheetHeadRows` (the cooperative's name, the address, the title, and the `Date:` / `Destination:` line). |
| `SheetTable.jsx` | The table body: the header row (`TRUCKS`, `PLATE #`, one column per day, `# OF TRIPS`, `RATE`, `AMOUNT`), one row per truck, the "add a truck" row at the bottom and the totals row. It holds the drag-to-mark-a-run-of-days behaviour (mouse down on a day cell, drag across the others) and the name/plate auto-fill from the roster. |
| `SheetNotes.jsx` | The notes area: a textarea on screen, blank space on paper. |
| `SheetSignatures.jsx` | The two signature blocks (*Prepared By* / *Approved by*), each with a name and a position. |
| `SheetSummary.jsx` | The totals: a small panel on screen, a single "Total ₱…" line on paper. |
| `DocField.jsx` | A tiny helper used by the sheet: **an input on screen, plain text when printing**. Most fields go through this so they look and behave the same in both copies. |

---

## 5. How data flows

```
user types / clicks
        │
        ▼
AppBar / SheetTable / SheetHead   (components — they only call callbacks)
        │
        ▼
useBilling  (hook — holds state, decides what the action means)
        │
        ▼
store.js  (pure functions — add a day, count trips, work out the period)
        │
        ▼
setData  →  React re-renders  →  useEffect calls saveData  →  localStorage
```

**Rules of thumb when you change something**

- Components should stay "dumb": they show data and call the callbacks they
  were given. Logic belongs in `useBilling.js` or `store.js`.
- Anything that changes the saved data must go through `useBilling`, otherwise
  it will not be saved and will disappear when the app closes.
- If you add a field to a sheet, add it to `emptyMonth()` in `store.js` too,
  so a brand-new sheet has it.

---

## 6. How the CSS is organised

`src/styles.css` is one file, but it is written in clearly marked sections
(in this order):

| Section | What it styles |
|---------|----------------|
| `:root` | The colour variables (`--payslip-accent` is the cooperative's maroon), radii and shadows. Change a value here and it changes everywhere. |
| App bar | The sticky top bar and the brand. |
| The card | The white rounded card the whole app sits in, plus the section headings. |
| The sheet (screen) | The editable sheet: table borders, input styling, the red highlight on a used day, the totals panel. |
| Notes / Summary / Preview / Toast | The smaller screen pieces. |
| **Printed sheet (A4 landscape)** | Everything under `.doc-print`. It uses **millimetres**, not pixels, and plain black rules. |
| `@page` + `@media print` | The paper itself: A4 landscape with 8mm margins, the app chrome hidden, and the `.print-root` (the hidden print copy) made visible. |
| Responsive | Small-screen tweaks. |

### How the print layout works

- The sheet is **276mm wide**; the A4 landscape content area is 281mm, so it
  fits with a little to spare.
- `.doc-print` is `position: relative` and at least **192mm tall** (A4 landscape
  is 210mm tall, minus the 8mm margins at the top and bottom, minus 2mm of
  slack so the browser never spills an empty second page).
- The **signature blocks are pinned to the bottom of the sheet**
  (`position: absolute; bottom: 0`), and `padding-bottom` keeps their space
  free. Everything between the table and the signatures is therefore blank
  space — room for handwriting.
- The **screen** copy (`.doc-screen`) has none of this: it is a normal
  scrolling form, and the signatures sit right under the notes.

Because the preview uses the same `mode="print"` markup and the same CSS,
**what you see in the paper preview is what the printer produces.**

---

## 7. Where to change what

| I want to change… | Go to |
|-------------------|-------|
| The colours, spacing or the look of the app | `src/styles.css` (top half) |
| The layout of the printed sheet | `src/styles.css`, the `Printed sheet` section |
| A field on the sheet (add/remove/rename) | `src/components/sheet/Sheet*.jsx` + `emptyMonth()` in `src/store.js` |
| How trips are counted or how the period is worked out | `src/store.js` |
| A new button in the top bar | `src/components/app/AppBar.jsx` + `useBilling.js` |
| A new action (e.g. "Save as CSV") | add it to `useBilling.js`, then call it from a component |
| The window size, the print dialog or the PDF file | `electron/main.cjs` |

---

## 8. A few words you will see

| Word | Meaning here |
|------|--------------|
| **Component** | A `.jsx` file that returns some UI. Bigger ones are split into smaller ones (`Sheet` → `SheetTable`, `SheetHead`, …). |
| **Hook** | A function named `use…` that can hold React state (e.g. `useBilling`). |
| **Props** | The values a component receives from its parent, written as `function Thing({ a, b })`. |
| **IPC** | "Inter-process communication": the way the page asks Electron to print. |
| **`localStorage`** | A small key/value store inside the browser. Here it holds the truck roster. |
| **`mode="screen"` / `mode="print"`** | The switch that makes every sheet component draw either an editable field or plain text. |
| **`@page`** | CSS that describes the paper: size and margins for printing. |
| **`mm`** | Millimetres. The print styles use them so the output is a real size on real paper. |

---

## 9. Things that are easy to get wrong

- **The hidden print copy is always in the DOM.** `.print-root` is
  `display: none` on screen and `display: block` when printing. Do not delete
  it from `App.jsx` — that is what gets printed.
- **Only the roster is saved.** If you add a field to a sheet, remember it is a
  working copy unless you also add it to `saveData()` in `src/store.js`.
- **The month is not chosen directly.** It follows the period start date
  (`handlePeriodStart`), which is why changing the start date can jump you to
  a different sheet.
- **Millimetres on paper, pixels on screen.** Do not mix them in one rule.
