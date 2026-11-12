# PITAC-MPC Trucking Billing

Desktop app for the cooperative's monthly **Trucking Services Billing** sheet.
Electron + React + Bootstrap, printing on **A4 landscape**.

The screen shows the actual paper — the same table, header, notes area and
signature blocks that come out of the printer — and every field on it is
editable. The chrome around it (bar, buttons, inputs, panels, toasts) follows
the visual system of the
[SPD Logistics Payslip Generator](https://github.com/PITAC-MPC/SPD-Logistics-Payslip-Generator).

## Download

[![Download PITAC Trucking Billing v0.1.4](https://img.shields.io/badge/%E2%AC%93%20Download-PITAC%20Trucking%20Billing%20v0.1.4-8d100e?style=for-the-badge&logo=github)](https://github.com/PITAC-MPC/PITAC-MPC-SPD-Trucking-Usage/releases/latest)

1. Click the button above and download the **Setup** file.
2. Open it and follow the installer (Next → Next → Install).
3. Launch **PITAC Trucking Billing** from the desktop or the Start menu.

The app works offline; everything is saved on the computer it is installed on.

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
   - the **Date:** line holds the billing period — the start and end dates are
     ordinary calendar fields, and the start date also decides which month the
     sheet shows (pick a date in another month to open that month);
   - the **trucks** are picked in the last row of the table: the name and
     plate fields drop down **every truck that was written down before**, so a
     known truck is picked instead of typed again (the plate number fills
     itself in);
   - every truck keeps **its own used days**: click a day cell to mark it, or
     click and drag across the days to mark a whole run — only that truck row
     changes, so two trucks can have been out on different dates;
   - edit the **truck name**, **plate #**, **trips** and **rate** right on the
     sheet; the `×` takes a truck off the sheet;
   - edit the **control number** (top right), the **destination** on the
     `Date:` line and the **signatories** at the bottom;
   - trips count themselves from that truck's marked days — type a number to
     override (for trips done ahead of schedule) and press **auto** to go back;
   - the **notes** area between the table and the signatures is printed as
     blank space for handwriting (typed notes are printed too).
2. **Create new** (top bar) clears everything written on the sheet and gives a
   blank one — the trucks you have written down stay in the drop-downs.
3. **Paper preview** (top bar) expands the printed A4 landscape sheet inline on
   the same page — exactly what the printer will produce.
4. **Print** sends the sheet to the printer; **Save as PDF** writes a PDF file
   instead. Paper size is fixed to A4 landscape and the output stays on one page.

Only the **truck names and plate numbers** are kept between sessions. The
dates, the rates, the trips and everything else written on the sheet belong to
that sheet only — start a new one with **Create new**.

## Notes / current limits

- Single machine, one window at a time (single-instance lock).
- Data lives in the Electron profile (`localStorage`); no export/backup yet.
- The layout is tuned for the sample's 16 truck rows. More rows may spill to a
  second page.
- Used days print as a **red highlight** (a slash in the editing view), so the
  marked days stand out on the paper and still read on a black-and-white
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

## Build the installer

```bash
npm run dist       # builds the app and the Windows installer in release/
```

The installer is written to `release/PITAC Trucking Billing Setup 0.1.4.exe`.

## Data model

Only one thing is written to disk:

- `trucks` — the roster of every truck that was written down: `{ id, name, plate }`.

Everything else on the sheet — the billing period, the destination, the notes,
the signatories and each truck's rate, trips and used days — is a working copy
for the sheet you are filling in. It is not saved; **Create new** clears it and
starts a fresh sheet with the roster still available in the drop-downs.

Older files that kept a copy of the truck list inside every month are migrated
on load: the copies are folded into the one roster and the sheet starts empty.
