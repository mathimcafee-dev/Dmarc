import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { OrgProvider } from './hooks/useOrg'
import { ToastProvider } from './components/ui/Toast'
import { AppSidebar } from './components/layout/AppSidebar'
import { AppHeader } from './components/layout/AppHeader'
import { LoginPage, SignupPage } from './pages/AuthPages'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { DomainsPage } from './pages/DomainsPage'
import { DomainDetailPage } from './pages/DomainDetailPage'
import { DMARCPage } from './pages/DMARCPage'
import { ReportsPage } from './pages/ReportsPage'
import { SPFPage } from './pages/SPFPage'
import { DKIMPage, BIMIPage } from './pages/SecondaryPages'
import { TimelinePage } from './pages/TimelinePage'
import { AlertsPage } from './pages/AlertsPage'
import { ActivityPage } from './pages/ActivityPage'
import { MembersPage } from './pages/MembersPage'
import { SettingsPage } from './pages/SettingsPage'
import { SVGConverterPage } from './pages/SVGConverterPage'
import './index.css'

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--neutral-50)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--brand-100)', borderTop: '3px solid var(--brand-500)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Loading DNSMonitor…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

function ProtectedLayout() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return (
    <OrgProvider>
      <div className="app-shell">
        <AppSidebar />
        <main className="app-main">
          <AppHeader />
          <Outlet />
        </main>
      </div>
    </OrgProvider>
  )
}

function OnboardingGuard() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <OrgProvider><OnboardingPage /></OrgProvider>
}

function PublicRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public — redirects to dashboard if already logged in */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>

            {/* Onboarding */}
            <Route path="/onboarding" element={<OnboardingGuard />} />

            {/* Protected app */}
            <Route element={<ProtectedLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/domains" element={<DomainsPage />} />
              <Route path="/domains/:id" element={<DomainDetailPage />} />
              <Route path="/dmarc" element={<DMARCPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/spf" element={<SPFPage />} />
              <Route path="/dkim" element={<DKIMPage />} />
              <Route path="/bimi" element={<BIMIPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/svg-converter" element={<SVGConverterPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
