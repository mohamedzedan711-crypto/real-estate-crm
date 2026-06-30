import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, GitBranch, MessageSquare, Bot,
  BarChart3, Settings, LogOut, Building2, ChevronRight,
  Megaphone, Calculator
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LanguageContext'
import { ALL_PAGES, getEffectivePageKeys } from '../../lib/pages'

// Icon lookup — keyed by page key
const PAGE_ICONS = {
  dashboard:  LayoutDashboard,
  leads:      Users,
  pipeline:   GitBranch,
  whatsapp:   MessageSquare,
  aiChat:     Bot,
  marketing:  Megaphone,
  accountant: Calculator,
  reports:    BarChart3,
  settings:   Settings,
}

export default function Sidebar({ onClose }) {
  const { profile, logout } = useAuth()
  const { t, isRTL } = useLang()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Admin bypasses page_access; others get their effective page list
  const effectiveKeys = getEffectivePageKeys(profile)

  const visibleItems = ALL_PAGES.filter(page => effectiveKeys.includes(page.key))

  return (
    <aside className="flex flex-col h-full bg-navy-900 dark:bg-navy-950 border-e border-navy-800">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-navy-800">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500 to-gold-700 shadow-lg">
          <Building2 size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight truncate">{t('appName')}</p>
          <p className="text-xs text-navy-400 truncate">{t(`roles.${profile?.role || 'agent'}`)}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(({ key, path }) => {
          const Icon = PAGE_ICONS[key] || LayoutDashboard
          return (
            <NavLink
              key={key}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-gold-500/20 to-gold-600/10 text-gold-400 border border-gold-500/30'
                    : 'text-navy-300 hover:text-white hover:bg-navy-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-gold-400' : 'text-navy-400 group-hover:text-white'} />
                  <span className="flex-1">{t(`nav.${key}`)}</span>
                  {isActive && (
                    <ChevronRight size={14} className={`text-gold-400 ${isRTL ? 'rotate-180' : ''}`} />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-navy-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 text-white text-xs font-bold shrink-0">
            {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{profile?.full_name || '—'}</p>
            <p className="text-xs text-navy-400 truncate">{profile?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-navy-300 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={16} />
          <span>{t('logout')}</span>
        </button>
      </div>
    </aside>
  )
}
