import { useMemo, useState } from 'react'
import { Entry, Section } from '../types'
import { exportExcel, exportPdf } from '../lib/exporters'

interface Props {
  entries: Entry[]
  sections: Section[]
  onClose: () => void
}

export default function ExportPanel({ entries, sections, onClose }: Props) {
  const [targetCompany, setTargetCompany] = useState('')
  const [researcher, setResearcher] = useState('')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    if (sectionFilter === 'all') return entries
    return entries.filter((e) => e.sectionId === sectionFilter)
  }, [entries, sectionFilter])

  const meta = { targetCompany, researcher }

  const doExcel = () => {
    if (!filtered.length) return
    exportExcel(filtered, sections, meta)
  }

  const doPdf = async () => {
    if (!filtered.length) return
    setBusy(true)
    try {
      await exportPdf(filtered, sections, meta)
    } catch (e) {
      alert('تعذر إنشاء ملف PDF: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>تصدير البحث</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <label className="field">
          <span>البحث موجّه إلى (اسم الشركة)</span>
          <input
            type="text"
            value={targetCompany}
            onChange={(e) => setTargetCompany(e.target.value)}
            placeholder="مثال: شركة الأفق للتسويق"
          />
        </label>

        <label className="field">
          <span>اسم الباحث (اختياري)</span>
          <input
            type="text"
            value={researcher}
            onChange={(e) => setResearcher(e.target.value)}
          />
        </label>

        <label className="field">
          <span>القسم</span>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
          >
            <option value="all">كل الأقسام</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <p className="hint muted">سيتم تصدير {filtered.length} مكان.</p>

        <div className="form-actions">
          <button
            className="btn primary"
            onClick={doPdf}
            disabled={busy || !filtered.length}
          >
            {busy ? 'جارٍ الإنشاء...' : 'تصدير PDF'}
          </button>
          <button
            className="btn secondary"
            onClick={doExcel}
            disabled={!filtered.length}
          >
            تصدير Excel
          </button>
          <button className="btn ghost" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}
