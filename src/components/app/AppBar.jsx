function TruckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 5.5h11v10h-11z" />
      <path d="M12.5 9h4.2l3.3 3.3v3.2h-7.5z" />
      <circle cx="6.5" cy="17.5" r="2" />
      <circle cx="17" cy="17.5" r="2" />
    </svg>
  )
}

/** The sticky top bar: brand on the left, actions on the right. */
export default function AppBar({
  showPreview,
  onTogglePreview,
  onSavePdf,
  onPrint,
}) {
  return (
    <header className="app-bar no-print">
      <div className="app-bar-inner">
        <div className="app-brand">
          <span className="app-brand-icon">
            <TruckIcon />
          </span>
          <span className="app-brand-copy">
            <span className="app-brand-title">PITAC MPC</span>
            <span className="app-brand-subtitle">Trucking services billing</span>
          </span>
        </div>

        <div className="app-actions">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onTogglePreview}
          >
            {showPreview ? 'Hide paper preview' : 'Paper preview'}
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={onSavePdf}
          >
            Save as PDF
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onPrint}
          >
            Print
          </button>
        </div>
      </div>
    </header>
  )
}
