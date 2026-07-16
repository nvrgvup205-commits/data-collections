import { useEffect, useRef, useState } from 'react'
import {
  getSpeechRecognition,
  isSpeechSupported,
  SpeechRecognitionLike,
} from '../lib/speech'

interface Props {
  onAppendText: (text: string) => void
  onAudioNote: (dataUrl: string) => void
}

function supportedAudioMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ]
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export default function VoiceInput({ onAppendText, onAudioNote }: Props) {
  const [listening, setListening] = useState(false)
  const [speechMsg, setSpeechMsg] = useState('')
  const [interim, setInterim] = useState('')
  const [recording, setRecording] = useState(false)
  const [recMsg, setRecMsg] = useState('')

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const listeningRef = useRef(false)
  const retriesRef = useRef(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const speechSupported = isSpeechSupported()

  useEffect(() => {
    return () => {
      listeningRef.current = false
      recognitionRef.current?.abort()
      mediaRecorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // ---- Speech to text (Chrome / Edge) — optional helper ----
  const buildRecognition = () => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) return null
    const recognition = new Ctor()
    recognition.lang = 'ar-EG'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      if (finalText.trim()) {
        onAppendText(finalText.trim())
        retriesRef.current = 0
      }
      setInterim(interimText)
    }
    recognition.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'network' && retriesRef.current < 2 && listeningRef.current) {
        retriesRef.current += 1
        return
      }
      if (e.error === 'not-allowed') {
        setSpeechMsg('تم رفض إذن الميكروفون. فعّله من إعدادات المتصفح.')
      } else if (e.error === 'network') {
        setSpeechMsg('خدمة تحويل الصوت لنص غير متاحة. استخدم تسجيل المقطع الصوتي بالأعلى.')
      } else {
        setSpeechMsg('تعذّر التعرف على الصوت: ' + e.error)
      }
      listeningRef.current = false
      setListening(false)
    }
    recognition.onend = () => {
      setInterim('')
      if (listeningRef.current) {
        try {
          recognition.start()
        } catch {
          /* ignore */
        }
      } else {
        setListening(false)
      }
    }
    return recognition
  }

  const startSpeech = () => {
    setSpeechMsg('')
    setInterim('')
    retriesRef.current = 0
    const recognition = buildRecognition()
    if (!recognition) {
      setSpeechMsg('تحويل الصوت لنص غير مدعوم في هذا المتصفح.')
      return
    }
    recognitionRef.current = recognition
    listeningRef.current = true
    setListening(true)
    try {
      recognition.start()
    } catch {
      /* ignore */
    }
  }

  const stopSpeech = () => {
    listeningRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
    setInterim('')
  }

  // ---- Audio recording (primary — synced to company portal) ----
  const startRecording = async () => {
    setRecMsg('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecMsg('تسجيل الصوت غير مدعوم في هذا المتصفح.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = supportedAudioMime()
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || mime || 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (!blob.size) {
          setRecMsg('لم يُسجَّل صوت. جرّب مرة أخرى.')
          return
        }
        const reader = new FileReader()
        reader.onloadend = () => onAudioNote(reader.result as string)
        reader.readAsDataURL(blob)
        setRecMsg('تم حفظ المقطع — سيظهر في بوابة الشركة بعد الحفظ.')
      }
      mediaRecorderRef.current = mr
      mr.start(1000)
      setRecording(true)
      setRecMsg('جارٍ التسجيل... تحدّث الآن ثم اضغط إيقاف.')
    } catch {
      setRecMsg('تم رفض إذن الميكروفون أو تعذّر بدء التسجيل.')
    }
  }

  const stopRecording = () => {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    setRecording(false)
  }

  return (
    <div className="voice-tools">
      <div className="voice-input voice-input-primary">
        <button
          type="button"
          className={`mic-btn alt ${recording ? 'recording' : ''}`}
          onClick={recording ? stopRecording : startRecording}
        >
          <span className="mic-dot" />
          {recording ? 'إيقاف التسجيل' : '🎙️ تسجيل مقطع صوتي'}
        </button>
        {recMsg && <span className="hint muted">{recMsg}</span>}
        <p className="hint muted voice-hint">
          يُرفع المقطع مع التقرير ويستمع إليه فريق الشركة مباشرة من البوابة.
        </p>
      </div>

      {speechSupported ? (
        <details className="voice-stt-details">
          <summary>تحويل الكلام إلى نص (اختياري)</summary>
          <div className="voice-input">
            <button
              type="button"
              className={`mic-btn ${listening ? 'recording' : ''}`}
              onClick={listening ? stopSpeech : startSpeech}
            >
              <span className="mic-dot" />
              {listening ? 'إيقاف التحويل لنص' : 'تحويل الكلام إلى نص'}
            </button>
            {listening && <span className="hint muted">جارٍ الاستماع... {interim}</span>}
            {speechMsg && <span className="hint error">{speechMsg}</span>}
          </div>
        </details>
      ) : null}
    </div>
  )
}
