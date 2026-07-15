import { useState } from 'react'
import { useAuth } from '../lib/auth'

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

  const fillDemo = (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
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
            />
          </label>
          <label className="field">
            <span>كلمة المرور</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              autoComplete="current-password"
            />
          </label>

          {error && <p className="hint error">{error}</p>}

          <button type="submit" className="btn primary login-btn" disabled={loading}>
            {loading ? 'جارٍ الدخول...' : 'دخول'}
          </button>
        </form>

        <div className="login-demo">
          <p className="muted">حسابات الدخول (اضغط للتعبئة):</p>
          <div className="demo-chips">
            <button className="chip" onClick={() => fillDemo('1111', '111111')}>
              باحث — 1111 / 111111
            </button>
            <button className="chip" onClick={() => fillDemo('2222', '222222')}>
              سعودي تريند — 2222 / 222222
            </button>
            <button className="chip" onClick={() => fillDemo('3333', '333333')}>
              نخبة التسويق — 3333 / 333333
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
