import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type PlatformTab = 'android' | 'ios'

interface Props {
  /** header = زر واحد صغير | footer = صف كامل في أسفل الصفحة */
  placement?: 'header' | 'footer'
}

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export default function InstallAppButton({ placement = 'header' }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<PlatformTab>(isIOSDevice() ? 'ios' : 'android')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    const onInstallable = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
      setOpen(false)
    }
    window.addEventListener('beforeinstallprompt', onInstallable)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (installed) return null

  const openTab = (platform: PlatformTab) => {
    setTab(platform)
    setOpen(true)
  }

  const installAndroid = async () => {
    if (!deferred) return
    setInstalling(true)
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        setInstalled(true)
        setOpen(false)
      }
      setDeferred(null)
    } finally {
      setInstalling(false)
    }
  }

  const modal =
    open &&
    createPortal(
      <div className="modal-backdrop install-app-backdrop" onClick={() => setOpen(false)}>
        <div
          className="modal install-app-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-app-title"
        >
          <div className="modal-head install-app-modal-head">
            <div className="install-app-brand">
              <img src="/pwa/icon-192.png" alt="تقارير" className="install-app-logo" />
              <div>
                <h2 id="install-app-title">تطبيق تقارير</h2>
                <p className="muted">ثبّت التطبيق على جوالك للوصول السريع والتحديث اللحظي</p>
              </div>
            </div>
            <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
              إغلاق ✕
            </button>
          </div>

          <div className="install-tabs">
            <button
              type="button"
              className={`install-tab ${tab === 'android' ? 'active' : ''}`}
              onClick={() => setTab('android')}
            >
              أندرويد
            </button>
            <button
              type="button"
              className={`install-tab ${tab === 'ios' ? 'active' : ''}`}
              onClick={() => setTab('ios')}
            >
              آيفون (iOS)
            </button>
          </div>

          {tab === 'android' ? (
            <div className="install-steps">
              <h3>طريقة التثبيت على أندرويد</h3>
              <ol>
                <li>افتح الموقع في متصفح <strong>Chrome</strong>.</li>
                <li>اضغط زر القائمة <strong>⋮</strong> أعلى الشاشة.</li>
                <li>
                  اختر <strong>«تثبيت التطبيق»</strong> أو{' '}
                  <strong>«إضافة إلى الشاشة الرئيسية»</strong>.
                </li>
                <li>
                  اضغط <strong>«تثبيت»</strong> — ستظهر أيقونة <strong>تقارير</strong>.
                </li>
              </ol>
              {deferred ? (
                <button
                  type="button"
                  className="btn primary install-now-btn"
                  disabled={installing}
                  onClick={() => void installAndroid()}
                >
                  {installing ? 'جارٍ التثبيت...' : 'تثبيت الآن على أندرويد'}
                </button>
              ) : (
                <p className="hint muted">
                  إذا لم يظهر زر التثبيت التلقائي، اتبع الخطوات أعلاه يدويًا من قائمة Chrome.
                </p>
              )}
            </div>
          ) : (
            <div className="install-steps">
              <h3>طريقة التثبيت على آيفون</h3>
              <ol>
                <li>افتح الموقع في متصفح <strong>Safari</strong> (مهم: ليس Chrome).</li>
                <li>اضغط زر <strong>المشاركة</strong> (المربع والسهم للأعلى).</li>
                <li>اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong>.</li>
                <li>
                  تأكد أن الاسم <strong>«تقارير»</strong> ثم اضغط <strong>«إضافة»</strong>.
                </li>
              </ol>
              <p className="hint muted">على iOS يجب اتباع الخطوات من Safari فقط.</p>
            </div>
          )}
        </div>
      </div>,
      document.body,
    )

  if (placement === 'footer') {
    return (
      <>
        <div className="install-app-footer">
          <span className="install-app-footer-label">ثبّت تطبيق تقارير على جوالك:</span>
          <div className="install-app-actions">
            <button type="button" className="btn install-platform ios" onClick={() => openTab('ios')}>
              <img src="/pwa/apple-touch-icon.png" alt="" width={20} height={20} />
              تحميل للآيفون
            </button>
            <button
              type="button"
              className="btn install-platform android"
              onClick={() => openTab('android')}
            >
              <img src="/pwa/icon-192.png" alt="" width={20} height={20} />
              تحميل للأندرويد
            </button>
          </div>
        </div>
        {modal}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        className="btn install-app-trigger"
        onClick={() => setOpen(true)}
        title="تثبيت تطبيق تقارير"
      >
        <img src="/pwa/icon-192.png" alt="" width={18} height={18} />
        <span>تطبيق</span>
      </button>
      {modal}
    </>
  )
}
