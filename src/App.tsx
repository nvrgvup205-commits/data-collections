import { useEffect, useState } from 'react'
import { useAuth } from './lib/auth'
import { parsePlaceSlugFromHash } from './lib/phone'
import Login from './components/Login'
import ResearcherDashboard from './components/ResearcherDashboard'
import CompanyPortal from './components/CompanyPortal'

export default function App() {
  const { user, logout } = useAuth()
  const [previewCompany, setPreviewCompany] = useState<string | null>(null)
  const [trackSlug, setTrackSlug] = useState<string | null>(() =>
    typeof window !== 'undefined' ? parsePlaceSlugFromHash(window.location.hash) : null,
  )

  useEffect(() => {
    const onHash = () => setTrackSlug(parsePlaceSlugFromHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
        highlightSlug={trackSlug}
      />
    )
  }

  // Researcher: full dashboard, with optional company-portal preview.
  if (previewCompany !== null) {
    return (
      <CompanyPortal
        company={previewCompany}
        title={previewCompany}
        onExit={() => setPreviewCompany(null)}
        exitLabel="→ رجوع للوحة الباحث"
        highlightSlug={trackSlug}
      />
    )
  }

  return (
    <ResearcherDashboard
      onPreviewCompany={(c) => setPreviewCompany(c)}
      highlightSlug={trackSlug}
    />
  )
}
