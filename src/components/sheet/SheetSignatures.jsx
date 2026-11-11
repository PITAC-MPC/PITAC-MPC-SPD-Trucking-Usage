import DocField from './DocField'

const SIGNOURIES = [
  {
    key: 'prepared',
    label: 'Prepared By:',
    nameKey: 'preparedBy',
    positionKey: 'preparedPosition',
    nameLabel: 'Prepared by name',
    positionLabel: 'Prepared by position',
  },
  {
    key: 'approved',
    label: 'Approved by',
    nameKey: 'approvedBy',
    positionKey: 'approvedPosition',
    nameLabel: 'Approved by name',
    positionLabel: 'Approved by position',
  },
]

/** The two signature blocks printed under the table. */
export default function SheetSignatures({ mode, sheet, onPatchSheet }) {
  return (
    <div className="doc-signatures">
      {SIGNOURIES.map((item) => (
        <div className="doc-sig" key={item.key}>
          <div className="doc-sig-label">{item.label}</div>
          <div className="doc-sig-space" />
          <div className="doc-sig-name">
            <DocField
              mode={mode}
              className="doc-sig-name-input"
              value={sheet[item.nameKey]}
              placeholder="Full name"
              ariaLabel={item.nameLabel}
              onChange={(value) => onPatchSheet({ [item.nameKey]: value })}
            />
          </div>
          <div className="doc-sig-position">
            <DocField
              mode={mode}
              className="doc-sig-position-input"
              value={sheet[item.positionKey]}
              placeholder="Position"
              ariaLabel={item.positionLabel}
              onChange={(value) => onPatchSheet({ [item.positionKey]: value })}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
