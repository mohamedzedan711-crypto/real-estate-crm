import { Sun, Moon, Globe, Menu, Bell } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useLang } from '../../contexts/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'

export default function Header({ onMenuClick, title }) {
  const { isDark, toggleTheme } = useTheme()
  const { lang, toggleLang } = useLang()
  const { profile } = useAuth()

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6
                       bg-white dark:bg-navy-900 border-b border-gray-100 dark:border-navy-800
                       shadow-sm sticky top-0 z-30">
      {/* Left: hamburger + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-500 dark:text-navy-300"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h1>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                     bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-navy-300
                     hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors"
          title="Toggle language"
        >
          <Globe size={14} />
          <span>{lang === 'ar' ? 'EN' : 'عر'}</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-navy-300
                     hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors"
          title="Toggle theme"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Avatar */}
        <div className="flex items-center justify-center w-8 h-8 rounded-full
                        bg-gradient-to-br from-gold-500 to-gold-700 text-white text-xs font-bold">
          {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
      </div>
    </header>
  )
}
