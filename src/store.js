const STORAGE_KEY = 'pitac-trucking-v1'

export const pad2 = (n) => String(n).padStart(2, '0')

export const uid = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

export function daysInMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

export function monthDays(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const total = daysInMonth(monthKey)
  return Array.from(
    { length: total },
    (_, i) => `${year}-${pad2(month)}-${pad2(i + 1)}`,
  )
}

export function formatMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function shortDate(isoDate) {
  const [, month, day] = isoDate.split('-')
  return `${Number(month)}/${Number(day)}`
}

export function formatMoney(value) {
  const n = Number(value) || 0
  return `\u20B1${new Intl.NumberFormat('en-PH', {
    maximumFractionDigits: 2,
  }).format(n)}`
}

export function addDays(isoDate, delta) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day + delta)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function countDays(start, end) {
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  const from = Date.UTC(ys, ms - 1, ds)
  const to = Date.UTC(ye, me - 1, de)
  return Math.round((to - from) / 86400000) + 1
}

/* ------------------------------------------------------------------
   Usage
   The period (start + end date) decides the month and is printed on the
   Date: line. Every truck row keeps its own marked days, so two trucks
   can have been used on different dates inside the same period.
   ------------------------------------------------------------------ */

/** The billing period shown on the "Date:" line of the sheet. */
export function periodBounds(monthKey, sheet) {
  const list = monthDays(monthKey)
  const start =
    sheet?.periodStart && list.includes(sheet.periodStart)
      ? sheet.periodStart
      : list[0]
  const end =
    sheet?.periodEnd && list.includes(sheet.periodEnd)
      ? sheet.periodEnd
      : list[list.length - 1]
  return { start, end: end < start ? start : end }
}

/** The days a truck was used. */
export function rowDays(row) {
  return row?.days ?? []
}

export function isRowDayUsed(row, date) {
  return rowDays(row).includes(date)
}

export function rowTrips(row) {
  return row.tripsOverride ?? rowDays(row).length
}

/** Adds or removes days on a truck row. */
export function setRowDays(row, dates, mode) {
  const current = rowDays(row)
  if (mode === 'unmark') {
    const remove = new Set(dates)
    return { ...row, days: current.filter((day) => !remove.has(day)) }
  }
  const add = new Set(dates)
  return {
    ...row,
    days: [...new Set([...current, ...add])].sort(),
  }
}

/** Expand ranges into the individual days they cover. */
export function expandRanges(ranges) {
  const days = []
  for (const entry of ranges ?? []) {
    const span = countDays(entry.start, entry.end)
    for (let i = 0; i < span; i += 1) {
      days.push(addDays(entry.start, i))
    }
  }
  return days
}

/* ------------------------------------------------------------------
   Months
   ------------------------------------------------------------------ */

export function emptyMonth(trucks) {
  return {
    destination: '',
    controlNumber: '',
    periodStart: '',
    periodEnd: '',
    notes: '',
    preparedBy: '',
    preparedPosition: 'Logistics Manager',
    approvedBy: '',
    approvedPosition: 'SPD Manager',
    rows: trucks.map((truck) => ({
      id: uid(),
      truckId: truck.id,
      name: truck.name,
      plate: truck.plate,
      rate: truck.rate,
      tripsOverride: null,
      days: [],
    })),
  }
}

/** e.g. "MARCH 1-18 2026" or "MARCH 2026" for the whole month. */
export function formatPeriod(monthKey, sheet) {
  const { start, end } = periodBounds(monthKey, sheet)
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  const monthName = new Date(ys, ms - 1, 1)
    .toLocaleDateString('en-US', { month: 'long' })
    .toUpperCase()
  const lastDay = daysInMonth(monthKey)

  if (ys === ye && ms === me) {
    if (ds === 1 && de === lastDay) return `${monthName} ${ye}`
    if (ds === de) return `${monthName} ${ds} ${ye}`
    return `${monthName} ${ds}-${de} ${ye}`
  }
  return `${monthName} ${ds} ${ys} - ${monthName} ${de} ${ye}`
}

/**
 * Older files kept the marked days differently over time:
 *  - on each truck row (the oldest),
 *  - shared by the whole month,
 *  - as a period plus the days that were switched off.
 * All of them become per-truck day lists.
 */
function migrateMonth(month, monthKey) {
  if (!month || typeof month !== 'object') return month

  const list = monthDays(monthKey)

  let shared = null
  if (Array.isArray(month.entries)) {
    shared = expandRanges(month.entries)
  } else if (Array.isArray(month.exceptions)) {
    const { start, end } = periodBounds(monthKey, month)
    shared = list.filter(
      (day) => day >= start && day <= end && !month.exceptions.includes(day),
    )
  }

  const rows = (month.rows ?? []).map((row) => {
    const { entries, days, ...rest } = row
    if (Array.isArray(days)) return { ...rest, days }
    if (Array.isArray(entries)) return { ...rest, days: expandRanges(entries) }
    return { ...rest, days: shared ? [...shared] : [] }
  })

  return {
    ...month,
    rows,
    notes: month.notes ?? '',
  }
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && Array.isArray(data.trucks) && data.months) {
        const months = {}
        for (const [key, value] of Object.entries(data.months)) {
          months[key] = migrateMonth(value, key)
        }
        return {
          trucks: data.trucks,
          months,
          lastMonth: data.lastMonth || currentMonth(),
        }
      }
    }
  } catch (error) {
    console.error('Could not read saved data', error)
  }
  return { trucks: [], months: {}, lastMonth: currentMonth() }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Could not save data', error)
  }
}
