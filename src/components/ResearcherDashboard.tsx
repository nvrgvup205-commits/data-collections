import { useCallback, useEffect, useMemo, useState } from 'react'
import { Entry, KNOWN_COMPANIES, Section, SECTION_COLORS, dealStatusLabel } from '../types'
import { useAuth } from '../lib/auth'
import {
  addSection as addSectionCloud,
  deletePlace,
  ensureDefaultSections,
  fetchPlaces,
  savePlace,
  subscribePlaces,
} from '../lib/db'
import EntryForm from './EntryForm'
import ExportPanel from './ExportPanel'
import MediaImage from './MediaImage'

type View = 'list' | 'form'

interface Props {
  onPreviewCompany: (company: string) => void
}

export default function ResearcherDashboard({ onPreviewCompany }: Props) {
  const { user, logout } = useAuth()
  const [sections, setSections] = useState<Section[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<string>('all')
  const [activeCompany, setActiveCompany] = useState<string>('all')
  const [view, setView] = useState<View>('list')
  const [editing, setEditing] = useState<Entry | undefined>(undefined)
  const [showExport, setShowExport] = useState(false)
  const [search, setSearch] = useState('')

  const refreshEntries = useCallback(async () => {
    const p = await fetchPlaces()
    setEntries(p)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const s = await ensureDefaultSections()
        const p = await fetchPlaces()
        if (active) {
          setSections(s)
          setEntries(p)
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (active) setLoading(false)
      }
    })()
    const unsub = subscribePlaces(() => {
      fetchPlaces().then((p) => setEntries(p)).catch(() => undefined)
    })
    return () => {
      active = false
      unsub()
    }
  }, [])

  const companies = useMemo(() => {
    const set = new Set<string>(KNOWN_COMPANIES)
    entries.forEach((e) => {
      const c = e.targetCompany?.trim()
      if (c) set.add(c)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'))
  }, [entries])

  const filteredEntries = useMemo(() => {
    let list = [...entries].sort((a, b) => b.updatedAt - a.updatedAt)
    if (activeSection !== 'all') list = list.filter((e) => e.sectionId === activeSection)
    if (activeCompany !== 'all')
      list = list.filter((e) => (e.targetCompany?.trim() || '') === activeCompany)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (e) =>
          e.placeName.toLowerCase().includes(q) ||
          e.managerName.toLowerCase().includes(q) ||
          e.address.toLowerCase().includes(q) ||
          (e.targetCompany || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [entries, activeSection, activeCompany, search])

  const sectionName = (id: string) => sections.find((s) => s.id === id)?.name ?? '-'

  const startAdd = () => {
    setEditing(undefined)
    setView('form')
  }
  const startEdit = (entry: Entry) => {
    setEditing(entry)
    setView('form')
  }

  const saveEntry = async (entry: Entry) => {
    try {
      await savePlace(entry)
      await refreshEntries()
    } catch (e) {
      alert('تعذّر حفظ التقرير: ' + (e as Error).message)
      return
    }
    setView('list')
    setEditing(undefined)
  }

  const deleteEntry = async (id: string) => {
    if (!confirm('حذف هذا المكان نهائيًا؟')) return
    const target = entries.find((e) => e.id === id)
    try {
      await deletePlace(id, (target?.photos ?? []).map((p) => p.id))
      await refreshEntries()
    } catch (e) {
      alert('تعذّر الحذف: ' + (e as Error).message)
    }
  }

  const addSection = async () => {
    const name = prompt('اسم القسم الجديد (مثال: عيادات، صيدليات...)')
    if (!name || !name.trim()) return
    const color = SECTION_COLORS[sections.length % SECTION_COLORS.length]
    try {
      const s = await addSectionCloud(name.trim(), color)
      setSections((prev) => [...prev, s])
    } catch (e) {
      alert('تعذّرت إضافة القسم: ' + (e as Error).message)
    }
  }

  const defaultSectionId =
    activeSection !== 'all' ? activeSection : sections[0]?.id ?? ''

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div>
            <h1>لوحة تجميع الأبحاث الميدانية</h1>
            <p>مرحبًا {user?.name} — بياناتك تُحفظ في السحابة لحظيًا.</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn secondary" onClick={() => setShowExport(true)}>
            تصدير PDF / Excel
          </button>
          {view === 'list' && (
            <button className="btn primary" onClick={startAdd}>
              + إضافة مكان
            </button>
          )}
          <button className="btn ghost" onClick={() => void logout()}>
            خروج
          </button>
        </div>
      </header>

      {loading ? (
        <div className="empty">
          <p className="empty-title">جارٍ تحميل البيانات من السحابة...</p>
        </div>
      ) : view === 'list' ? (
        <>
          <div className="sections-bar">
            <button
              className={`chip ${activeSection === 'all' ? 'active' : ''}`}
              onClick={() => setActiveSection('all')}
            >
              الكل ({entries.length})
            </button>
            {sections.map((s) => {
              const count = entries.filter((e) => e.sectionId === s.id).length
              return (
                <button
                  key={s.id}
                  className={`chip ${activeSection === s.id ? 'active' : ''}`}
                  style={
                    activeSection === s.id
                      ? { background: s.color, borderColor: s.color }
                      : { borderColor: s.color, color: s.color }
                  }
                  onClick={() => setActiveSection(s.id)}
                >
                  {s.name} ({count})
                </button>
              )
            })}
            <button className="chip add" onClick={addSection}>
              + قسم جديد
            </button>
          </div>

          <div className="toolbar">
            <input
              className="search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المكان أو المدير أو العنوان أو الشركة..."
            />
            <select
              className="company-filter"
              value={activeCompany}
              onChange={(e) => setActiveCompany(e.target.value)}
            >
              <option value="all">كل الشركات ({entries.length})</option>
              {companies.map((c) => {
                const count = entries.filter(
                  (e) => (e.targetCompany?.trim() || '') === c,
                ).length
                return (
                  <option key={c} value={c}>
                    {c} ({count})
                  </option>
                )
              })}
            </select>
          </div>

          {activeCompany !== 'all' && (
            <div className="company-banner">
              <span>
                التقارير المقدَّمة إلى: <strong>{activeCompany}</strong> —{' '}
                {filteredEntries.length} تقرير
              </span>
              <button
                className="btn secondary small"
                onClick={() => onPreviewCompany(activeCompany)}
              >
                معاينة بوابة الشركة
              </button>
            </div>
          )}

          {filteredEntries.length === 0 ? (
            <div className="empty">
              <p className="empty-title">لا توجد بيانات بعد</p>
              <p className="muted">اضغط «إضافة مكان» لتسجيل أول مكان.</p>
              <button className="btn primary" onClick={startAdd}>
                + إضافة مكان
              </button>
            </div>
          ) : (
            <div className="cards">
              {filteredEntries.map((e) => (
                <article className="card" key={e.id}>
                  <div className="card-head">
                    <h3>{e.placeName || 'بدون اسم'}</h3>
                    <span className="tag">{sectionName(e.sectionId)}</span>
                  </div>
                  <p className="card-activity">
                    {e.activityType === 'أخرى' && e.customActivity
                      ? e.customActivity
                      : e.activityType}
                  </p>
                  {e.targetCompany && (
                    <p className="card-line company">🏢 مُقدَّم إلى: {e.targetCompany}</p>
                  )}
                  {e.photos?.length > 0 && (
                    <div className="card-photos">
                      {e.photos.slice(0, 3).map((p) => (
                        <MediaImage
                          key={p.id}
                          id={p.id}
                          directUrl={p.url}
                          alt="صورة المدخل"
                          className="card-photo"
                        />
                      ))}
                    </div>
                  )}
                  {e.address && <p className="card-line">📍 {e.address}</p>}
                  {e.managerName && <p className="card-line">👤 {e.managerName}</p>}
                  {e.managerPhone && (
                    <p className="card-line" dir="ltr">
                      📞 {e.managerPhone}
                    </p>
                  )}
                  <p className="card-line">
                    {e.met === 'yes'
                      ? '✅ تمت المقابلة'
                      : e.met === 'no'
                        ? '⛔ لم تتم المقابلة'
                        : '➖ المقابلة غير محددة'}
                  </p>
                  <p className="card-line">
                    {e.dealStatus ? (
                      <span className={`deal-badge deal-${e.dealStatus}`}>
                        {dealStatusLabel(e.dealStatus)}
                      </span>
                    ) : (
                      <span className="deal-badge unset">بدون تصنيف</span>
                    )}
                  </p>
                  {e.met === 'yes' && e.meetingNotes && (
                    <p className="card-notes">{e.meetingNotes}</p>
                  )}
                  <p className="card-line time">
                    🕒 وقت الرفع: {new Date(e.updatedAt).toLocaleString('ar-EG')}
                  </p>
                  <div className="card-actions">
                    <button className="btn ghost small" onClick={() => startEdit(e)}>
                      تعديل
                    </button>
                    <button className="btn danger small" onClick={() => deleteEntry(e.id)}>
                      حذف
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="form-view">
          <button className="back-link" onClick={() => setView('list')}>
            → رجوع للقائمة
          </button>
          <h2>{editing ? 'تعديل مكان' : 'إضافة مكان جديد'}</h2>
          <EntryForm
            sections={sections}
            companies={companies}
            initial={editing}
            defaultSectionId={defaultSectionId}
            onSave={saveEntry}
            onCancel={() => setView('list')}
          />
        </div>
      )}

      {showExport && (
        <ExportPanel
          entries={entries}
          sections={sections}
          companies={companies}
          initialCompany={activeCompany !== 'all' ? activeCompany : ''}
          onClose={() => setShowExport(false)}
        />
      )}

      <footer className="app-footer">
        <span>البيانات محفوظة في السحابة (Supabase) وتتحدّث لحظيًا.</span>
      </footer>
    </div>
  )
}
