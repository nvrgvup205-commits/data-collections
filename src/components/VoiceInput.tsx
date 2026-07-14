import { useEffect, useRef, useState } from 'react'
import {
  getSpeechRecognition,
  isSpeechSupported,
  SpeechRecognitionLike,
} from '../lib/speech'

interface Props {
  onAppendText: (text: string) => void
}

export default function VoiceInput({ onAppendText }: Props) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const supported = isSpeechSupported()

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  const start = () => {
    setError('')
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setError('التسجيل الصوتي غير مدعوم في هذا المتصفح.')
      return
    }
    const recognition = new Ctor()
    recognition.lang = 'ar-EG'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event) => {
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        }
      }
      if (finalText.trim()) {
        onAppendText(finalText.trim())
      }
    }
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') {
        setError('تم رفض إذن الميكروفون.')
      } else if (e.error !== 'aborted') {
        setError('تعذر التسجيل: ' + e.error)
      }
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const stop = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  if (!supported) {
    return (
      <p className="hint muted">
        التسجيل الصوتي يعمل على متصفح Chrome أو Edge. يمكنك الكتابة يدويًا.
      </p>
    )
  }

  return (
    <div className="voice-input">
      <button
        type="button"
        className={`mic-btn ${listening ? 'recording' : ''}`}
        onClick={listening ? stop : start}
      >
        <span className="mic-dot" />
        {listening ? 'إيقاف التسجيل' : 'تسجيل صوتي وتحويله لنص'}
      </button>
      {listening && <span className="hint muted">جارٍ الاستماع... تحدّث الآن</span>}
      {error && <span className="hint error">{error}</span>}
    </div>
  )
}
