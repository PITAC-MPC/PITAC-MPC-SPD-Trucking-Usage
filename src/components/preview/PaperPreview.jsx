import Sheet from '../sheet/Sheet'

/** The printed A4 landscape sheet, shown inline on the same screen. */
export default function PaperPreview({
  month,
  sheet,
  days,
  usedDays,
  scale,
  viewportRef,
}) {
  return (
    <div className="paper-preview-scroll" ref={viewportRef}>
      <div className="doc-zoom" style={{ zoom: scale }}>
        <Sheet
          mode="print"
          month={month}
          sheet={sheet}
          days={days}
          usedDays={usedDays}
        />
      </div>
    </div>
  )
}
