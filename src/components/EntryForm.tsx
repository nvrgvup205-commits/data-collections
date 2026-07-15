import { useEffect, useRef, useState } from 'react'
import {
  ACTIVITY_TYPES,
  DEAL_STATUS_OPTIONS,
  Entry,
  PhotoRef,
  Section,
} from '../types'
import { reverseGeocode } from '../lib/geo'
import { deleteBlob } from '../lib/media'
import { placeShareUrl, slugify } from '../lib/phone'
import { uid } from '../storage'
import InteractiveMap from './InteractiveMap'
import VoiceInput from './VoiceInput'
import PhotoCapture from './PhotoCapture'

interface Props {
  sections: Section[]
  companies: string[]
  initial?: Entry
  defaultSectionId: string
  onSave: (entry: Entry) => void
  onCancel: () => void
}

// Max audio note size we persist to localStorage (~1.5MB as data URL).
const MAX_AUDIO_BYTES = 1_500_000

function blankEntry(sectionId: string): Entry {
  const now = Date.now()
  return {
    id: uid(),
    sectionId,
    placeName: '',
    address: '',
    addressNotes: '',
    lat: null,
    lng: null,
    managerName: '',
    managerPhone: '',
    activityType: ACTIVITY_TYPES[0],
    customActivity: '',
    met: '',
    meetingNotes: '',
    dealStatus: '',
    rejectionReason: '',
    slug: '',
    placeUsername: '',
    placePassword: '',
    audioNote: '',
    photos: [],
    targetCompany: '',
    createdAt: now,
    updatedAt: now,
  }
}

function normalizeInitial(initial: Entry | undefined, defaultSectionId: string): Entry {
  if (!initial) return blankEntry(defaultSectionId)
  return {
    ...blankEntry(initial.sectionId || defaultSectionId),
    ...initial,
    dealStatus: initial.dealStatus ?? '',
    rejectionReason: initial.rejectionReason ?? '',
    slug: initial.slug ?? '',
    placeUsername: initial.placeUsername ?? '',
    placePassword: initial.placePassword ?? '',
  }
}

export default function EntryForm({
  sections,
  companies,
  initial,
  defaultSectionId,
  onSave,
  onCancel,
}: Props) {
  const [entry, setEntry] = useState<Entry>(() => normalizeInitial(initial, defaultSectionId))
  const [geoMsg, setGeoMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [companyNewMode, setCompanyNewMode] = useState<boolean>(
    !!(initial?.targetCompany && !companies.includes(initial.targetCompany)),
  )
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current)
    }
  }, [])

  const update = <K extends keyof Entry>(key: K, value: Entry[K]) => {
    setEntry((prev) => ({ ...prev, [key]: value }))
  }

  const handleCoords = (lat: number, lng: number) => {
    setEntry((prev) => ({ ...prev, lat, lng }))
    setGeoMsg('جارٍ جلب العنوان لهذا الموقع...')
    if (geoTimer.current) clearTimeout(geoTimer.current)
    geoTimer.current = setTimeout(async () => {
      try {
        const addr = await reverseGeocode({ lat, lng })
        if (addr) {
          setEntry((prev) => ({ ...prev, address: addr }))
          setGeoMsg('تم تحديث العنوان تلقائيًا (يمكنك تعديله).')
        } else {
          setGeoMsg('')
        }
      } catch {
        setGeoMsg('تعذّر جلب نص العنوان تلقائيًا، اكتبه يدويًا لو أردت.')
      }
    }, 800)
  }

  const addPhoto = (ref: PhotoRef) => {
    setEntry((prev) => ({ ...prev, photos: [...prev.photos, ref] }))
  }

  const removePhoto = (id: string) => {
    void deleteBlob(id)
    setEntry((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.id !== id) }))
  }

  const handleAudioNote = (dataUrl: string) => {
    if (dataUrl.length > MAX_AUDIO_BYTES) {
      alert(
        'المقطع الصوتي طويل جدًا لحفظه محليًا. سجّل مقطعًا أقصر أو اكتفِ بالنص المكتوب.',
      )
      return
    }
    setEntry((prev) => ({ ...prev, audioNote: dataUrl }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!entry.placeName.trim()) {
      alert('من فضلك اكتب اسم المكان أولًا.')
      return
    }
    onSave({
      ...entry,
      slug: slugify(entry.slug) || entry.slug.trim(),
      updatedAt: Date.now(),
    })
  }

  const appendMeetingNote = (text: string) => {
    setEntry((prev) => ({
      ...prev,
      meetingNotes: prev.meetingNotes ? prev.meetingNotes + ' ' + text : text,
    }))
  }

  const shareUrl = placeShareUrl(entry.slug)
  const copyShareLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('انسخ الرابط:', shareUrl)
    }
  }

  // Unique section names in the form dropdown (dedupe display).
  const uniqueSections = (() => {
    const seen = new Set<string>()
    return sections.filter((s) => {
      const key = s.name.trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })()

  return (
    <form className="entry-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>القسم</span>
          <select
            value={entry.sectionId}
            onChange={(e) => update('sectionId', e.target.value)}
          >
            {uniqueSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>اسم المكان *</span>
          <input
            type="text"
            value={entry.placeName}
            onChange={(e) => update('placeName', e.target.value)}
            placeholder="مثال: مطعم النخيل"
          />
        </label>
      </div>

      <label className="field">
        <span>الشركة المقدَّم إليها التقرير</span>
        <select
          value={companyNewMode ? '__new__' : entry.targetCompany}
          onChange={(e) => {
            if (e.target.value === '__new__') {
              setCompanyNewMode(true)
              update('targetCompany', '')
            } else {
              setCompanyNewMode(false)
              update('targetCompany', e.target.value)
            }
          }}
        >
          <option value="">— اختر الشركة —</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="__new__">＋ شركة جديدة</option>
        </select>
        {companyNewMode && (
          <input
            type="text"
            className="mt-8"
            value={entry.targetCompany}
            onChange={(e) => update('targetCompany', e.target.value)}
            placeholder="اكتب اسم الشركة الجديدة"
            autoFocus
          />
        )}
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Slug (رابط المتابعة للشركة)</span>
          <input
            type="text"
            dir="ltr"
            value={entry.slug}
            onChange={(e) => update('slug', e.target.value)}
            onBlur={() => {
              const cleaned = slugify(entry.slug)
              if (cleaned && cleaned !== entry.slug) update('slug', cleaned)
            }}
            placeholder="example-place"
          />
        </label>
        <label className="field">
          <span>اسم المستخدم</span>
          <input
            type="text"
            dir="ltr"
            autoComplete="off"
            value={entry.placeUsername}
            onChange={(e) => update('placeUsername', e.target.value)}
            placeholder="username"
          />
        </label>
        <label className="field">
          <span>كلمة المرور</span>
          <input
            type="text"
            dir="ltr"
            autoComplete="off"
            value={entry.placePassword}
            onChange={(e) => update('placePassword', e.target.value)}
            placeholder="password"
          />
        </label>
      </div>

      {shareUrl && (
        <div className="slug-share">
          <span className="slug-share-label">رابط إرساله للشركة للمتابعة:</span>
          <code className="slug-share-url" dir="ltr">
            {shareUrl}
          </code>
          <button type="button" className="btn secondary small" onClick={() => void copyShareLink()}>
            {copied ? 'تم النسخ ✓' : 'نسخ الرابط'}
          </button>
        </div>
      )}

      <div className="field">
        <span>صورة مدخل المكان (يظهر عليها وقت وتاريخ التصوير)</span>
        <PhotoCapture photos={entry.photos} onAdd={addPhoto} onRemove={removePhoto} />
      </div>

      <div className="field">
        <span>الموقع على الخريطة</span>
        <InteractiveMap lat={entry.lat} lng={entry.lng} onChange={handleCoords} />
        {geoMsg && <p className="hint muted">{geoMsg}</p>}
      </div>

      <label className="field">
        <span>العنوان (يظهر تلقائيًا من الخريطة، ويمكن تعديله)</span>
        <input
          type="text"
          value={entry.address}
          onChange={(e) => update('address', e.target.value)}
          placeholder="العنوان النصي"
        />
      </label>

      <label className="field">
        <span>ملاحظات على العنوان (اختياري)</span>
        <textarea
          rows={2}
          value={entry.addressNotes}
          onChange={(e) => update('addressNotes', e.target.value)}
          placeholder="مثال: بجوار الصيدلية، الدور الثاني..."
        />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>اسم المدير</span>
          <input
            type="text"
            value={entry.managerName}
            onChange={(e) => update('managerName', e.target.value)}
          />
        </label>
        <label className="field">
          <span>رقم الجوال</span>
          <input
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={entry.managerPhone}
            onChange={(e) => update('managerPhone', e.target.value)}
            placeholder="05xxxxxxxx"
          />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>نوع النشاط</span>
          <select
            value={entry.activityType}
            onChange={(e) => update('activityType', e.target.value)}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {entry.activityType === 'أخرى' && (
          <label className="field">
            <span>اكتب نوع النشاط</span>
            <input
              type="text"
              value={entry.customActivity}
              onChange={(e) => update('customActivity', e.target.value)}
              placeholder="نشاط مختلف"
            />
          </label>
        )}
      </div>

      <div className="field">
        <span>هل قابلت المسؤول؟</span>
        <div className="radio-row">
          <label className={`radio-pill ${entry.met === 'yes' ? 'active' : ''}`}>
            <input
              type="radio"
              name="met"
              checked={entry.met === 'yes'}
              onChange={() => update('met', 'yes')}
            />
            نعم، قابلته
          </label>
          <label className={`radio-pill ${entry.met === 'no' ? 'active' : ''}`}>
            <input
              type="radio"
              name="met"
              checked={entry.met === 'no'}
              onChange={() => update('met', 'no')}
            />
            لا، لم أقابله
          </label>
        </div>
      </div>

      <div className="field">
        <span>تصنيف نتيجة الزيارة</span>
        <div className="radio-row deal-status-row">
          {DEAL_STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`radio-pill deal-${opt.value} ${entry.dealStatus === opt.value ? 'active' : ''}`}
            >
              <input
                type="radio"
                name="dealStatus"
                checked={entry.dealStatus === opt.value}
                onChange={() => update('dealStatus', opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {entry.dealStatus === 'rejected' && (
        <label className="field">
          <span>أسباب الرفض</span>
          <textarea
            rows={3}
            value={entry.rejectionReason}
            onChange={(e) => update('rejectionReason', e.target.value)}
            placeholder="اكتب أسباب رفض الفكرة..."
          />
        </label>
      )}

      {entry.met === 'yes' && (
        <div className="field">
          <span>ماذا حدث في المقابلة؟</span>
          <VoiceInput onAppendText={appendMeetingNote} onAudioNote={handleAudioNote} />
          <textarea
            rows={4}
            value={entry.meetingNotes}
            onChange={(e) => update('meetingNotes', e.target.value)}
            placeholder="اكتب ملخص المقابلة أو استخدم الأدوات الصوتية بالأعلى..."
          />
          {entry.audioNote && (
            <div className="audio-note">
              <audio controls src={entry.audioNote} />
              <button
                type="button"
                className="btn ghost small"
                onClick={() => update('audioNote', '')}
              >
                حذف المقطع الصوتي
              </button>
            </div>
          )}
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn primary">
          حفظ البيانات
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </form>
  )
}
