import { useEffect, useState } from 'react'
import { useAuth } from './lib/auth'
import { parseCompanySlugFromLocation, findCompanyByName } from './lib/companies'
import Login from './components/Login'
import ResearcherDashboard from './components/ResearcherDashboard'
import CompanyPortal from './components/CompanyPortal'
import CompanyPortalGate from './components/CompanyPortalGate'

export default function App() {
  const { user, logout } = useAuth()
  const [previewCompany, setPreviewCompany] = useState<string | null>(null)
  const [companySlug, setCompanySlug] = useState<string | null>(() =>
    typeof window !== 'undefined' ? parseCompanySlugFromLocation(window.location) : null,
  )

  useEffect(() => {
    const sync = () => setCompanySlug(parseCompanySlugFromLocation(window.location))
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  // Company-specific portal links are public (their own interface + credentials).
  if (companySlug) {
    return <CompanyPortalGate slug={companySlug} />
  }

  if (!user) {
    return <Login />
  }

  if (user.role === 'company') {
    const portalMeta = findCompanyByName(user.company || '')
    const installProfile = portalMeta
      ? ({ kind: 'company', slug: portalMeta.slug, name: portalMeta.name } as const)
      : ({ kind: 'researcher' } as const)
    return (
      <CompanyPortal
        company={user.company || ''}
        title={user.name}
        onExit={() => void logout()}
        exitLabel="خروج"
        portalSlug={portalMeta?.slug}
        installProfile={installProfile}
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
