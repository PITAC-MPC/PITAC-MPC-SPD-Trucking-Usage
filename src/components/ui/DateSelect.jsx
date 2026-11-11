import { formatLongDate } from '../../store'

/**
 * A date picker that always shows the date in words — "4 March 2026" —
 * grouped by month.
 */
export default function DateSelect({
  value,
  months,
  onChange,
  ariaLabel,
  placeholder,
}) {
  return (
    <select
      className="doc-select"
      value={value ?? ''}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      {placeholder !== undefined && (
        <option value="">{placeholder}</option>
      )}
      {months.map((group) => (
        <optgroup key={group.key} label={group.label || undefined}>
          {group.days.map((day) => (
            <option key={day} value={day}>
              {formatLongDate(day)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
