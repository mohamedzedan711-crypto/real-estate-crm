// Shared page configuration — used by Sidebar, ProtectedRoute, and Settings.

export const ALL_PAGES = [
  { key: 'dashboard',  path: '/dashboard',  ar: 'لوحة التحكم',     en: 'Dashboard',        maxRoles: ['admin','manager','agent'] },
  { key: 'leads',      path: '/leads',      ar: 'العملاء',         en: 'Leads',            maxRoles: ['admin','manager','agent'] },
  { key: 'pipeline',   path: '/pipeline',   ar: 'خط الصفقات',     en: 'Pipeline',         maxRoles: ['admin','manager','agent'] },
  { key: 'whatsapp',   path: '/whatsapp',   ar: 'واتساب',          en: 'WhatsApp',         maxRoles: ['admin','manager','agent'] },
  { key: 'aiChat',     path: '/ai-chat',    ar: 'المساعد الذكي',   en: 'AI Assistant',     maxRoles: ['admin','manager','agent'] },
  { key: 'marketing',  path: '/marketing',  ar: 'الدماغ التسويقي', en: 'Marketing Brain',  maxRoles: ['admin','manager'] },
  { key: 'accountant', path: '/accountant', ar: 'الدماغ المحاسبي', en: 'Accountant Brain', maxRoles: ['admin','manager'] },
  { key: 'reports',    path: '/reports',    ar: 'التقارير',        en: 'Reports',          maxRoles: ['admin','manager'] },
  { key: 'settings',   path: '/settings',   ar: 'الإعدادات',       en: 'Settings',         maxRoles: ['admin'] },
]

export const DEFAULT_PAGE_ACCESS = {
  admin:   null, // null = unrestricted — don't store page_access for admins
  manager: ['dashboard','leads','pipeline','whatsapp','aiChat','marketing','accountant','reports'],
  agent:   ['dashboard','leads','pipeline','whatsapp','aiChat'],
}

/**
 * Returns the list of page keys a given profile can see.
 * Admins always get all pages.
 * Non-admins: profile.page_access (if set) is used, else role defaults.
 * Result is always intersected with the role's maximum allowed pages
 * to prevent privilege escalation via a manually crafted page_access array.
 */
export function getEffectivePageKeys(profile) {
  if (!profile || profile.role === 'admin') return ALL_PAGES.map(p => p.key)
  const roleMax = ALL_PAGES.filter(p => p.maxRoles.includes(profile.role)).map(p => p.key)
  const granted =
    profile.page_access && profile.page_access.length > 0
      ? profile.page_access
      : DEFAULT_PAGE_ACCESS[profile.role] || []
  return granted.filter(k => roleMax.includes(k))
}

/** Maps a location pathname to its page key (or null if not found). */
export function pathToKey(pathname) {
  return ALL_PAGES.find(p => p.path === pathname)?.key ?? null
}
