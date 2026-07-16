import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEAL_STATUS_OPTIONS,
  DealStatus,
  Entry,
  Section,
  VISITED_CLIENT_LABEL,
  dealStatusLabel,
  metStatusLabel,
} from '../types'
import { exportExcel, exportPdf } from '../lib/exporters'
import { fetchPlaces, fetchSections, subscribePlaces } from '../lib/db'
import {
  companyShareUrl,
  fetchCompanyPortalPlaces,
  playNewReportAlert,
} from '../lib/companies'
import { telHref, whatsappHref } from '../lib/phone'
import InstallAppButton from './InstallAppButton'
import MediaImage from './MediaImage'

interface Props {
  company: string
  title: string
  onExit: () => void
  exitLabel: string
  /** Public company portal: reads snapshot (no researcher session required). */
  publicMode?: boolean
  portalSlug?: string
}

type StatusFilter = 'all' | Exclude<DealStatus, ''> | 'unset' | 'not_met'

export default function CompanyPortal({
  company,
  title,
  onExit,
  exitLabel,
  publicMode = false,
  portalSlug,
}: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectionId, setSectionId] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [busy, setBusy] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const [selected, setSelected] = useState<Entry | null>(null)
  const knownIds = useRef<Set<string> | null>(null)
  const primed = useRef(false)

  useEffect(() => {
    let active = true
    knownIds.current = null
    primed.current = false

    const applyPlaces = (p: Entry[]) => {
      if (!active) return
      const forCompany = publicMode
        ? p
        : p.filter((e) => (e.targetCompany?.trim() || '') === company)

      if (!primed.current) {
        knownIds.current = new Set(forCompany.map((e) => e.id))
        primed.current = true
      } else if (knownIds.current) {
        const fresh = forCompany.filter((e) => !knownIds.current!.has(e.id))
        if (fresh.length) {
          playNewReportAlert()
          for (const e of fresh) knownIds.current.add(e.id)
        }
        knownIds.current = new Set(forCompany.map((e) => e.id))
      }
      setEntries(p)
    }

    const load = async () => {
      try {
        if (publicMode && portalSlug) {
          const p = await fetchCompanyPortalPlaces(portalSlug)
          applyPlaces(p)
          setSections([])
        } else {
          const [p, s] = await Promise.all([fetchPlaces(), fetchSections()])
          if (active) {
            applyPlaces(p)
            setSections(s)
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    if (publicMode && portalSlug) {
      const timer = window.setInterval(() => {
        fetchCompanyPortalPlaces(portalSlug)
          .then((p) => applyPlaces(p))
          .catch(() => undefined)
      }, 4000)
      return () => {
        active = false
        window.clearInterval(timer)
      }
    }

    const unsub = subscribePlaces(() => {
      fetchPlaces().then((p) => applyPlaces(p)).catch(() => undefined)
    })
    return () => {
      active = false
      unsub()
    }
  }, [company, publicMode, portalSlug])

  const companyEntries = useMemo(() => {
    const list = publicMode
      ? entries
      : entries.filter((e) => (e.targetCompany?.trim() || '') === company)
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [entries, company, publicMode])

  const usedSections = useMemo(() => {
    const ids = new Set(companyEntries.map((e) => e.sectionId))
    return sections.filter((s) => ids.has(s.id))
  }, [companyEntries, sections])

  const visible = useMemo(() => {
    let list = companyEntries
    if (sectionId !== 'all') list = list.filter((e) => e.sectionId === sectionId)
    if (statusFilter === 'unset') list = list.filter((e) => !e.dealStatus)
    else if (statusFilter === 'not_met') list = list.filter((e) => e.met === 'no')
    else if (statusFilter !== 'all') list = list.filter((e) => e.dealStatus === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (e) =>
          e.placeName.toLowerCase().includes(q) ||
          e.activityType.toLowerCase().includes(q) ||
          e.address.toLowerCase().includes(q) ||
          dealStatusLabel(e.dealStatus).includes(q) ||
          metStatusLabel(e.met).includes(q),
      )
    }
    return list
  }, [companyEntries, sectionId, statusFilter, search])

  const stats = useMemo(() => {
    const purchased = companyEntries.filter((e) => e.dealStatus === 'purchased').length
    const objections = companyEntries.filter((e) => e.dealStatus === 'objections').length
    const rejected = companyEntries.filter((e) => e.dealStatus === 'rejected').length
    const followUp = companyEntries.filter((e) => e.dealStatus === 'follow_up').length
    const notMet = companyEntries.filter((e) => e.met === 'no').length
    return { total: companyEntries.length, purchased, objections, rejected, followUp, notMet }
  }, [companyEntries])

  const sectionName = (id: string) => sections.find((s) => s.id === id)?.name ?? '-'
  const activityLabel = (e: Entry) =>
    e.activityType === 'أخرى' && e.customActivity ? e.customActivity : e.activityType

  const downloadPdf = async () => {
    if (!visible.length) return
    setBusy(true)
    setExportMsg('')
    try {
      await exportPdf(visible, sections, { targetCompany: company, researcher: '' })
      setExportMsg('تم تنزيل PDF')
    } catch (e) {
      alert('تعذّر إنشاء التقرير: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const downloadExcel = () => {
    if (!visible.length) return
    setExportMsg('')
    try {
      exportExcel(visible, sections, { targetCompany: company, researcher: '' })
      setExportMsg('تم تنزيل Excel')
    } catch (e) {
      alert('تعذّر إنشاء Excel: ' + (e as Error).message)
    }
  }

  const statusBadge = (status: DealStatus | undefined) => {
    if (!status) return <span className="deal-badge unset">بدون تصنيف</span>
    return <span className={`deal-badge deal-${status}`}>{dealStatusLabel(status)}</span>
  }

  return (
    <div className="portal">
      <header className="portal-header">
        <div className="portal-brand">
          <span className="portal-logo">{(title || 'ش').slice(0, 1)}</span>
          <div>
            <h1>{title}</h1>
            <p>بوابة التقارير الميدانية — تحديث لحظي{publicMode ? ' 🔔' : ''}</p>
          </div>
        </div>
        <div className="header-actions">
          <InstallAppButton compact />
          <button className="btn secondary" onClick={downloadExcel} disabled={busy || !visible.length}>
            تصدير Excel
          </button>
          <button className="btn secondary" onClick={downloadPdf} disabled={busy || !visible.length}>
            {busy ? 'جارٍ الإنشاء...' : 'تصدير PDF'}
          </button>
          <button className="btn ghost" onClick={onExit}>
            {exitLabel}
          </button>
        </div>
      </header>
      {exportMsg && <p className="hint" style={{ textAlign: 'center' }}>{exportMsg}</p>}

      {loading ? (
        <div className="empty">
          <p className="empty-title">جارٍ تحميل التقارير...</p>
        </div>
      ) : (
        <>
          <section className="stats-row filter-stats">
            <button
              type="button"
              className={`stat-card clickable ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span className="stat-num">{stats.total}</span>
              <span className="stat-label">إجمالي الأماكن</span>
            </button>
            <button
              type="button"
              className={`stat-card ok clickable ${statusFilter === 'purchased' ? 'active' : ''}`}
              onClick={() => setStatusFilter('purchased')}
            >
              <span className="stat-num">{stats.purchased}</span>
              <span className="stat-label">مشتري بالفعل</span>
            </button>
            <button
              type="button"
              className={`stat-card amber clickable ${statusFilter === 'objections' ? 'active' : ''}`}
              onClick={() => setStatusFilter('objections')}
            >
              <span className="stat-num">{stats.objections}</span>
              <span className="stat-label">اعتراضات يمكن حلها</span>
            </button>
            <button
              type="button"
              className={`stat-card warn clickable ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              <span className="stat-num">{stats.rejected}</span>
              <span className="stat-label">رافض الفكرة تماما</span>
            </button>
            <button
              type="button"
              className={`stat-card follow clickable ${statusFilter === 'follow_up' ? 'active' : ''}`}
              onClick={() => setStatusFilter('follow_up')}
            >
              <span className="stat-num">{stats.followUp}</span>
              <span className="stat-label">يعاد التواصل / الزيارة</span>
            </button>
            <button
              type="button"
              className={`stat-card muted-stat clickable ${statusFilter === 'not_met' ? 'active' : ''}`}
              onClick={() => setStatusFilter('not_met')}
            >
              <span className="stat-num">{stats.notMet}</span>
              <span className="stat-label">لم تتم المقابلة</span>
            </button>
          </section>

          <div className="toolbar">
            <input
              className="search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في التقارير..."
            />
            {usedSections.length > 0 && (
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
            )}
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
              <option value="not_met">لم تتم المقابلة</option>
              <option value="unset">بدون تصنيف</option>
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
                <article
                  className="card report-card clickable"
                  key={e.id}
                  onClick={() => setSelected(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') setSelected(e)
                  }}
                  role="button"
                  tabIndex={0}
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
                  <p className="visitor-label">{VISITED_CLIENT_LABEL}</p>
                  <p className="card-activity">{activityLabel(e)}</p>
                  {e.address && <p className="card-line">📍 {e.address}</p>}
                  {e.managerName && <p className="card-line">👤 {e.managerName}</p>}
                  {e.managerPhone && (
                    <div className="phone-row" onClick={(ev) => ev.stopPropagation()}>
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
                  <div className="card-line">{statusBadge(e.dealStatus)}</div>
                  <p className="card-line">{metStatusLabel(e.met)}</p>
                  {e.dealStatus === 'rejected' && e.rejectionReason && (
                    <p className="card-notes">سبب الرفض: {e.rejectionReason}</p>
                  )}
                  {(e.met === 'yes' || e.met === 'phone_answered') && e.meetingNotes && (
                    <p className="card-notes">{e.meetingNotes}</p>
                  )}
                  <p className="card-line time">
                    🕒 وقت الرفع: {new Date(e.updatedAt).toLocaleString('ar-EG')}
                  </p>
                  <p className="card-open-hint">اضغط لعرض التفاصيل</p>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal report-detail-modal"
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-head">
              <h2>{selected.placeName || 'بدون اسم'}</h2>
              <button className="btn ghost small" onClick={() => setSelected(null)}>
                إغلاق
              </button>
            </div>
            <div className="detail-meta">
              <span className="tag">{sectionName(selected.sectionId)}</span>
              <span className="visitor-label">{VISITED_CLIENT_LABEL}</span>
              {statusBadge(selected.dealStatus)}
            </div>
            <dl className="detail-grid">
              <div>
                <dt>نوع النشاط</dt>
                <dd>{activityLabel(selected)}</dd>
              </div>
              <div>
                <dt>حالة التواصل</dt>
                <dd>{metStatusLabel(selected.met)}</dd>
              </div>
              <div>
                <dt>التصنيف</dt>
                <dd>{dealStatusLabel(selected.dealStatus) || 'بدون تصنيف'}</dd>
              </div>
              <div>
                <dt>اسم المدير</dt>
                <dd>{selected.managerName || '—'}</dd>
              </div>
              <div>
                <dt>رقم الجوال</dt>
                <dd dir="ltr">{selected.managerPhone || '—'}</dd>
              </div>
              {selected.managerPhone && (
                <div className="detail-full phone-actions">
                  <a className="btn secondary small" href={telHref(selected.managerPhone)}>
                    اتصال
                  </a>
                  <a
                    className="btn whatsapp small"
                    href={whatsappHref(selected.managerPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    واتساب
                  </a>
                </div>
              )}
              <div className="detail-full">
                <dt>العنوان</dt>
                <dd>{selected.address || '—'}</dd>
              </div>
              {selected.addressNotes && (
                <div className="detail-full">
                  <dt>ملاحظات العنوان</dt>
                  <dd>{selected.addressNotes}</dd>
                </div>
              )}
              {portalSlug && (
                <div className="detail-full">
                  <dt>رابط بوابة الشركة</dt>
                  <dd dir="ltr">{companyShareUrl(portalSlug)}</dd>
                </div>
              )}
              {selected.dealStatus === 'rejected' && (
                <div className="detail-full">
                  <dt>أسباب الرفض</dt>
                  <dd>{selected.rejectionReason || '—'}</dd>
                </div>
              )}
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
            {selected.photos?.length > 0 && (
              <div className="detail-photos">
                {selected.photos.map((p) => (
                  <MediaImage
                    key={p.id}
                    id={p.id}
                    directUrl={p.url}
                    alt="صورة"
                    className="detail-photo media-img"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="app-footer">
        <span>بوابة عرض التقارير — {title}</span>
      </footer>
    </div>
  )
}
