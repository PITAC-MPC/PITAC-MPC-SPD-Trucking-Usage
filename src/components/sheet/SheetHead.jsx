import DocField from './DocField'
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
        <DocField
          mode={mode}
          className="doc-control-input"
          value={sheet.controlNumber}
          placeholder="L 000061"
          ariaLabel="Control number"
          onChange={(value) => onPatchSheet({ controlNumber: value })}
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
                <DocField
                  mode={mode}
                  type="date"
                  className="doc-date-input"
                  value={start ?? ''}
                  min={days[0]}
                  max={days[days.length - 1]}
                  ariaLabel="Billing period start"
                  onChange={onPeriodStart}
                />
                <span className="doc-date-dash">–</span>
                <DocField
                  mode={mode}
                  type="date"
                  className="doc-date-input"
                  value={end ?? ''}
                  min={days[0]}
                  max={days[days.length - 1]}
                  ariaLabel="Billing period end"
                  onChange={onPeriodEnd}
                />
              </span>
            )}
          </span>

          <span className="doc-dest">
            <span className="doc-dest-label">Destination:</span>
            {mode === 'print' ? (
              <span className="doc-dest-value">{sheet.destination || ''}</span>
            ) : (
              <DocField
                mode={mode}
                className="doc-dest-input"
                value={sheet.destination}
                placeholder="e.g. Buchanan / MIS OR Relocation"
                ariaLabel="Destination"
                onChange={(value) => onPatchSheet({ destination: value })}
              />
            )}
          </span>
        </td>
      </tr>
    </>
  )
}
