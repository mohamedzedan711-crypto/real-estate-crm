import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { t as translate } from '../i18n'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ar')

  useEffect(() => {
    localStorage.setItem('lang', lang)
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  const toggleLang = useCallback(() => {
    setLang(prev => (prev === 'ar' ? 'en' : 'ar'))
  }, [])

  const t = useCallback((key) => translate(lang, key), [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, isRTL: lang === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be inside LanguageProvider')
  return ctx
}
