import { rowTrips } from '../../store'
import { SheetControl, SheetHeadRows } from './SheetHead'
import SheetNotes from './SheetNotes'
import SheetSignatures from './SheetSignatures'
import SheetSummary from './SheetSummary'
import SheetTable from './SheetTable'

/** Column widths of the on-screen sheet (px). */
export const SCREEN_COLUMNS = {
  truck: 152,
  plate: 118,
  day: 26,
  trips: 86,
  rate: 88,
  amount: 102,
  action: 30,
}

/** Natural (unscaled) width of the on-screen sheet, including its padding. */
export function docNaturalWidth(dayCount) {
  const c = SCREEN_COLUMNS
  return (
    c.truck +
    c.plate +
    c.trips +
    c.rate +
    c.amount +
    c.action +
    c.day * dayCount +
    30
  )
}

/** Print widths (mm) — the table is 276mm wide on A4 landscape. */
const PRINT_COLUMNS = {
  truck: 50,
  plate: 22,
  days: 148,
  trips: 14,
  rate: 19,
  amount: 23,
}

export const PRINT_WIDTH_MM =
  PRINT_COLUMNS.truck +
  PRINT_COLUMNS.plate +
  PRINT_COLUMNS.days +
  PRINT_COLUMNS.trips +
  PRINT_COLUMNS.rate +
  PRINT_COLUMNS.amount

/**
 * The billing sheet — the same document that prints.
 *
 * mode="screen" → editable, payslip-styled inputs, clickable day cells.
 * mode="print"  → plain text, millimetre widths, black rules.
 */
export default function Sheet({
  mode = 'screen',
  month,
  sheet,
  rows,
  roster,
  days,
  onToggleDays,
  onPatchRow,
  onPatchTruck,
  onPatchSheet,
  onDeleteTruck,
  onAddTruck,
  onPeriodStart,
  onPeriodEnd,
}) {
  const isScreen = mode === 'screen'
  const columnCount = days.length + 5 + (isScreen ? 1 : 0)

  const dayWidth = isScreen
    ? `${SCREEN_COLUMNS.day}px`
    : `${(PRINT_COLUMNS.days / days.length).toFixed(3)}mm`

  const totalTrips = rows.reduce((sum, item) => sum + rowTrips(item.row), 0)
  const totalAmount = rows.reduce(
    (sum, item) =>
      sum + (Number(item.row.rate) || 0) * rowTrips(item.row),
    0,
  )

  return (
    <div className={isScreen ? 'doc-sheet doc-screen' : 'doc-sheet doc-print'}>
      <SheetControl
        mode={mode}
        sheet={sheet}
        onPatchSheet={onPatchSheet}
      />

      <table className="doc-table">
        <colgroup>
          {isScreen ? (
            <>
              <col style={{ width: SCREEN_COLUMNS.truck }} />
              <col style={{ width: SCREEN_COLUMNS.plate }} />
            </>
          ) : (
            <>
              <col style={{ width: `${PRINT_COLUMNS.truck}mm` }} />
              <col style={{ width: `${PRINT_COLUMNS.plate}mm` }} />
            </>
          )}
          {days.map((day) => (
            <col key={day} style={{ width: dayWidth }} />
          ))}
          {isScreen ? (
            <>
              <col style={{ width: SCREEN_COLUMNS.trips }} />
              <col style={{ width: SCREEN_COLUMNS.rate }} />
              <col style={{ width: SCREEN_COLUMNS.amount }} />
              <col style={{ width: SCREEN_COLUMNS.action }} />
            </>
          ) : (
            <>
              <col style={{ width: `${PRINT_COLUMNS.trips}mm` }} />
              <col style={{ width: `${PRINT_COLUMNS.rate}mm` }} />
              <col style={{ width: `${PRINT_COLUMNS.amount}mm` }} />
            </>
          )}
        </colgroup>

        <tbody>
          <SheetHeadRows
            mode={mode}
            month={month}
            sheet={sheet}
            days={days}
            columnCount={columnCount}
            onPatchSheet={onPatchSheet}
            onPeriodStart={onPeriodStart}
            onPeriodEnd={onPeriodEnd}
          />
          <SheetTable
            mode={mode}
            rows={rows}
            roster={roster}
            days={days}
            columnCount={columnCount}
            onToggleDays={onToggleDays}
            onPatchRow={onPatchRow}
            onPatchTruck={onPatchTruck}
            onDeleteTruck={onDeleteTruck}
            onAddTruck={onAddTruck}
          />
        </tbody>
      </table>

      <div className="doc-bottom">
        <SheetSummary
          mode={mode}
          truckCount={rows.length}
          trips={totalTrips}
          amount={totalAmount}
        />
        <SheetNotes
          mode={mode}
          notes={sheet.notes}
          onChange={(value) => onPatchSheet({ notes: value })}
        />
        <SheetSignatures
          mode={mode}
          sheet={sheet}
          onPatchSheet={onPatchSheet}
        />
      </div>
    </div>
  )
}
