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

          <button type="submit" className="btn primary login-btn" disabled={loading}>
            {loading ? 'جارٍ الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
