import { useLocation } from 'react-router-dom'
import { Bell, Search, RefreshCw } from 'lucide-react'
import { useOrg } from '../../hooks/useOrg'

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', desc: 'Overview of your DNS health' },
  '/domains': { title: 'Domains', desc: 'Manage and monitor your domains' },
  '/tools':    { title: 'Free Tools', desc: 'DMARC, SPF, DKIM & MX lookup — no login required' },
  '/dmarc': { title: 'DMARC', desc: 'DMARC policy management & lookup' },
  '/reports': { title: 'DMARC Reports', desc: 'Aggregate report (RUA) analysis' },
  '/spf': { title: 'SPF Records', desc: 'Sender Policy Framework' },
  '/dkim': { title: 'DKIM Records', desc: 'DomainKeys Identified Mail' },
  '/bimi': { title: 'BIMI', desc: 'Brand Indicators for Message Identification' },
  '/timeline': { title: 'DNS Timeline', desc: 'Track record changes over time' },
  '/alerts': { title: 'Alerts', desc: 'Email notification rules' },
  '/members': { title: 'Members', desc: 'Team & organisation management' },
  '/settings': { title: 'Settings', desc: 'Organisation preferences' },
}

export function AppHeader() {
  const { pathname } = useLocation()
  const { currentOrg } = useOrg()
  const page = PAGE_TITLES[pathname] || { title: 'DNSMonitor', desc: '' }

  return (
    <header className="app-header">
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: '1rem', margin: 0, color: 'var(--neutral-900)' }}>{page.title}</h2>
        {page.desc && <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: 0 }}>{page.desc}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Search placeholder */}
        <button className="btn btn-secondary btn-sm" style={{ gap: '0.5rem' }}>
          <Search size={14} />
          <span style={{ color: 'var(--neutral-400)' }}>Search domains…</span>
          <kbd style={{ fontSize: '0.6875rem', background: 'var(--neutral-100)', border: '1px solid var(--neutral-200)', padding: '1px 5px', borderRadius: 4, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>⌘K</kbd>
        </button>

        <button className="btn btn-ghost btn-sm" title="Refresh" style={{ padding: '0.375rem' }}>
          <RefreshCw size={15} />
        </button>

        <button className="btn btn-ghost btn-sm" title="Notifications" style={{ padding: '0.375rem', position: 'relative' }}>
          <Bell size={15} />
          <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, background: 'var(--brand-500)', borderRadius: '50%', border: '1.5px solid var(--neutral-0)' }} />
        </button>

        {currentOrg && (
          <div style={{ height: 20, width: 1, background: 'var(--neutral-150)', margin: '0 0.25rem' }} />
        )}
        {currentOrg && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--neutral-500)' }}>
            <span style={{ color: 'var(--neutral-700)', fontWeight: 500 }}>{currentOrg.name}</span>
          </div>
        )}
      </div>
    </header>
  )
}
