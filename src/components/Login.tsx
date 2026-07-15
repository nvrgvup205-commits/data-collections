import { useState } from 'react'
import { DEMO_ACCOUNTS, useAuth } from '../lib/auth'

export default function Login() {
  const { login, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const loginAsDemo = async (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
    setError('')
    try {
      await login(u, p)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">◈</span>
          <h1>الأبحاث الميدانية</h1>
          <p>سجّل الدخول للمتابعة إلى لوحتك</p>
        </div>

        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>اسم المستخدم</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: 1111"
              autoComplete="username"
              inputMode="numeric"
              dir="ltr"
            />
          </label>
          <label className="field">
            <span>كلمة المرور</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
              inputMode="numeric"
              dir="ltr"
            />
          </label>

          {error && <p className="hint error">{error}</p>}

          <button type="submit" className="btn primary login-btn" disabled={loading}>
            {loading ? 'جارٍ الدخول...' : 'دخول'}
          </button>
        </form>

        <div className="login-demo">
          <p className="muted">حسابات الدخول (اضغط للدخول مباشرة):</p>
          <div className="demo-chips">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.username}
                type="button"
                className="chip"
                disabled={loading}
                onClick={() => void loginAsDemo(account.username, account.password)}
              >
                <span className="chip-title">
                  {account.role === 'researcher' ? 'باحث' : account.name.replace(/^شركة\s+/, '')}
                </span>
                <span className="chip-creds" dir="ltr">
                  <span>مستخدم: {account.username}</span>
                  <span>مرور: {account.password}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
