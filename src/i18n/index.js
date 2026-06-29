import ar from './ar'
import en from './en'

export const translations = { ar, en }

// Deep-lookup helper: t('leads.title') → translations[lang].leads.title
export function t(lang, key) {
  const dict = translations[lang] || translations.ar
  return key.split('.').reduce((obj, k) => obj?.[k], dict) ?? key
}
