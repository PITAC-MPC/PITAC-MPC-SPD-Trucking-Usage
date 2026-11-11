# PITAC-MPC Trucking Billing

Desktop app for the cooperative's monthly **Trucking Services Billing** sheet.
Electron + React + Bootstrap, printing on **A4 landscape**.

The screen shows the actual paper — the same table, header, notes area and
signature blocks that come out of the printer — and every field on it is
editable. The chrome around it (bar, buttons, inputs, panels, toasts) follows
the visual system of the
[SPD Logistics Payslip Generator](https://github.com/PITAC-MPC/SPD-Logistics-Payslip-Generator).

## Run it

```bash
npm install
npm run dev      # development: Vite + Electron with hot reload
```

Production run (builds the renderer first):

```bash
npm start
```

## How to use it

Everything is on one screen.

1. **The sheet** is the working surface:
   - the **Date:** line holds the billing period — its start and end dates are
     the days the trucks were used, and the start date also decides which
     month the sheet shows (typing a start date in another month opens that
     month);
   - every day inside the period is marked on every truck row — click a day to
     switch it off or on again;
   - edit the **truck name**, **plate #**, **trips** and **rate** right on the
     sheet; a truck is added by typing its name and plate in the last row;
   - edit the **control number** (top right), the **destination** on the
     `Date:` line and the **signatories** at the bottom;
   - trips count themselves from the marked days — type a number to override
     (for trips done ahead of schedule) and press **auto** to go back;
   - the **notes** area between the table and the signatures is printed as
     blank space for handwriting (typed notes are printed too).
2. **Paper preview** (top bar) expands the printed A4 landscape sheet inline on
   the same page — exactly what the printer will produce.
3. **Print** sends the sheet to the printer; **Save as PDF** writes a PDF file
   instead. Paper size is fixed to A4 landscape and the output stays on one page.

Everything is saved automatically on this computer. Each month keeps its own
copy of the truck rows (name, plate, rate, optional manual trips) and its own
period, destination, notes and signatories.

## Notes / current limits

- Single machine, one window at a time (single-instance lock).
- Data lives in the Electron profile (`localStorage`); no export/backup yet.
- The layout is tuned for the sample's 16 truck rows. More rows may spill to a
  second page.
- Used days print as a grey cell with a slash, so they survive a black-and-white
  printer.

## Project layout

```
electron/main.cjs              Electron window, print / save-as-PDF handlers
electron/preload.cjs           contextBridge for the print actions
scripts/dev.mjs                starts Vite, waits for it, then starts Electron
src/main.jsx                   React entry point
src/App.jsx                    screen composition (bar, sheet, preview)
src/store.js                   data model, month/day helpers, persistence
src/styles.css                 payslip-style screen styles + A4 landscape print styles
src/hooks/
  useBilling.js                all billing state and actions
  useFitScale.js               scales the sheet so it fits the screen
src/components/
  app/AppBar.jsx               brand and print actions
  app/Toast.jsx                status messages
  ui/SectionHeading.jsx        eyebrow + title + action
  preview/PaperPreview.jsx     inline A4 landscape preview
  sheet/Sheet.jsx              the sheet (screen mode + print mode)
  sheet/SheetHead.jsx          control number, header rows, Date/Destination line
  sheet/SheetTable.jsx         truck rows, day columns, totals
  sheet/SheetNotes.jsx         notes area (blank on paper, editable on screen)
  sheet/SheetSignatures.jsx    Prepared by / Approved by blocks
  sheet/SheetSummary.jsx       totals panel / total note
  sheet/DocField.jsx           a field: input on screen, text when printing
```

## Data model

Each month is stored separately and holds its own copy of the truck rows
(name, plate, rate, optional manual trips) plus:

- `periodStart` / `periodEnd` — the billing period; the days inside it are the
  ones marked on every truck row;
- `exceptions` — days inside the period that were switched off;
- `notes`, `destination`, `controlNumber` and the two signatories.

Older files that stored the marked days on each truck row are migrated on load:
they become the period, with the days that were not used kept as exceptions.
