import { useEffect, useState } from 'react'
import { formatMoney, isRowDayUsed, rowDays, rowTrips } from '../../store'
import DocField from './DocField'

/**
 * The sheet's table: one row per truck, one column per day of the month.
 * Each truck keeps its own used days, so two trucks can have been out on
 * different dates.
 */
export default function SheetTable({
  mode,
  sheet,
  days,
  columnCount,
  onToggleDays,
  onPatchRow,
  onDeleteRow,
  onAddTruck,
}) {
  const isScreen = mode === 'screen'
  const [draft, setDraft] = useState({ name: '', plate: '', rate: '' })
  const [drag, setDrag] = useState(null)

  // A drag ends wherever the mouse is released.
  useEffect(() => {
    if (!drag) return undefined
    const stop = () => setDrag(null)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [drag])

  const totalTrips = sheet.rows.reduce((sum, row) => sum + rowTrips(row), 0)
  const totalAmount = sheet.rows.reduce(
    (sum, row) => sum + (Number(row.rate) || 0) * rowTrips(row),
    0,
  )

  const commitDraft = () => {
    const name = draft.name.trim()
    if (!name) return
    onAddTruck({ name, plate: draft.plate.trim(), rate: draft.rate })
    setDraft({ name: '', plate: '', rate: '' })
  }

  return (
    <>
      <tr className="doc-head-row">
        <th className="doc-th-trucks">TRUCKS</th>
        <th>PLATE #</th>
        {days.map((day) => (
          <th key={day} className="doc-th-day">
            {Number(day.slice(-2))}
          </th>
        ))}
        <th className="doc-th-trips">
          # OF
          <br />
          TRIPS
        </th>
        <th>RATE</th>
        <th>AMOUNT</th>
        {isScreen && <th className="doc-th-action" />}
      </tr>

      {sheet.rows.length === 0 && (
        <tr>
          <td colSpan={columnCount} className="doc-empty-cell">
            No trucks on this sheet yet — use “+ Add truck”.
          </td>
        </tr>
      )}

      {sheet.rows.map((row, index) => {
        const trips = rowTrips(row)

        return (
          <tr key={row.id}>
            <td className="doc-td-trucks">
              <span className="doc-index">{index + 1}</span>
              <DocField
                mode={mode}
                className="doc-name-input"
                value={row.name}
                ariaLabel={`Truck ${index + 1} name`}
                onChange={(value) => onPatchRow(row.id, { name: value })}
              />
            </td>

            <td className="doc-td-plate">
              <DocField
                mode={mode}
                className="doc-plate-input"
                value={row.plate}
                placeholder="—"
                ariaLabel={`Truck ${index + 1} plate number`}
                onChange={(value) => onPatchRow(row.id, { plate: value })}
              />
            </td>

            {days.map((day) => {
              const used = isRowDayUsed(row, day)
              return (
                <td
                  key={day}
                  className={used ? 'doc-td-day is-used' : 'doc-td-day'}
                  title={`${row.name || 'Truck'} — ${day}${used ? ' (used)' : ''}`}
                  onMouseDown={(event) => {
                    if (!isScreen) return
                    event.preventDefault()
                    const mode = used ? 'unmark' : 'mark'
                    setDrag({ rowId: row.id, mode })
                    onToggleDays(row.id, [day], mode)
                  }}
                  onMouseEnter={() => {
                    if (!drag || drag.rowId !== row.id) return
                    onToggleDays(row.id, [day], drag.mode)
                  }}
                />
              )
            })}

            <td className="doc-td-trips">
              {isScreen ? (
                <span className="doc-trips-wrap">
                  <DocField
                    mode={mode}
                    type="number"
                    className="doc-trips-input"
                    value={trips}
                    ariaLabel={`Trips for ${row.name}`}
                    onChange={(value) =>
                      onPatchRow(row.id, {
                        tripsOverride:
                          value === '' ? null : Math.max(0, Number(value)),
                      })
                    }
                  />
                  {row.tripsOverride !== null && (
                    <button
                      type="button"
                      className="doc-auto-link"
                      title="Back to the automatic count"
                      onClick={(event) => {
                        event.stopPropagation()
                        onPatchRow(row.id, { tripsOverride: null })
                      }}
                    >
                      auto
                    </button>
                  )}
                </span>
              ) : (
                trips
              )}
            </td>

            <td className="doc-td-rate">
              {isScreen ? (
                <DocField
                  mode={mode}
                  type="number"
                  className="doc-rate-input"
                  value={row.rate}
                  ariaLabel={`Rate for ${row.name}`}
                  onChange={(value) =>
                    onPatchRow(row.id, {
                      rate: Math.max(0, Number(value) || 0),
                    })
                  }
                />
              ) : (
                formatMoney(row.rate)
              )}
            </td>

            <td className="doc-td-amount">
              {formatMoney((Number(row.rate) || 0) * trips)}
            </td>

            {isScreen && (
              <td className="doc-td-action">
                <button
                  type="button"
                  className="doc-remove"
                  title={`Remove ${row.name || 'this truck'}`}
                  aria-label={`Remove ${row.name || 'this truck'}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteRow(row.id)
                  }}
                >
                  &times;
                </button>
              </td>
            )}
          </tr>
        )
      })}

      {isScreen && (
        <tr
          className="doc-draft-row"
          onBlur={(event) => {
            if (!event.relatedTarget) commitDraft()
          }}
        >
          <td className="doc-td-trucks">
            <span className="doc-index doc-index-add">+</span>
            <input
              className="doc-input doc-name-input"
              value={draft.name}
              placeholder="Add truck"
              aria-label="New truck name"
              onChange={(event) =>
                setDraft((value) => ({ ...value, name: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitDraft()
                }
              }}
            />
          </td>

          <td className="doc-td-plate">
            <input
              className="doc-input doc-plate-input"
              value={draft.plate}
              placeholder="Plate #"
              aria-label="New truck plate number"
              onChange={(event) =>
                setDraft((value) => ({ ...value, plate: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitDraft()
                }
              }}
            />
          </td>

          {days.map((day) => (
            <td key={day} className="doc-td-day doc-td-day-blank" />
          ))}

          <td className="doc-td-trips" />

          <td className="doc-td-rate">
            <input
              className="doc-input doc-rate-input"
              type="number"
              min="0"
              step="1"
              value={draft.rate}
              placeholder="Rate"
              aria-label="New truck rate"
              onChange={(event) =>
                setDraft((value) => ({ ...value, rate: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitDraft()
                }
              }}
            />
          </td>

          <td className="doc-td-amount" />

          <td className="doc-td-action" />
        </tr>
      )}

      <tr className="doc-total-row">
        <td colSpan={2} className="doc-total-label">
          Total
        </td>
        <td colSpan={days.length} />
        <td className="doc-td-trips">{totalTrips}</td>
        <td />
        <td className="doc-td-amount">{formatMoney(totalAmount)}</td>
        {isScreen && <td />}
      </tr>
    </>
  )
}
