import { useEffect, useMemo, useState } from 'react'
import {
  currentMonth,
  emptyMonth,
  loadData,
  monthDays,
  periodBounds,
  rowTrips,
  saveData,
  setRowDays,
  uid,
} from '../store'

/**
 * All the billing state in one place: the saved data, the month being
 * edited, the billing period and every action the UI can trigger.
 *
 * The month is not chosen separately — it follows the start date of the
 * period, so typing a start date in another month switches sheets.
 */
export default function useBilling() {
  const [data, setData] = useState(loadData)
  const [showPreview, setShowPreview] = useState(false)
  const [toast, setToast] = useState(null)

  const month = data.lastMonth
  const days = useMemo(() => monthDays(month), [month])
  const sheet = data.months[month] ?? emptyMonth(data.trucks)

  const { start: periodStart, end: periodEnd } = periodBounds(month, sheet)

  const totals = useMemo(() => {
    const trips = sheet.rows.reduce((sum, row) => sum + rowTrips(row), 0)
    const amount = sheet.rows.reduce(
      (sum, row) => sum + (Number(row.rate) || 0) * rowTrips(row),
      0,
    )
    return { trips, amount }
  }, [sheet.rows])

  const usedDays = useMemo(
    () =>
      sheet.rows.reduce((sum, row) => sum + new Set(row.days ?? []).size, 0),
    [sheet.rows],
  )

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  // Every month gets its own copy of the truck list the first time it is opened.
  useEffect(() => {
    setData((previous) =>
      previous.months[previous.lastMonth]
        ? previous
        : {
            ...previous,
            months: {
              ...previous.months,
              [previous.lastMonth]: emptyMonth(previous.trucks),
            },
          },
    )
  }, [data.lastMonth])

  const notify = (message, tone = 'success') => setToast({ message, tone })

  const updateSheet = (updater) =>
    setData((previous) => {
      const key = previous.lastMonth
      const existing = previous.months[key] ?? emptyMonth(previous.trucks)
      return {
        ...previous,
        months: { ...previous.months, [key]: updater(existing) },
      }
    })

  const patchSheet = (patch) =>
    updateSheet((existing) => ({ ...existing, ...patch }))

  const patchRow = (rowId, patch) =>
    updateSheet((existing) => ({
      ...existing,
      rows: existing.rows.map((row) =>
        row.id === rowId ? { ...row, ...patch } : row,
      ),
    }))

  /** The start date also decides which month (and sheet) is being edited. */
  const handlePeriodStart = (value) => {
    if (!value) return
    const monthKey = value.slice(0, 7)

    if (monthKey !== data.lastMonth) {
      setData((previous) => {
        const list = monthDays(monthKey)
        const existing = previous.months[monthKey] ?? emptyMonth(previous.trucks)
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
  const handleToggleDays = (rowId, dates, mode) =>
    updateSheet((existing) => ({
      ...existing,
      rows: existing.rows.map((row) =>
        row.id === rowId ? setRowDays(row, dates, mode) : row,
      ),
    }))

  /** Adds a truck to this month (and to the list carried into new months). */
  const addTruck = ({ name: rawName, plate: rawPlate, rate: rawRate }) => {
    const name = String(rawName ?? '').trim()
    if (!name) return
    const plate = String(rawPlate ?? '').trim()
    const rate = Math.max(0, Number(rawRate) || 0)

    const truck = { id: uid(), name, plate, rate }
    const row = {
      id: uid(),
      truckId: truck.id,
      name,
      plate,
      rate,
      tripsOverride: null,
    }

    setData((previous) => {
      const key = previous.lastMonth
      const existing = previous.months[key] ?? emptyMonth(previous.trucks)
      return {
        ...previous,
        trucks: [...previous.trucks, truck],
        months: {
          ...previous.months,
          [key]: { ...existing, rows: [...existing.rows, row] },
        },
      }
    })
    notify(`${name} added to this month.`)
  }

  const handleDeleteRow = (rowId) => {
    const row = sheet.rows.find((item) => item.id === rowId)
    const label = row?.name || 'this truck'
    if (
      !window.confirm(
        `Remove ${label} from the truck list?\n\nPast months keep their own copy of the row.`,
      )
    ) {
      return
    }
    setData((previous) => {
      const key = previous.lastMonth
      const existing = previous.months[key] ?? emptyMonth(previous.trucks)
      return {
        ...previous,
        trucks: previous.trucks.filter((truck) => truck.id !== row?.truckId),
        months: {
          ...previous.months,
          [key]: {
            ...existing,
            rows: existing.rows.filter((item) => item.id !== rowId),
          },
        },
      }
    })
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
    totals,
    usedDays,
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
    handleDeleteRow,
    handlePrint,
    handleSavePdf,
    patchSheet,
    patchRow,
  }
}
