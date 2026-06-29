import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useLang } from '../../contexts/LanguageContext'

// Map route paths to i18n nav keys
const PAGE_TITLES = {
  '/dashboard': 'nav.dashboard',
  '/leads':     'nav.leads',
  '/pipeline':  'nav.pipeline',
  '/whatsapp':  'nav.whatsapp',
  '/ai-chat':   'nav.aiChat',
  '/reports':   'nav.reports',
  '/settings':  'nav.settings',
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { t } = useLang()
  const { pathname } = useLocation()

  const pageTitle = t(PAGE_TITLES[pathname] || 'appName')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-navy-950">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 w-64 flex flex-col">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} title={pageTitle} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
