import { useLang } from '../../contexts/LanguageContext'

const STATUS_CLASS = {
  new:          'badge-new',
  contacted:    'badge-contacted',
  interested:   'badge-interested',
  negotiating:  'badge-negotiating',
  closed_won:   'badge-won',
  closed_lost:  'badge-lost',
  dead:         'badge-dead',
}

const SOURCE_CLASS = {
  olx_dubizzle: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  aqarmap:      'bg-teal-100  text-teal-800  dark:bg-teal-900/30  dark:text-teal-300',
  meta:         'bg-blue-100  text-blue-800  dark:bg-blue-900/30  dark:text-blue-300',
  whatsapp:     'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  manual:       'bg-gray-100  text-gray-700  dark:bg-gray-800     dark:text-gray-300',
}

export function StatusBadge({ status }) {
  const { t } = useLang()
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[status] || 'badge-new'}`}>
      {t(`statuses.${status}`) || status}
    </span>
  )
}

export function SourceBadge({ source }) {
  const { t } = useLang()
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_CLASS[source] || SOURCE_CLASS.manual}`}>
      {t(`sources.${source}`) || source}
    </span>
  )
}

export function TypeBadge({ type }) {
  const { t } = useLang()
  const cls = type === 'buyer'
    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
    : 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {t(`types.${type}`) || type}
    </span>
  )
}

export function ScoreBadge({ score }) {
  const { t } = useLang()
  if (!score) return null
  let cls, label
  if (score >= 7) { cls = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';     label = t('score.hot') }
  else if (score >= 4) { cls = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'; label = t('score.warm') }
  else { cls = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';    label = t('score.cold') }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <span className="font-bold">{score}</span>
      <span>/10</span>
      <span>·</span>
      <span>{label}</span>
    </span>
  )
}

export function RoleBadge({ role }) {
  const { t } = useLang()
  const cls = {
    admin:   'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-300',
    manager: 'bg-navy-100 text-navy-800 dark:bg-navy-800/50 dark:text-navy-300',
    agent:   'bg-gray-100 text-gray-700 dark:bg-gray-800   dark:text-gray-300',
  }[role] || ''
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {t(`roles.${role}`) || role}
    </span>
  )
}
