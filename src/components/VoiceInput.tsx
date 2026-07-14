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

  const speechSupported = isSpeechSupported()

  useEffect(() => {
    return () => {
      listeningRef.current = false
      recognitionRef.current?.abort()
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // ---- Speech to text (Chrome / Edge) ----
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
        setSpeechMsg(
          'خدمة تحويل الصوت لنص محجوبة في هذا المتصفح (مثل Brave). استخدم Chrome/Edge، أو سجّل مقطعًا صوتيًا بالأسفل.',
        )
      } else {
        setSpeechMsg('تعذّر التعرف على الصوت: ' + e.error)
      }
      listeningRef.current = false
      setListening(false)
    }
    recognition.onend = () => {
      setInterim('')
      // continuous=false stops after each phrase; restart while still active.
      if (listeningRef.current) {
        try {
          recognition.start()
        } catch {
          /* start() can throw if called too quickly; ignore */
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

  // ---- Audio recording (works in all browsers, incl. Brave) ----
  const startRecording = async () => {
    setRecMsg('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecMsg('تسجيل الصوت غير مدعوم في هذا المتصفح.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        const reader = new FileReader()
        reader.onloadend = () => onAudioNote(reader.result as string)
        reader.readAsDataURL(blob)
      }
      mediaRecorderRef.current = mr
      mr.start()
      setRecording(true)
      setRecMsg('جارٍ التسجيل... تحدّث الآن ثم اضغط إيقاف.')
    } catch {
      setRecMsg('تم رفض إذن الميكروفون أو تعذّر بدء التسجيل.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    setRecMsg('تم حفظ المقطع الصوتي مع بيانات المكان.')
  }

  return (
    <div className="voice-tools">
      {speechSupported ? (
        <div className="voice-input">
          <button
            type="button"
            className={`mic-btn ${listening ? 'recording' : ''}`}
            onClick={listening ? stopSpeech : startSpeech}
          >
            <span className="mic-dot" />
            {listening ? 'إيقاف التحويل لنص' : 'تحويل الكلام إلى نص'}
          </button>
          {listening && (
            <span className="hint muted">جارٍ الاستماع... {interim}</span>
          )}
          {speechMsg && <span className="hint error">{speechMsg}</span>}
        </div>
      ) : (
        <p className="hint muted">
          تحويل الكلام لنص يعمل على Chrome / Edge. استخدم تسجيل المقطع الصوتي بالأسفل على أي متصفح.
        </p>
      )}

      <div className="voice-input">
        <button
          type="button"
          className={`mic-btn alt ${recording ? 'recording' : ''}`}
          onClick={recording ? stopRecording : startRecording}
        >
          <span className="mic-dot" />
          {recording ? 'إيقاف تسجيل المقطع' : '🎙️ تسجيل مقطع صوتي'}
        </button>
        {recMsg && <span className="hint muted">{recMsg}</span>}
      </div>
    </div>
  )
}
