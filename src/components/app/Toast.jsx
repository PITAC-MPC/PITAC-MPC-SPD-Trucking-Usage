/** Small confirmation / status message in the corner. */
export default function Toast({ toast, onDismiss }) {
  if (!toast) return null

  return (
    <div className="toast-container position-fixed bottom-0 end-0 p-3">
      <div
        className={`toast show app-toast app-toast-${toast.tone}`}
        role="status"
        aria-live="polite"
      >
        <div className="d-flex align-items-start">
          <div className="toast-body">{toast.message}</div>
          <button
            type="button"
            className="btn-close me-2 mt-2"
            aria-label="Dismiss"
            onClick={onDismiss}
          />
        </div>
      </div>
    </div>
  )
}
