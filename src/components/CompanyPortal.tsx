import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEAL_STATUS_OPTIONS,
  DealStatus,
  Entry,
  Section,
  VISITED_CLIENT_LABEL,
  dealStatusLabel,
  metStatusLabel,
  photoCaptureTimestamp,
} from '../types'
import { exportExcel, exportPdf } from '../lib/exporters'
import { fetchPlaces, fetchSections, subscribePlaces } from '../lib/db'
import {
  fetchCompanyPortalPlaces,
  playNewReportAlert,
} from '../lib/companies'
import { telHref, whatsappHref } from '../lib/phone'
import { googleMapEmbedUrl, googleMapLink } from '../lib/geo'
import InstallAppButton from './InstallAppButton'
import type { PwaAppProfile } from '../lib/pwa-manifest'
import MediaImage from './MediaImage'

interface Props {
  company: string
  title: string
  onExit: () => void
  exitLabel: string
  /** Public company portal: reads snapshot (no researcher session required). */
  publicMode?: boolean
  portalSlug?: string
  installProfile?: PwaAppProfile
}

type StatusFilter = 'all' | Exclude<DealStatus, ''> | 'unset' | 'not_met'

export default function CompanyPortal({
  company,
  title,
  onExit,
  exitLabel,
  publicMode = false,
  portalSlug,
  installProfile,
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

  const metBadge = (met: Entry['met']) => {
    const label = metStatusLabel(met)
    if (met === 'yes') return <span className="met-badge met-yes">{label}</span>
    if (met === 'phone_answered') return <span className="met-badge met-phone">{label}</span>
    if (met === 'phone_no_answer') return <span className="met-badge met-warn">{label}</span>
    if (met === 'no') return <span className="met-badge met-no">{label}</span>
    return <span className="met-badge met-unset">{label}</span>
  }

  const dealStatusClass = (status: DealStatus | undefined) =>
    status ? `status-${status}` : 'status-unset'

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
            <div className="places-grid">
              {visible.map((e) => (
                <article
                  className={`card place-grid-card clickable ${dealStatusClass(e.dealStatus)}`}
                  key={e.id}
                  onClick={() => setSelected(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') setSelected(e)
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${e.placeName || 'بدون اسم'} — اضغط لعرض التفاصيل`}
                >
                  <div className="place-grid-thumb">
                    {e.photos?.length > 0 ? (
                      <MediaImage
                        id={e.photos[0].id}
                        directUrl={e.photos[0].url}
                        alt="صورة المدخل"
                        className="place-grid-thumb-img"
                      />
                    ) : (
                      <span className="place-grid-thumb-fallback" aria-hidden>
                        📍
                      </span>
                    )}
                    {usedSections.length > 0 && (
                      <span className="place-grid-section">{sectionName(e.sectionId)}</span>
                    )}
                  </div>
                  <div className="place-grid-body">
                    <h3 className="place-grid-name">{e.placeName || 'بدون اسم'}</h3>
                    <p className="place-grid-activity">{activityLabel(e)}</p>
                    <div className="place-grid-badges">
                      {statusBadge(e.dealStatus)}
                      {metBadge(e.met)}
                    </div>
                    {e.audioNote && <span className="place-grid-audio" aria-label="يوجد مقطع صوتي">🎙️</span>}
                    <div className="place-grid-footer">
                      <time className="place-grid-time" dateTime={new Date(photoCaptureTimestamp(e)).toISOString()}>
                        {new Date(photoCaptureTimestamp(e)).toLocaleString('ar-EG', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                      <span className="place-grid-hint">التفاصيل ←</span>
                    </div>
                  </div>
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
            <div className="modal-head report-detail-head">
              <h2>{selected.placeName || 'بدون اسم'}</h2>
              <button className="btn ghost small" onClick={() => setSelected(null)}>
                إغلاق
              </button>
            </div>
            <div className="report-detail-body">
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
              {selected.lat != null && selected.lng != null && (
                <div className="detail-full map-wrap">
                  <iframe
                    className="map-frame"
                    title="الموقع على الخريطة"
                    src={googleMapEmbedUrl({ lat: selected.lat, lng: selected.lng })}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <a
                    className="map-link"
                    href={googleMapLink({ lat: selected.lat, lng: selected.lng })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    فتح في خرائط جوجل
                  </a>
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
              {selected.audioNote && (
                <div className="detail-full">
                  <dt>المقطع الصوتي</dt>
                  <dd>
                    <div className="audio-note portal-audio-note">
                      <audio controls preload="metadata" src={selected.audioNote}>
                        متصفحك لا يدعم تشغيل الصوت.
                      </audio>
                    </div>
                  </dd>
                </div>
              )}
              <div>
                <dt>وقت التقاط الصورة الفعلي</dt>
                <dd>{new Date(photoCaptureTimestamp(selected)).toLocaleString('ar-EG')}</dd>
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
        </div>
      )}

      <footer className="app-footer portal-footer">
        <span>بوابة عرض التقارير — {title}</span>
        <InstallAppButton
          placement="footer"
          profile={
            installProfile ??
            (portalSlug
              ? { kind: 'company', slug: portalSlug, name: company }
              : { kind: 'researcher' })
          }
        />
      </footer>
    </div>
  )
}
