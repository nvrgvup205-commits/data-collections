import { useEffect, useState } from 'react'
import {
  companyShareUrl,
  getPortalSession,
  loadCompanyMeta,
  loginCompanyPortal,
  setPortalSession,
  type CompanyMeta,
} from '../lib/companies'
import CompanyPortal from './CompanyPortal'
import InstallAppButton from './InstallAppButton'

interface Props {
  slug: string
}

export default function CompanyPortalGate({ slug }: Props) {
  const [meta, setMeta] = useState<CompanyMeta | null>(null)
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const m = await loadCompanyMeta(slug)
      if (!active) return
      setMeta(m)
      const session = getPortalSession()
      if (session && session.slug === slug) setAuthed(true)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [slug])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const m = await loginCompanyPortal(slug, username, password)
      setMeta(m)
      setAuthed(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const logout = () => {
    setPortalSession(null)
    setAuthed(false)
    setUsername('')
    setPassword('')
  }

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <p className="empty-title">جارٍ فتح بوابة الشركة...</p>
        </div>
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            <span className="brand-mark">◈</span>
            <h1>بوابة غير موجودة</h1>
            <p>تأكد من رابط الشركة أو اطلب من الباحث إنشاء البوابة.</p>
          </div>
          <code className="slug-share-url" dir="ltr">
            {companyShareUrl(slug)}
          </code>
        </div>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            <span className="brand-mark">◈</span>
            <h1>{meta.name}</h1>
            <p>بوابة التقارير الميدانية الخاصة بالشركة</p>
          </div>
          <form onSubmit={submit} className="login-form">
            <label className="field">
              <span>اسم المستخدم</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="field">
              <span>كلمة المرور</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error && <p className="hint error">{error}</p>}
            <button type="submit" className="btn primary login-btn" disabled={busy}>
              {busy ? 'جارٍ الدخول...' : 'دخول إلى البوابة'}
            </button>
          </form>
          <div className="login-install">
            <InstallAppButton compact />
          </div>
        </div>
      </div>
    )
  }

  return (
    <CompanyPortal
      company={meta.name}
      title={meta.name}
      onExit={logout}
      exitLabel="خروج"
      publicMode
      portalSlug={meta.slug}
    />
  )
}
