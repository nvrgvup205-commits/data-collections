import { useEffect, useMemo, useState } from 'react'
import {
  DealStatus,
  Entry,
  KNOWN_COMPANIES,
  Section,
  SECTION_COLORS,
  VISITED_CLIENT_LABEL,
  dealStatusLabel,
} from '../types'
import { useAuth } from '../lib/auth'
import {
  addSection as addSectionCloud,
  deletePlace,
  ensureDefaultSections,
  fetchPlaces,
  savePlace,
  subscribePlaces,
} from '../lib/db'
import {
  companyShareUrl,
  findCompanyByName,
  listLocalCompanies,
  syncCompanyPortalPlaces,
} from '../lib/companies'
import { telHref, whatsappHref } from '../lib/phone'
import EntryForm from './EntryForm'
import ExportPanel from './ExportPanel'
import MediaImage from './MediaImage'

type View = 'list' | 'form'
type StatusFilter = 'all' | Exclude<DealStatus, ''>

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [view, setView] = useState<View>('list')
  const [editing, setEditing] = useState<Entry | undefined>(undefined)
  const [showExport, setShowExport] = useState(false)
  const [search, setSearch] = useState('')

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
    for (const c of listLocalCompanies()) set.add(c.name)
    entries.forEach((e) => {
      const c = e.targetCompany?.trim()
      if (c) set.add(c)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'))
  }, [entries])

  const statusCounts = useMemo(() => {
    const purchased = entries.filter((e) => e.dealStatus === 'purchased').length
    const objections = entries.filter((e) => e.dealStatus === 'objections').length
    const rejected = entries.filter((e) => e.dealStatus === 'rejected').length
    return { total: entries.length, purchased, objections, rejected }
  }, [entries])

  const filteredEntries = useMemo(() => {
    let list = [...entries].sort((a, b) => b.updatedAt - a.updatedAt)
    if (activeSection !== 'all') list = list.filter((e) => e.sectionId === activeSection)
    if (activeCompany !== 'all')
      list = list.filter((e) => (e.targetCompany?.trim() || '') === activeCompany)
    if (statusFilter !== 'all') list = list.filter((e) => e.dealStatus === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (e) =>
          e.placeName.toLowerCase().includes(q) ||
          e.managerName.toLowerCase().includes(q) ||
          e.address.toLowerCase().includes(q) ||
          (e.targetCompany || '').toLowerCase().includes(q) ||
          (e.slug || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [entries, activeSection, activeCompany, statusFilter, search])

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
      const latest = await fetchPlaces()
      setEntries(latest)
      if (entry.targetCompany.trim()) {
        await syncCompanyPortalPlaces(entry.targetCompany, latest)
      }
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
      const latest = await fetchPlaces()
      setEntries(latest)
      if (target?.targetCompany?.trim()) {
        await syncCompanyPortalPlaces(target.targetCompany, latest)
      }
    } catch (e) {
      alert('تعذّر الحذف: ' + (e as Error).message)
    }
  }

  const addSection = async () => {
    const name = prompt('اسم القسم الجديد (مثال: عيادات، صيدليات...)')
    if (!name || !name.trim()) return
    if (sections.some((s) => s.name.trim() === name.trim())) {
      alert('هذا القسم موجود مسبقًا.')
      return
    }
    const color = SECTION_COLORS[sections.length % SECTION_COLORS.length]
    try {
      const s = await addSectionCloud(name.trim(), color)
      setSections((prev) => {
        if (prev.some((x) => x.name.trim() === s.name.trim())) return prev
        return [...prev, s]
      })
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
          <section className="stats-row filter-stats">
            <button
              type="button"
              className={`stat-card clickable ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span className="stat-num">{statusCounts.total}</span>
              <span className="stat-label">إجمالي الأماكن</span>
            </button>
            <button
              type="button"
              className={`stat-card ok clickable ${statusFilter === 'purchased' ? 'active' : ''}`}
              onClick={() => setStatusFilter('purchased')}
            >
              <span className="stat-num">{statusCounts.purchased}</span>
              <span className="stat-label">مشتري بالفعل</span>
            </button>
            <button
              type="button"
              className={`stat-card amber clickable ${statusFilter === 'objections' ? 'active' : ''}`}
              onClick={() => setStatusFilter('objections')}
            >
              <span className="stat-num">{statusCounts.objections}</span>
              <span className="stat-label">اعتراضات يمكن حلها</span>
            </button>
            <button
              type="button"
              className={`stat-card warn clickable ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              <span className="stat-num">{statusCounts.rejected}</span>
              <span className="stat-label">رافض الفكرة تماما</span>
            </button>
          </section>

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
                  <p className="visitor-label">{VISITED_CLIENT_LABEL}</p>
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
                    <div className="phone-row">
                      <span className="card-line phone-num" dir="ltr">
                        📞 {e.managerPhone}
                      </span>
                      <div className="phone-actions">
                        <a className="btn secondary small" href={telHref(e.managerPhone)}>
                          اتصال
                        </a>
                        <a
                          className="btn whatsapp small"
                          href={whatsappHref(e.managerPhone)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          واتساب
                        </a>
                      </div>
                    </div>
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
                  {e.dealStatus === 'rejected' && e.rejectionReason && (
                    <p className="card-notes">سبب الرفض: {e.rejectionReason}</p>
                  )}
                  {(() => {
                    const meta = findCompanyByName(e.targetCompany)
                    const link = meta ? companyShareUrl(meta.slug) : ''
                    return link ? (
                      <p className="card-line slug-line" dir="ltr">
                        🔗 بوابة الشركة: {link}
                      </p>
                    ) : null
                  })()}
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
