import { formatMoney } from '../../store'

/** Totals: the payslip-style panel on screen, the note on the paper. */
export default function SheetSummary({ mode, truckCount, trips, amount }) {
  if (mode === 'print') {
    return (
      <div className="doc-total-note">
        Total <span>{formatMoney(amount)}</span>
      </div>
    )
  }

  return (
    <div className="summary-panel">
      <div className="summary-row">
        <span className="summary-label">Trucks</span>
        <span className="summary-value">{truckCount}</span>
      </div>
      <div className="summary-row">
        <span className="summary-label">Total trips</span>
        <span className="summary-value">{trips}</span>
      </div>
      <div className="summary-row summary-net-row">
        <span className="summary-label">Total amount</span>
        <span className="summary-value">{formatMoney(amount)}</span>
      </div>
    </div>
  )
}
