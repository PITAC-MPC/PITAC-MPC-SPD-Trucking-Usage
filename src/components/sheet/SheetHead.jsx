import { formatPeriod, periodBounds } from '../../store'

const ORG_NAME = 'Pitac Multipurpose Cooperative'
const ORG_ADDRESS = 'San Victores St., Barangay 9, Malaybalay City'
const DOC_TITLE = 'TRUCKING SERVICES BILLING'

/** The control number, written above the table on the right. */
export function SheetControl({ mode, sheet, onPatchSheet }) {
  return (
    <div className="doc-control">
      {mode === 'print' ? (
        <span className="doc-control-value">{sheet.controlNumber}</span>
      ) : (
        <input
          className="doc-input doc-control-input"
          value={sheet.controlNumber}
          placeholder="L 000061"
          aria-label="Control number"
          onChange={(event) =>
            onPatchSheet({ controlNumber: event.target.value })
          }
        />
      )}
    </div>
  )
}

/**
 * The cooperative header rows and the Date / Destination line.
 * The start and end dates are the billing period — they also decide which
 * month the sheet shows.
 */
export function SheetHeadRows({
  mode,
  month,
  sheet,
  days,
  columnCount,
  onPatchSheet,
  onPeriodStart,
  onPeriodEnd,
}) {
  const { start, end } = periodBounds(month, sheet)

  return (
    <>
      <tr>
        <td colSpan={columnCount} className="doc-org-cell">
          {ORG_NAME}
        </td>
      </tr>
      <tr>
        <td colSpan={columnCount} className="doc-address-cell">
          {ORG_ADDRESS}
        </td>
      </tr>
      <tr>
        <td colSpan={columnCount} className="doc-title-cell">
          {DOC_TITLE}
        </td>
      </tr>
      <tr>
        <td colSpan={columnCount} className="doc-meta-cell">
          <span className="doc-date">
            <span className="doc-date-label">Date:</span>
            {mode === 'print' ? (
              <span className="doc-date-value">{formatPeriod(month, sheet)}</span>
            ) : (
              <span className="doc-date-inputs">
                <input
                  type="date"
                  className="doc-input doc-date-input"
                  value={start}
                  aria-label="Billing period start"
                  onChange={(event) => onPeriodStart(event.target.value)}
                />
                <span className="doc-date-dash">–</span>
                <input
                  type="date"
                  className="doc-input doc-date-input"
                  value={end}
                  min={start}
                  max={days[days.length - 1]}
                  aria-label="Billing period end"
                  onChange={(event) => onPeriodEnd(event.target.value)}
                />
              </span>
            )}
          </span>

          <span className="doc-dest">
            <span className="doc-dest-label">Destination:</span>
            {mode === 'print' ? (
              <span className="doc-dest-value">{sheet.destination || ''}</span>
            ) : (
              <input
                className="doc-input doc-dest-input"
                value={sheet.destination}
                placeholder="e.g. Buchanan / MIS OR Relocation"
                aria-label="Destination"
                onChange={(event) =>
                  onPatchSheet({ destination: event.target.value })
                }
              />
            )}
          </span>
        </td>
      </tr>
    </>
  )
}
