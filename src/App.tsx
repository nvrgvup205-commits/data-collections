import { useEffect, useState } from 'react'
import { useAuth } from './lib/auth'
import { parseCompanySlugFromHash } from './lib/companies'
import Login from './components/Login'
import ResearcherDashboard from './components/ResearcherDashboard'
import CompanyPortal from './components/CompanyPortal'
import CompanyPortalGate from './components/CompanyPortalGate'

export default function App() {
  const { user, logout } = useAuth()
  const [previewCompany, setPreviewCompany] = useState<string | null>(null)
  const [companySlug, setCompanySlug] = useState<string | null>(() =>
    typeof window !== 'undefined' ? parseCompanySlugFromHash(window.location.hash) : null,
  )

  useEffect(() => {
    const onHash = () => setCompanySlug(parseCompanySlugFromHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Company-specific portal links are public (their own interface + credentials).
  if (companySlug) {
    return <CompanyPortalGate slug={companySlug} />
  }

  if (!user) {
    return <Login />
  }

  if (user.role === 'company') {
    return (
      <CompanyPortal
        company={user.company || ''}
        title={user.name}
        onExit={() => void logout()}
        exitLabel="خروج"
      />
    )
  }

  if (previewCompany !== null) {
    return (
      <CompanyPortal
        company={previewCompany}
        title={previewCompany}
        onExit={() => setPreviewCompany(null)}
        exitLabel="→ رجوع للوحة الباحث"
      />
    )
  }

  return <ResearcherDashboard onPreviewCompany={(c) => setPreviewCompany(c)} />
}
