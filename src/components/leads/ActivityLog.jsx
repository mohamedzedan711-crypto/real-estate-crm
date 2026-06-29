import { useState, useEffect } from 'react'
import { MessageSquare, Phone, FileText, GitBranch, User, Plus, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LanguageContext'
import { logActivity } from '../../hooks/useLeads'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const ACTIVITY_ICONS = {
  note:           { icon: FileText,    color: 'text-blue-500' },
  call:           { icon: Phone,       color: 'text-green-500' },
  whatsapp_sent:  { icon: MessageSquare, color: 'text-green-600' },
  whatsapp_recv:  { icon: MessageSquare, color: 'text-purple-500' },
  status_change:  { icon: GitBranch,   color: 'text-orange-500' },
  assignment:     { icon: User,        color: 'text-navy-500' },
  created:        { icon: Star,        color: 'text-gold-500' },
}

export default function ActivityLog({ leadId }) {
  const { profile } = useAuth()
  const { t } = useLang()
  const [activities, setActivities] = useState([])
  const [noteText, setNoteText] = useState('')
  const [adding, setAdding] = useState(false)
  const [tab, setTab] = useState('note')

  useEffect(() => {
    if (!leadId) return
    supabase
      .from('lead_activities')
      .select('*, user:profiles(full_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setActivities(data || []))
  }, [leadId])

  const handleAdd = async () => {
    if (!noteText.trim()) return
    setAdding(true)
    try {
      await logActivity(leadId, profile.id, tab, noteText.trim())
      // Refresh
      const { data } = await supabase
        .from('lead_activities')
        .select('*, user:profiles(full_name)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
      setActivities(data || [])
      setNoteText('')
      toast.success(tab === 'note' ? t('activity.noteAdded') : t('activity.callLogged'))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Add note / log call */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-2">
          {['note', 'call'].map(type => (
            <button
              key={type}
              onClick={() => setTab(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === type
                  ? 'bg-gold-500 text-white'
                  : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-navy-300 hover:bg-gray-200'
              }`}
            >
              {type === 'note' ? t('activity.addNote') : t('activity.logCall')}
            </button>
          ))}
        </div>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder={t('activity.notePlaceholder')}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-700
                     bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !noteText.trim()}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50"
        >
          <Plus size={14} className="inline me-1" />
          {adding ? t('loading') : t('add')}
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {activities.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-navy-500 text-center py-4">{t('activity.noActivity')}</p>
        )}
        {activities.map(act => {
          const meta = ACTIVITY_ICONS[act.type] || ACTIVITY_ICONS.note
          const Icon = meta.icon
          return (
            <div key={act.id} className="flex gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-navy-800 flex items-center justify-center ${meta.color}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-navy-300">
                    {act.user?.full_name || '—'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-navy-500 shrink-0">
                    {format(new Date(act.created_at), 'dd/MM/yy HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-navy-400 mt-0.5 break-words">{act.content}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
