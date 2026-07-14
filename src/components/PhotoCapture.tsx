import { useRef, useState } from 'react'
import { PhotoRef } from '../types'
import { processPhoto } from '../lib/image'
import { putBlob } from '../lib/media'
import { uid } from '../storage'
import MediaImage from './MediaImage'

interface Props {
  photos: PhotoRef[]
  onAdd: (ref: PhotoRef) => void
  onRemove: (id: string) => void
}

export default function PhotoCapture({ photos, onAdd, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const pick = () => inputRef.current?.click()

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setBusy(true)
    setMsg('جارٍ معالجة الصورة وإضافة الوقت والتاريخ...')
    try {
      for (const file of files) {
        const { blob, capturedAt } = await processPhoto(file)
        const id = uid()
        await putBlob(id, blob)
        onAdd({ id, capturedAt })
      }
      setMsg('تمت إضافة الصورة مع ختم الوقت والتاريخ.')
    } catch (err) {
      setMsg((err as Error).message || 'تعذّر إضافة الصورة.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="photo-capture">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={onFiles}
      />
      <button
        type="button"
        className="btn secondary small"
        onClick={pick}
        disabled={busy}
      >
        {busy ? 'جارٍ المعالجة...' : '📷 تصوير مدخل المكان'}
      </button>
      {msg && <span className="hint muted">{msg}</span>}

      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p) => (
            <div className="photo-item" key={p.id}>
              <MediaImage id={p.id} alt="صورة المدخل" />
              <button
                type="button"
                className="photo-remove"
                title="حذف الصورة"
                onClick={() => onRemove(p.id)}
              >
                ✕
              </button>
              <span className="photo-time" dir="ltr">
                {new Date(p.capturedAt).toLocaleString('ar-EG')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
