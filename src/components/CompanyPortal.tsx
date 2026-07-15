import { useEffect, useMemo, useState } from 'react'
import {
  DEAL_STATUS_OPTIONS,
  DealStatus,
  Entry,
  Section,
  dealStatusLabel,
} from '../types'
import { exportPdf } from '../lib/exporters'
import { fetchPlaces, fetchSections, subscribePlaces } from '../lib/db'
import MediaImage from './MediaImage'

interface Props {
  company: string
  title: string
  onExit: () => void
  exitLabel: string
}

type StatusFilter = 'all' | Exclude<DealStatus, ''> | 'unset'

const STATUS_GROUPS: { key: StatusFilter; title: string; tone: string }[] = [
  { key: 'purchased', title: 'مشتري بالفعل', tone: 'ok' },
  { key: 'objections', title: 'عنده اعتراضات يمكن حلها', tone: 'amber' },
  { key: 'rejected', title: 'رافض الفكرة تماما', tone: 'warn' },
  { key: 'unset', title: 'بدون تصنيف', tone: '' },
]

export default function CompanyPortal({ company, title, onExit, exitLabel }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectionId, setSectionId] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Entry | null>(null)

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
    if (statusFilter === 'unset') list = list.filter((e) => !e.dealStatus)
    else if (statusFilter !== 'all') list = list.filter((e) => e.dealStatus === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (e) =>
          e.placeName.toLowerCase().includes(q) ||
          e.activityType.toLowerCase().includes(q) ||
          e.address.toLowerCase().includes(q) ||
          dealStatusLabel(e.dealStatus).includes(q),
      )
    }
    return list
  }, [companyEntries, sectionId, statusFilter, search])

  const grouped = useMemo(() => {
    return STATUS_GROUPS.map((g) => ({
      ...g,
      items: visible.filter((e) =>
        g.key === 'unset' ? !e.dealStatus : e.dealStatus === g.key,
      ),
    })).filter((g) => g.items.length > 0)
  }, [visible])

  const stats = useMemo(() => {
    const purchased = companyEntries.filter((e) => e.dealStatus === 'purchased').length
    const objections = companyEntries.filter((e) => e.dealStatus === 'objections').length
    const rejected = companyEntries.filter((e) => e.dealStatus === 'rejected').length
    const photos = companyEntries.reduce((n, e) => n + (e.photos?.length ?? 0), 0)
    return { total: companyEntries.length, purchased, objections, rejected, photos }
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

  const statusBadge = (status: DealStatus | undefined) => {
    if (!status) return <span className="deal-badge unset">بدون تصنيف</span>
    const label = dealStatusLabel(status)
    return <span className={`deal-badge deal-${status}`}>{label}</span>
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
              <span className="stat-num">{stats.purchased}</span>
              <span className="stat-label">مشتري بالفعل</span>
            </div>
            <div className="stat-card amber">
              <span className="stat-num">{stats.objections}</span>
              <span className="stat-label">اعتراضات يمكن حلها</span>
            </div>
            <div className="stat-card warn">
              <span className="stat-num">{stats.rejected}</span>
              <span className="stat-label">رافض الفكرة تماما</span>
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
            <select
              className="company-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">كل التصنيفات</option>
              {DEAL_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              <option value="unset">بدون تصنيف</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="empty">
              <p className="empty-title">لا توجد تقارير بعد</p>
              <p className="muted">سيظهر هنا كل تقرير ميداني يُقدَّم لشركتكم فور رفعه.</p>
            </div>
          ) : (
            <div className="report-groups">
              {grouped.map((group) => (
                <section key={group.key} className="report-group">
                  <div className={`report-group-head ${group.tone}`}>
                    <h2>{group.title}</h2>
                    <span className="report-group-count">{group.items.length}</span>
                  </div>
                  <div className="cards">
                    {group.items.map((e) => (
                      <article
                        className="card report-card clickable"
                        key={e.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(e)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault()
                            setSelected(e)
                          }
                        }}
                      >
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
                        <div className="card-line">{statusBadge(e.dealStatus)}</div>
                        {e.address && <p className="card-line">📍 {e.address}</p>}
                        {e.managerName && <p className="card-line">👤 {e.managerName}</p>}
                        <p className="card-line time">
                          🕒 وقت الرفع: {new Date(e.updatedAt).toLocaleString('ar-EG')}
                        </p>
                        <p className="card-open-hint">اضغط لعرض التفاصيل الكاملة ←</p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <div
          className="modal-backdrop"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            className="modal report-detail-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-detail-title"
          >
            <div className="modal-head">
              <h2 id="report-detail-title">{selected.placeName || 'بدون اسم'}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelected(null)}
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            <div className="detail-meta">
              <span className="tag">{sectionName(selected.sectionId)}</span>
              {statusBadge(selected.dealStatus)}
            </div>

            {selected.photos?.length > 0 && (
              <div className="detail-photos">
                {selected.photos.map((p) => (
                  <MediaImage
                    key={p.id}
                    id={p.id}
                    directUrl={p.url}
                    alt="صورة المدخل"
                    className="detail-photo"
                  />
                ))}
              </div>
            )}

            <dl className="detail-grid">
              <div>
                <dt>نوع النشاط</dt>
                <dd>{activityLabel(selected)}</dd>
              </div>
              {selected.address && (
                <div>
                  <dt>العنوان</dt>
                  <dd>{selected.address}</dd>
                </div>
              )}
              {selected.addressNotes && (
                <div>
                  <dt>ملاحظات العنوان</dt>
                  <dd>{selected.addressNotes}</dd>
                </div>
              )}
              {selected.lat != null && selected.lng != null && (
                <div>
                  <dt>الموقع على الخريطة</dt>
                  <dd>
                    <a
                      href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      فتح في خرائط جوجل
                    </a>
                  </dd>
                </div>
              )}
              {selected.managerName && (
                <div>
                  <dt>اسم المدير</dt>
                  <dd>{selected.managerName}</dd>
                </div>
              )}
              {selected.managerPhone && (
                <div>
                  <dt>رقم الجوال</dt>
                  <dd dir="ltr">{selected.managerPhone}</dd>
                </div>
              )}
              <div>
                <dt>تمت المقابلة؟</dt>
                <dd>
                  {selected.met === 'yes'
                    ? 'نعم'
                    : selected.met === 'no'
                      ? 'لا'
                      : 'غير محدد'}
                </dd>
              </div>
              {selected.meetingNotes && (
                <div className="detail-full">
                  <dt>ملخص المقابلة</dt>
                  <dd>{selected.meetingNotes}</dd>
                </div>
              )}
              <div>
                <dt>وقت الرفع</dt>
                <dd>{new Date(selected.updatedAt).toLocaleString('ar-EG')}</dd>
              </div>
            </dl>

            <div className="form-actions">
              <button type="button" className="btn primary" onClick={() => setSelected(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <span>بوابة عرض التقارير — {title}</span>
      </footer>
    </div>
  )
}
