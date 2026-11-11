/**
 * Blank space between the table and the signatures — for handwritten notes
 * on the printed sheet. On screen the same area is a notes field.
 */
export default function SheetNotes({ mode, notes, onChange }) {
  if (mode === 'print') {
    return <div className="doc-notes doc-notes-print">{notes || ''}</div>
  }

  return (
    <div className="doc-notes">
      <div className="doc-notes-label">Notes</div>
      <textarea
        className="doc-notes-input"
        value={notes ?? ''}
        rows={3}
        placeholder="Notes for this sheet"
        aria-label="Notes"
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  )
}
