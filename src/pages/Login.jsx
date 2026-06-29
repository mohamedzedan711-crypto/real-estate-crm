import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Eye, EyeOff, Globe, Sun, Moon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const { t, lang, toggleLang, isRTL } = useLang()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) return

    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      toast.error(t('invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-4"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Top-right controls */}
      <div className={`fixed top-4 ${isRTL ? 'left-4' : 'right-4'} flex items-center gap-2`}>
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                     bg-navy-800 text-navy-300 hover:bg-navy-700 transition-colors border border-navy-700"
        >
          <Globe size={14} />
          {lang === 'ar' ? 'EN' : 'عر'}
        </button>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-navy-800 text-navy-300 hover:bg-navy-700 transition-colors border border-navy-700"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-navy-800/50 overflow-hidden">
          {/* Header stripe */}
          <div className="bg-gradient-to-r from-navy-900 to-navy-800 px-8 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-700 shadow-xl mb-4">
              <Building2 size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{t('loginWelcome')}</h1>
            <p className="text-navy-400 text-sm mt-1">{t('loginSubtitle')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-navy-300 mb-1.5">
                {t('email')}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                placeholder="admin@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700
                           bg-gray-50 dark:bg-navy-800 text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-navy-500
                           focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent
                           transition-colors"
                dir="ltr"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-navy-300 mb-1.5">
                {t('password')}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700
                             bg-gray-50 dark:bg-navy-800 text-gray-900 dark:text-white
                             placeholder-gray-400 dark:placeholder-navy-500
                             focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent
                             transition-colors ${isRTL ? 'pl-10 pr-4' : 'pr-10 pl-4'}`}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'} text-gray-400 hover:text-gray-600 dark:hover:text-navy-200`}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-3 text-base font-semibold rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('loading')}
                </span>
              ) : t('loginButton')}
            </button>
          </form>
        </div>

        <p className="text-center text-navy-500 text-xs mt-6">
          Real Estate CRM © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
