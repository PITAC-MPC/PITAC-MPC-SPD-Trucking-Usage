import { useEffect, useMemo, useState } from 'react'
import {
  currentMonth,
  emptyMonth,
  loadData,
  monthDays,
  monthTrucks,
  patchMonthRow,
  periodBounds,
  rowTrips,
  saveData,
  setRowDays,
  uid,
} from '../store'

/**
 * All the billing state in one place: the truck roster, the sheet being
 * filled in, the billing period and every action the UI can trigger.
 *
 * The month is not chosen separately — it follows the start date of the
 * period, so picking a date in another month switches sheets.
 *
 * Only the roster is kept between sessions; the sheet itself is a working
 * copy that is cleared with "Create new".
 */
export default function useBilling() {
  const [data, setData] = useState(loadData)
  const [showPreview, setShowPreview] = useState(false)
  const [toast, setToast] = useState(null)

  const month = data.lastMonth
  const days = useMemo(() => monthDays(month), [month])
  const sheet = data.months[month] ?? emptyMonth()
  const roster = data.trucks
  const rows = useMemo(() => monthTrucks(sheet, roster), [sheet, roster])

  const { start: periodStart, end: periodEnd } = periodBounds(month, sheet)

  const totals = useMemo(() => {
    const trips = rows.reduce((sum, item) => sum + rowTrips(item.row), 0)
    const amount = rows.reduce(
      (sum, item) => sum + (Number(item.row.rate) || 0) * rowTrips(item.row),
      0,
    )
    return { trips, amount }
  }, [rows])

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const notify = (message, tone = 'success') => setToast({ message, tone })

  const updateSheet = (updater) =>
    setData((previous) => {
      const key = previous.lastMonth
      const existing = previous.months[key] ?? emptyMonth()
      return {
        ...previous,
        months: { ...previous.months, [key]: updater(existing) },
      }
    })

  const patchSheet = (patch) =>
    updateSheet((existing) => ({ ...existing, ...patch }))

  /** Updates what this month keeps for one truck (rate, trips, days). */
  const patchRow = (truckId, patch) =>
    updateSheet((existing) => patchMonthRow(existing, truckId, patch))

  /** The truck list is global: names and plates are the same every month. */
  const patchTruck = (truckId, patch) =>
    setData((previous) => ({
      ...previous,
      trucks: previous.trucks.map((truck) =>
        truck.id === truckId ? { ...truck, ...patch } : truck,
      ),
    }))

  /** The start date also decides which month (and sheet) is being edited. */
  const handlePeriodStart = (value) => {
    if (!value) return
    const monthKey = value.slice(0, 7)

    if (monthKey !== data.lastMonth) {
      setData((previous) => {
        const list = monthDays(monthKey)
        const existing = previous.months[monthKey] ?? emptyMonth()
        const storedEnd =
          existing.periodEnd && list.includes(existing.periodEnd)
            ? existing.periodEnd
            : value
        return {
          ...previous,
          lastMonth: monthKey,
          months: {
            ...previous.months,
            [monthKey]: {
              ...existing,
              periodStart: value,
              periodEnd: storedEnd < value ? value : storedEnd,
            },
          },
        }
      })
      return
    }

    updateSheet((existing) => {
      const list = monthDays(month)
      const storedEnd =
        existing.periodEnd && list.includes(existing.periodEnd)
          ? existing.periodEnd
          : value
      return {
        ...existing,
        periodStart: value,
        periodEnd: storedEnd < value ? value : storedEnd,
      }
    })
  }

  /** The end date always stays inside the month of the start date. */
  const handlePeriodEnd = (value) => {
    if (!value) return
    updateSheet((existing) => {
      const list = monthDays(month)
      const last = list[list.length - 1]
      const end = value > last ? last : value
      const start =
        existing.periodStart && list.includes(existing.periodStart)
          ? existing.periodStart
          : list[0]
      return { ...existing, periodEnd: end < start ? start : end }
    })
  }

  /** Marks or unmarks days on one truck row. */
  const handleToggleDays = (truckId, dates, mode) =>
    updateSheet((existing) =>
      patchMonthRow(existing, truckId, (row) => setRowDays(row, dates, mode)),
    )

  /**
   * Adds a truck to the sheet. Known trucks (by name or plate) are reused
   * from the roster, new ones are added to it.
   */
  const addTruck = ({ name: rawName, plate: rawPlate, rate: rawRate }) => {
    const name = String(rawName ?? '').trim()
    if (!name) return
    const plate = String(rawPlate ?? '').trim()
    const rate = Math.max(0, Number(rawRate) || 0)

    const known =
      roster.find(
        (truck) =>
          truck.name.toLowerCase() === name.toLowerCase() ||
          (plate && truck.plate.toLowerCase() === plate.toLowerCase()),
      ) ?? null
    const truck = known ?? { id: uid(), name, plate }

    setData((previous) => {
      const key = previous.lastMonth
      const existing = previous.months[key] ?? emptyMonth()
      const already = (existing.rows ?? []).some(
        (row) => row.truckId === truck.id,
      )
      return {
        ...previous,
        trucks: known
          ? previous.trucks
          : [...previous.trucks, { ...truck, plate: plate || truck.plate }],
        months: {
          ...previous.months,
          [key]: already
            ? existing
            : {
                ...existing,
                rows: [
                  ...(existing.rows ?? []),
                  { truckId: truck.id, rate, tripsOverride: null, days: [] },
                ],
              },
        },
      }
    })
    notify(`${truck.name} added to this sheet.`)
  }

  /** Removes a truck from the sheet and from the roster. */
  const handleDeleteTruck = (truckId) => {
    const truck = roster.find((item) => item.id === truckId)
    const label = truck?.name || 'this truck'
    if (
      !window.confirm(
        `Remove ${label} from this sheet?\n\nIt is also taken off the list of known trucks.`,
      )
    ) {
      return
    }
    setData((previous) => ({
      ...previous,
      trucks: previous.trucks.filter((item) => item.id !== truckId),
      months: Object.fromEntries(
        Object.entries(previous.months).map(([key, month]) => [
          key,
          {
            ...month,
            rows: (month.rows ?? []).filter((row) => row.truckId !== truckId),
          },
        ]),
      ),
    }))
  }

  /** Clears everything written on the sheet; the roster is kept. */
  const handleCreateNew = () => {
    if (
      !window.confirm(
        'Create a new sheet?\n\nEverything written on this sheet is cleared — the trucks stay in the list.',
      )
    ) {
      return
    }
    updateSheet(() => emptyMonth())
    notify('New sheet ready.')
  }

  const handlePrint = async () => {
    if (!window.desktop?.print) {
      window.print()
      return
    }
    try {
      const result = await window.desktop.print()
      if (result?.ok) {
        notify('Sent to the printer.')
      } else if (result?.reason) {
        notify(`Could not print: ${result.reason}`, 'danger')
      }
    } catch (error) {
      notify(`Could not print: ${error.message}`, 'danger')
    }
  }

  const handleSavePdf = async () => {
    if (!window.desktop?.savePdf) {
      window.print()
      return
    }
    try {
      const result = await window.desktop.savePdf(
        `Trucking-Billing-${month}.pdf`,
      )
      if (result?.canceled) return
      if (result?.filePath) {
        notify(`Saved PDF: ${result.filePath}`)
      }
    } catch (error) {
      notify(`Could not save PDF: ${error.message}`, 'danger')
    }
  }

  return {
    // data
    month,
    days,
    sheet,
    rows,
    roster,
    totals,
    periodStart,
    periodEnd,
    isCurrentMonth: month === currentMonth(),
    // preview + toast
    showPreview,
    setShowPreview,
    toast,
    setToast,
    notify,
    // actions
    handlePeriodStart,
    handlePeriodEnd,
    handleToggleDays,
    addTruck,
    handleDeleteTruck,
    handleCreateNew,
    handlePrint,
    handleSavePdf,
    patchSheet,
    patchRow,
    patchTruck,
  }
}
