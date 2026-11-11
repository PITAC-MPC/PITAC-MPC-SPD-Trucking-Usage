/**
 * A field on the sheet: an editable input on screen, plain text when printing.
 */
export default function DocField({
  mode,
  className = '',
  value = '',
  onChange,
  placeholder,
  ariaLabel,
  type = 'text',
  min,
  max,
}) {
  if (mode === 'print') {
    return <span>{value || '\u00a0'}</span>
  }

  return (
    <input
      className={`doc-input ${className}`}
      type={type}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      min={min}
      max={max}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange?.(event.target.value)}
    />
  )
}
