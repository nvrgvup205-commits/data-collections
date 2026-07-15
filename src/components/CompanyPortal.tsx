import { useEffect, useMemo, useState } from 'react'
import { Entry, Section } from '../types'
import { exportPdf } from '../lib/exporters'
import { fetchPlaces, fetchSections, subscribePlaces } from '../lib/db'
import MediaImage from './MediaImage'

interface Props {
  company: string
  title: string
  onExit: () => void
  exitLabel: string
}

export default function CompanyPortal({ company, title, onExit, exitLabel }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectionId, setSectionId] = useState('all')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [p, s] = await Promise.all([fetchPlaces(), fetchSections()])
        if (active) {
          setEntries(p)
          setSections(s)
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    const unsub = subscribePlaces(() => {
      fetchPlaces().then((p) => active && setEntries(p)).catch(() => undefined)
    })
    return () => {
      active = false
      unsub()
    }
  }, [])

  const companyEntries = useMemo(
    () =>
      entries
        .filter((e) => (e.targetCompany?.trim() || '') === company)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [entries, company],
  )

  const usedSections = useMemo(() => {
    const ids = new Set(companyEntries.map((e) => e.sectionId))
    return sections.filter((s) => ids.has(s.id))
  }, [companyEntries, sections])

  const visible = useMemo(() => {
    let list = companyEntries
    if (sectionId !== 'all') list = list.filter((e) => e.sectionId === sectionId)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (e) =>
          e.placeName.toLowerCase().includes(q) ||
          e.activityType.toLowerCase().includes(q) ||
          e.address.toLowerCase().includes(q),
      )
    }
    return list
  }, [companyEntries, sectionId, search])

  const stats = useMemo(() => {
    const met = companyEntries.filter((e) => e.met === 'yes').length
    const notMet = companyEntries.filter((e) => e.met === 'no').length
    const activities = new Set(
      companyEntries.map((e) =>
        e.activityType === 'أخرى' && e.customActivity ? e.customActivity : e.activityType,
      ),
    ).size
    const photos = companyEntries.reduce((n, e) => n + (e.photos?.length ?? 0), 0)
    return { total: companyEntries.length, met, notMet, activities, photos }
  }, [companyEntries])

  const sectionName = (id: string) => sections.find((s) => s.id === id)?.name ?? '-'
  const activityLabel = (e: Entry) =>
    e.activityType === 'أخرى' && e.customActivity ? e.customActivity : e.activityType

  const downloadPdf = async () => {
    if (!visible.length) return
    setBusy(true)
    try {
      await exportPdf(visible, sections, { targetCompany: company, researcher: '' })
    } catch (e) {
      alert('تعذّر إنشاء التقرير: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="portal">
      <header className="portal-header">
        <div className="portal-brand">
          <span className="portal-logo">{(title || 'ش').slice(0, 1)}</span>
          <div>
            <h1>{title}</h1>
            <p>بوابة التقارير الميدانية — تحديث لحظي</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn secondary" onClick={downloadPdf} disabled={busy || !visible.length}>
            {busy ? 'جارٍ الإنشاء...' : 'تنزيل التقرير PDF'}
          </button>
          <button className="btn ghost" onClick={onExit}>
            {exitLabel}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="empty">
          <p className="empty-title">جارٍ تحميل التقارير...</p>
        </div>
      ) : (
        <>
          <section className="stats-row">
            <div className="stat-card">
              <span className="stat-num">{stats.total}</span>
              <span className="stat-label">إجمالي الأماكن</span>
            </div>
            <div className="stat-card ok">
              <span className="stat-num">{stats.met}</span>
              <span className="stat-label">تمت المقابلة</span>
            </div>
            <div className="stat-card warn">
              <span className="stat-num">{stats.notMet}</span>
              <span className="stat-label">لم تتم المقابلة</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{stats.activities}</span>
              <span className="stat-label">أنواع الأنشطة</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{stats.photos}</span>
              <span className="stat-label">عدد الصور</span>
            </div>
          </section>

          <div className="toolbar">
            <input
              className="search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في التقارير..."
            />
            <select
              className="company-filter"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <option value="all">كل الأقسام</option>
              {usedSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="empty">
              <p className="empty-title">لا توجد تقارير بعد</p>
              <p className="muted">سيظهر هنا كل تقرير ميداني يُقدَّم لشركتكم فور رفعه.</p>
            </div>
          ) : (
            <div className="cards">
              {visible.map((e) => (
                <article className="card report-card" key={e.id}>
                  {e.photos?.length > 0 && (
                    <div className="report-hero">
                      <MediaImage
                        id={e.photos[0].id}
                        directUrl={e.photos[0].url}
                        alt="صورة المدخل"
                        className="report-hero-img"
                      />
                    </div>
                  )}
                  <div className="card-head">
                    <h3>{e.placeName || 'بدون اسم'}</h3>
                    <span className="tag">{sectionName(e.sectionId)}</span>
                  </div>
                  <p className="card-activity">{activityLabel(e)}</p>
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
                        : '➖ غير محددة'}
                  </p>
                  {e.met === 'yes' && e.meetingNotes && (
                    <p className="card-notes">{e.meetingNotes}</p>
                  )}
                  <p className="card-line time">
                    🕒 وقت الرفع: {new Date(e.updatedAt).toLocaleString('ar-EG')}
                  </p>
                  {e.photos?.length > 1 && (
                    <div className="card-photos">
                      {e.photos.slice(1, 4).map((p) => (
                        <MediaImage
                          key={p.id}
                          id={p.id}
                          directUrl={p.url}
                          alt="صورة"
                          className="card-photo"
                        />
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <footer className="app-footer">
        <span>بوابة عرض التقارير — {title}</span>
      </footer>
    </div>
  )
}
