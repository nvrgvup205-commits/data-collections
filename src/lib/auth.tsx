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

// Built-in demo accounts. Passwords are 6+ chars to match Supabase Auth
// policy; same values are used in the login chips and in supabase/schema.sql.
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: '1111',
    password: '111111',
    name: 'باحث ميداني',
    role: 'researcher',
  },
  {
    username: '2222',
    password: '222222',
    name: 'سعودي تريند',
    role: 'company',
    company: 'سعودي تريند',
  },
  {
    username: '3333',
    password: '333333',
    name: 'شركة نخبة التسويق',
    role: 'company',
    company: 'شركة نخبة التسويق',
  },
]

/** If the user swapped username/password for a known demo account, fix it. */
export function normalizeDemoCredentials(
  username: string,
  password: string,
): { username: string; password: string } {
  const uname = username.trim()
  const swapped = DEMO_ACCOUNTS.find(
    (a) => a.password === uname && a.username === password,
  )
  if (swapped) return { username: swapped.username, password: swapped.password }
  return { username: uname, password }
}

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
      // Common mix-up on this form: typing the password into "اسم المستخدم"
      // and the short username into "كلمة المرور". Auto-correct for demos.
      const fixed = normalizeDemoCredentials(username, password)
      const uname = fixed.username
      const pwd = fixed.password

      if (isSupabaseEnabled && supabase) {
        // Supabase auth: treat the username as an email (append a domain if needed).
        const email = uname.includes('@') ? uname : `${uname}@example.com`
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pwd,
        })
        if (error) throw new Error('بيانات الدخول غير صحيحة')
        // Role + company come from a `profiles` row (see supabase/schema.sql).
        const { data: profile } = await supabase
          .from('fr_profiles')
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
        (a) => a.username === uname && a.password === pwd,
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
