import { useEffect, useState } from 'react'
import { formatMoney, isRowDayUsed, rowTrips } from '../../store'

const NAME_LIST_ID = 'truck-name-roster'
const PLATE_LIST_ID = 'truck-plate-roster'

/**
 * The sheet's table: one row per truck, one column per day of the month.
 * Every truck keeps its own used days for this month, so two trucks can
 * have been out on different dates.
 *
 * The name and plate fields suggest every truck that was written down
 * before, so a known truck can be picked instead of typed again.
 */
export default function SheetTable({
  mode,
  rows,
  roster,
  days,
  columnCount,
  onToggleDays,
  onPatchRow,
  onPatchTruck,
  onDeleteTruck,
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

  const totalTrips = rows.reduce((sum, item) => sum + rowTrips(item.row), 0)
  const totalAmount = rows.reduce(
    (sum, item) => sum + (Number(item.row.rate) || 0) * rowTrips(item.row),
    0,
  )

  const commitDraft = () => {
    const name = draft.name.trim()
    if (!name) return
    onAddTruck({ name, plate: draft.plate.trim(), rate: draft.rate })
    setDraft({ name: '', plate: '', rate: '' })
  }

  /** Picking a known truck fills its plate number too (and the other way). */
  const plateOf = (name) =>
    roster.find(
      (truck) => truck.name.toLowerCase() === name.trim().toLowerCase(),
    )?.plate ?? ''

  const nameOf = (plate) =>
    roster.find(
      (truck) =>
        plate.trim() &&
        truck.plate.toLowerCase() === plate.trim().toLowerCase(),
    )?.name ?? ''

  return (
    <>
      {isScreen && (
        <>
          <datalist id={NAME_LIST_ID}>
            {roster.map((truck) => (
              <option key={truck.id} value={truck.name} label={truck.plate} />
            ))}
          </datalist>
          <datalist id={PLATE_LIST_ID}>
            {roster.map((truck) => (
              <option key={truck.id} value={truck.plate} label={truck.name} />
            ))}
          </datalist>
        </>
      )}

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

      {rows.length === 0 && (
        <tr>
          <td colSpan={columnCount} className="doc-empty-cell">
            No trucks on this sheet yet — pick them from the list in the row
            below.
          </td>
        </tr>
      )}

      {rows.map(({ truck, row }, index) => {
        const trips = rowTrips(row)

        return (
          <tr key={truck.id}>
            <td className="doc-td-trucks">
              <span className="doc-index">{index + 1}</span>
              {isScreen ? (
                <input
                  className="doc-input doc-name-input"
                  list={NAME_LIST_ID}
                  value={truck.name}
                  aria-label={`Truck ${index + 1} name`}
                  onChange={(event) => {
                    const name = event.target.value
                    const plate = plateOf(name)
                    onPatchTruck(truck.id, {
                      name,
                      ...(plate ? { plate } : {}),
                    })
                  }}
                />
              ) : (
                <span className="doc-name">{truck.name}</span>
              )}
            </td>

            <td className="doc-td-plate">
              {isScreen ? (
                <input
                  className="doc-input doc-plate-input"
                  list={PLATE_LIST_ID}
                  value={truck.plate}
                  placeholder="—"
                  aria-label={`Truck ${index + 1} plate number`}
                  onChange={(event) => {
                    const plate = event.target.value
                    const name = nameOf(plate)
                    onPatchTruck(truck.id, {
                      plate,
                      ...(name ? { name } : {}),
                    })
                  }}
                />
              ) : (
                <span className="doc-plate">{truck.plate}</span>
              )}
            </td>

            {days.map((day) => {
              const used = isRowDayUsed(row, day)
              return (
                <td
                  key={day}
                  className={used ? 'doc-td-day is-used' : 'doc-td-day'}
                  title={`${truck.name || 'Truck'} — ${day}${used ? ' (used)' : ''}`}
                  onMouseDown={(event) => {
                    if (!isScreen) return
                    event.preventDefault()
                    const mode = used ? 'unmark' : 'mark'
                    setDrag({ truckId: truck.id, mode })
                    onToggleDays(truck.id, [day], mode)
                  }}
                  onMouseEnter={() => {
                    if (!drag || drag.truckId !== truck.id) return
                    onToggleDays(truck.id, [day], drag.mode)
                  }}
                />
              )
            })}

            <td className="doc-td-trips">
              {isScreen ? (
                <span className="doc-trips-wrap">
                  <input
                    className="doc-input doc-trips-input"
                    type="number"
                    min="0"
                    step="1"
                    value={trips}
                    aria-label={`Trips for ${truck.name}`}
                    onChange={(event) => {
                      const raw = event.target.value
                      onPatchRow(truck.id, {
                        tripsOverride:
                          raw === '' ? null : Math.max(0, Number(raw)),
                      })
                    }}
                  />
                  {row.tripsOverride !== null && (
                    <button
                      type="button"
                      className="doc-auto-link"
                      title="Back to the automatic count"
                      onClick={() =>
                        onPatchRow(truck.id, { tripsOverride: null })
                      }
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
                <input
                  className="doc-input doc-rate-input"
                  type="number"
                  min="0"
                  step="1"
                  value={row.rate}
                  aria-label={`Rate for ${truck.name}`}
                  onChange={(event) =>
                    onPatchRow(truck.id, {
                      rate: Math.max(0, Number(event.target.value) || 0),
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
                  title={`Take ${truck.name || 'this truck'} off the sheet`}
                  aria-label={`Take ${truck.name || 'this truck'} off the sheet`}
                  onClick={() => onDeleteTruck(truck.id)}
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
              list={NAME_LIST_ID}
              value={draft.name}
              placeholder="Add truck"
              aria-label="New truck name"
              onChange={(event) => {
                const name = event.target.value
                const plate = plateOf(name)
                setDraft((value) => ({
                  ...value,
                  name,
                  ...(plate ? { plate } : {}),
                }))
              }}
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
              list={PLATE_LIST_ID}
              value={draft.plate}
              placeholder="Plate #"
              aria-label="New truck plate number"
              onChange={(event) => {
                const plate = event.target.value
                const name = nameOf(plate)
                setDraft((value) => ({
                  ...value,
                  plate,
                  ...(name ? { name } : {}),
                }))
              }}
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
