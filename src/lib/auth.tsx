/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase, isSupabaseEnabled } from './supabase'

export type Role = 'researcher' | 'company'

export interface AuthUser {
  username: string
  name: string
  role: Role
  company?: string // for company accounts: the company name whose reports they see
}

interface DemoAccount extends AuthUser {
  password: string
}

// Built-in demo accounts (used when Supabase is not configured).
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: '1111', password: '1111', name: 'باحث ميداني', role: 'researcher' },
  {
    username: '2222',
    password: '2222',
    name: 'شركة نخبة التسويق',
    role: 'company',
    company: 'شركة نخبة التسويق',
  },
]

const SESSION_KEY = 'field-research-session'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

function readSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readSession())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    else localStorage.removeItem(SESSION_KEY)
  }, [user])

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true)
    try {
      const uname = username.trim()

      if (isSupabaseEnabled && supabase) {
        // Supabase auth: treat the username as an email (append a domain if needed).
        const email = uname.includes('@') ? uname : `${uname}@demo.local`
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw new Error('بيانات الدخول غير صحيحة')
        // Role + company come from a `profiles` row (see supabase/schema.sql).
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, company_name, full_name')
          .eq('id', data.user.id)
          .single()
        setUser({
          username: uname,
          name: profile?.full_name || uname,
          role: (profile?.role as Role) || 'researcher',
          company: profile?.company_name || undefined,
        })
        return
      }

      // Demo mode
      const match = DEMO_ACCOUNTS.find(
        (a) => a.username === uname && a.password === password,
      )
      if (!match) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة')
      const { password: _pw, ...safe } = match
      void _pw
      setUser(safe)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    if (isSupabaseEnabled && supabase) {
      await supabase.auth.signOut().catch(() => undefined)
    }
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
