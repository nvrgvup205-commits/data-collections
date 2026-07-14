import { useState } from 'react'
import { useAuth } from './lib/auth'
import Login from './components/Login'
import ResearcherDashboard from './components/ResearcherDashboard'
import CompanyPortal from './components/CompanyPortal'

export default function App() {
  const { user, logout } = useAuth()
  const [previewCompany, setPreviewCompany] = useState<string | null>(null)

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

  // Researcher: full dashboard, with optional company-portal preview.
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
