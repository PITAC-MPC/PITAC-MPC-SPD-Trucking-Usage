import { useRef } from 'react'
import AppBar from './components/app/AppBar'
import Toast from './components/app/Toast'
import SectionHeading from './components/ui/SectionHeading'
import PaperPreview from './components/preview/PaperPreview'
import Sheet, {
  PRINT_WIDTH_MM,
  docNaturalWidth,
} from './components/sheet/Sheet'
import useBilling from './hooks/useBilling'
import useFitScale from './hooks/useFitScale'
import { daysInMonth, formatMonth } from './store'

const MM_TO_PX = 96 / 25.4

export default function App() {
  const billing = useBilling()
  const {
    month,
    days,
    sheet,
    rows,
    totals,
    isCurrentMonth,
    showPreview,
    toast,
  } = billing

  const docRef = useRef(null)
  const previewRef = useRef(null)

  const docScale = useFitScale(docRef, docNaturalWidth(days.length))
  const previewScale = useFitScale(previewRef, PRINT_WIDTH_MM * MM_TO_PX)

  return (
    <>
      <div className="app-shell">
        <AppBar
          showPreview={showPreview}
          onTogglePreview={() => billing.setShowPreview((value) => !value)}
          onSavePdf={billing.handleSavePdf}
          onPrint={billing.handlePrint}
        />

        <main className="payslip-wrap">
          <div className="payslip-sheet">
            <header className="payslip-heading">
              <div>
                <div className="payslip-kicker">Monthly usage sheet</div>
                <h1 className="payslip-title">Trucking Services Billing</h1>
              </div>
              <div className="payslip-heading-note">
                {formatMonth(month)}
                <br />
                A4 landscape
              </div>
            </header>

            <hr className="payslip-divider" />

            <section className="payslip-section">
              <SectionHeading eyebrow="Month" title="Trucking services sheet" />

              <div className="doc-viewport" ref={docRef}>
                <div className="doc-zoom" style={{ zoom: docScale }}>
                  <Sheet
                    mode="screen"
                    month={month}
                    sheet={sheet}
                    rows={rows}
                    days={days}
                    onToggleDays={billing.handleToggleDays}
                    onPatchRow={billing.patchRow}
                    onPatchTruck={billing.patchTruck}
                    onPatchSheet={billing.patchSheet}
                    onDeleteTruck={billing.handleDeleteTruck}
                    onAddTruck={billing.addTruck}
                    onPeriodStart={billing.handlePeriodStart}
                    onPeriodEnd={billing.handlePeriodEnd}
                  />
                </div>
              </div>
            </section>

            {showPreview && (
              <section className="payslip-section preview-section">
                <SectionHeading
                  eyebrow="Paper"
                  title="A4 landscape preview"
                  action={<span className="preview-badge">A4 landscape</span>}
                />
                <PaperPreview
                  month={month}
                  sheet={sheet}
                  rows={rows}
                  days={days}
                  scale={previewScale}
                  viewportRef={previewRef}
                />
              </section>
            )}

            <div className="autosave-note">
              {isCurrentMonth
                ? 'Saved automatically.'
                : `Editing ${formatMonth(month)} — saved automatically.`}
            </div>
          </div>
        </main>

        <Toast toast={toast} onDismiss={() => billing.setToast(null)} />
      </div>

      <div className="print-root" aria-hidden="true">
        <Sheet
          mode="print"
          month={month}
          sheet={sheet}
          rows={rows}
          days={days}
        />
      </div>
    </>
  )
}
