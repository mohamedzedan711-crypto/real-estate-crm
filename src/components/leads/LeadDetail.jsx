import { useState } from 'react'
import { X, Phone, Mail, MapPin, Home, DollarSign, Calendar, User, Zap, AlertTriangle } from 'lucide-react'
import { useLang } from '../../contexts/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'
import { StatusBadge, SourceBadge, TypeBadge, ScoreBadge } from '../shared/Badge'
import ActivityLog from './ActivityLog'
import { updateLead } from '../../hooks/useLeads'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUSES = ['new','contacted','interested','negotiating','closed_won','closed_lost']

export default function LeadDetail({ lead, onClose, onUpdated }) {
  const { t } = useLang()
  const { profile } = useAuth()
  const [updating, setUpdating] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(lead.status)

  const changeStatus = async (newStatus) => {
    setUpdating(true)
    try {
      await updateLead(lead.id, { status: newStatus })
      setCurrentStatus(newStatus)
      toast.success(t('success'))
      onUpdated?.()
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setUpdating(false)
    }
  }

  const info = (Icon, label, value) => value ? (
    <div className="flex items-start gap-2 text-sm">
      <Icon size={14} className="text-gold-500 mt-0.5 shrink-0" />
      <div>
        <span className="text-gray-400 dark:text-navy-500 text-xs">{label}: </span>
        <span className="text-gray-800 dark:text-white font-medium">{value}</span>
      </div>
    </div>
  ) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{lead.full_name}</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <StatusBadge status={currentStatus} />
            <SourceBadge source={lead.source} />
            <TypeBadge type={lead.type} />
            {lead.ai_score && <ScoreBadge score={lead.ai_score} />}
            {lead.is_dead && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <AlertTriangle size={10} /> Dead
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status changer */}
      {profile?.role !== 'agent' || lead.assigned_to === profile.id ? (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-navy-400 mb-2 uppercase tracking-wider">{t('leads.status')}</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => (
              <button
                key={s}
                disabled={updating || s === currentStatus}
                onClick={() => changeStatus(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  s === currentStatus
                    ? 'bg-gold-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-navy-300 hover:bg-gray-200 dark:hover:bg-navy-700'
                }`}
              >
                {t(`statuses.${s}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Contact info */}
      <div className="card p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-navy-400 uppercase tracking-wider mb-3">{t('details')}</p>
        {info(Phone, t('leads.phone'), lead.phone)}
        {info(Mail, t('leads.email'), lead.email)}
        {info(Home, t('leads.propertyType'), lead.property_type ? t(`propertyTypes.${lead.property_type}`) : null)}
        {info(MapPin, t('leads.propertyLocation'), lead.property_location)}
        {info(MapPin, t('leads.preferredArea'), lead.preferred_area)}
        {info(DollarSign, t('leads.propertyPrice'), lead.property_price ? `${Number(lead.property_price).toLocaleString()} EGP` : null)}
        {info(DollarSign, t('leads.budget'), (lead.budget_min || lead.budget_max)
          ? `${lead.budget_min ? Number(lead.budget_min).toLocaleString() : '?'} – ${lead.budget_max ? Number(lead.budget_max).toLocaleString() : '?'} EGP`
          : null
        )}
        {info(Calendar, t('leads.timeline'), lead.timeline)}
        {info(User, t('leads.assignedTo'), lead.assigned_profile?.full_name)}
        {info(Calendar, t('leads.createdAt'), format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm'))}
        {info(Calendar, t('leads.lastActivity'), lead.last_activity_at ? format(new Date(lead.last_activity_at), 'dd/MM/yyyy HH:mm') : null)}
      </div>

      {/* Notes */}
      {lead.notes && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-navy-400 uppercase tracking-wider mb-2">{t('notes')}</p>
          <p className="text-sm text-gray-700 dark:text-navy-300 whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}

      {/* Activity log */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-navy-400 uppercase tracking-wider mb-3">{t('activity.title')}</p>
        <ActivityLog leadId={lead.id} />
      </div>
    </div>
  )
}
