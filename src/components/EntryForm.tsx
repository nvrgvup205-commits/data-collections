import { useEffect, useRef, useState } from 'react'
import { ACTIVITY_TYPES, Entry, Section } from '../types'
import { reverseGeocode } from '../lib/geo'
import { uid } from '../storage'
import InteractiveMap from './InteractiveMap'
import VoiceInput from './VoiceInput'

interface Props {
  sections: Section[]
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
    audioNote: '',
    targetCompany: '',
    createdAt: now,
    updatedAt: now,
  }
}

export default function EntryForm({
  sections,
  initial,
  defaultSectionId,
  onSave,
  onCancel,
}: Props) {
  const [entry, setEntry] = useState<Entry>(
    initial ?? blankEntry(defaultSectionId),
  )
  const [geoMsg, setGeoMsg] = useState('')
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
    onSave({ ...entry, updatedAt: Date.now() })
  }

  const appendMeetingNote = (text: string) => {
    setEntry((prev) => ({
      ...prev,
      meetingNotes: prev.meetingNotes ? prev.meetingNotes + ' ' + text : text,
    }))
  }

  return (
    <form className="entry-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>القسم</span>
          <select
            value={entry.sectionId}
            onChange={(e) => update('sectionId', e.target.value)}
          >
            {sections.map((s) => (
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
