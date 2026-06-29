import { useState } from 'react'
import { Plus, Search, Filter, Download, Upload, Trash2, Eye, Edit2, AlertTriangle } from 'lucide-react'
import { useLeads, createLead, updateLead, deleteLead } from '../hooks/useLeads'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LanguageContext'
import { StatusBadge, SourceBadge, TypeBadge, ScoreBadge } from '../components/shared/Badge'
import Modal from '../components/shared/Modal'
import LeadForm from '../components/leads/LeadForm'
import LeadDetail from '../components/leads/LeadDetail'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const SOURCES  = ['olx_dubizzle','aqarmap','meta','whatsapp','manual']
const STATUSES = ['new','contacted','interested','negotiating','closed_won','closed_lost']
const TYPES    = ['buyer','seller']

export default function Leads() {
  const { t } = useLang()
  const { profile, isAdmin, isManager } = useAuth()

  const [filters, setFilters] = useState({ search: '', status: '', source: '', type: '' })
  const { leads, loading, refetch } = useLeads(filters)

  const [addOpen,    setAddOpen]    = useState(false)
  const [editLead,   setEditLead]   = useState(null)
  const [viewLead,   setViewLead]   = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [showFilters,setShowFilters]= useState(false)

  // ── Create ──────────────────────────────────────────────────────────────
  const handleCreate = async (data) => {
    setSaving(true)
    try {
      await createLead({ ...data, created_by: profile.id })
      toast.success(t('success'))
      setAddOpen(false)
      refetch()
    } catch (err) {
      toast.error(err.message || t('errors.generic'))
    } finally { setSaving(false) }
  }

  // ── Edit ────────────────────────────────────────────────────────────────
  const handleEdit = async (data) => {
    setSaving(true)
    try {
      await updateLead(editLead.id, data)
      toast.success(t('success'))
      setEditLead(null)
      refetch()
    } catch (err) {
      toast.error(err.message || t('errors.generic'))
    } finally { setSaving(false) }
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteLead(deletingId)
      toast.success(t('success'))
      setDeletingId(null)
      refetch()
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  // ── CSV Export ──────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Name','Phone','Email','Source','Type','Status','Score','Created']
    const rows = leads.map(l => [
      l.full_name, l.phone, l.email || '', l.source, l.type,
      l.status, l.ai_score || '', format(new Date(l.created_at), 'dd/MM/yyyy'),
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }))

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            placeholder={t('search') + '…'}
            className="w-full ps-9 pe-4 py-2 rounded-xl border border-gray-200 dark:border-navy-700
                       bg-white dark:bg-navy-900 text-sm text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
        </div>

        <button onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
            showFilters ? 'bg-gold-50 border-gold-300 text-gold-700 dark:bg-gold-900/20 dark:border-gold-700 dark:text-gold-400'
                        : 'border-gray-200 dark:border-navy-700 text-gray-600 dark:text-navy-300 hover:bg-gray-50 dark:hover:bg-navy-800'
          }`}>
          <Filter size={15} /> {t('filter')}
        </button>

        <button onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 text-sm font-medium text-gray-600 dark:text-navy-300 hover:bg-gray-50 dark:hover:bg-navy-800">
          <Download size={15} /> {t('leads.exportCSV')}
        </button>

        {(isAdmin || isManager) && (
          <button onClick={() => setAddOpen(true)} className="btn-gold flex items-center gap-2">
            <Plus size={16} /> {t('leads.addLead')}
          </button>
        )}
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="card p-4 flex flex-wrap gap-3">
          {[
            { key: 'status',  opts: STATUSES,  prefix: 'statuses', placeholder: t('leads.filters.allStatuses') },
            { key: 'source',  opts: SOURCES,   prefix: 'sources',  placeholder: t('leads.filters.allSources') },
            { key: 'type',    opts: TYPES,     prefix: 'types',    placeholder: t('leads.filters.allTypes') },
          ].map(({ key, opts, prefix, placeholder }) => (
            <select key={key} value={filters[key]} onChange={e => setFilter(key, e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-700
                         bg-white dark:bg-navy-800 text-sm text-gray-700 dark:text-navy-300
                         focus:outline-none focus:ring-2 focus:ring-gold-500">
              <option value="">{placeholder}</option>
              {opts.map(o => <option key={o} value={o}>{t(`${prefix}.${o}`)}</option>)}
            </select>
          ))}
          <button onClick={() => setFilters({ search: '', status: '', source: '', type: '' })}
            className="text-xs text-gray-500 dark:text-navy-400 hover:text-red-500 transition-colors px-2">
            {t('clear')}
          </button>
        </div>
      )}

      {/* Summary badge */}
      <p className="text-xs text-gray-500 dark:text-navy-400">
        {leads.length} {t('leads.title').toLowerCase()}
      </p>

      {/* Table */}
      {loading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : leads.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 dark:text-navy-500">{t('leads.noLeads')}</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-navy-800/60 border-b border-gray-100 dark:border-navy-800">
                  {[t('leads.fullName'), t('leads.phone'), t('leads.source'), t('leads.type'), t('leads.status'),
                    t('leads.aiScore'), t('leads.assignedTo'), t('leads.createdAt'), t('actions')
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-navy-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-navy-800">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {lead.is_dead && <AlertTriangle size={12} className="text-red-400 shrink-0" />}
                        <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{lead.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-navy-300 font-mono text-xs" dir="ltr">{lead.phone}</td>
                    <td className="px-4 py-3"><SourceBadge source={lead.source} /></td>
                    <td className="px-4 py-3"><TypeBadge type={lead.type} /></td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3">
                      {lead.ai_score ? <ScoreBadge score={lead.ai_score} /> : <span className="text-gray-300 dark:text-navy-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-navy-300 whitespace-nowrap">
                      {lead.assigned_profile?.full_name || <span className="text-gray-300 dark:text-navy-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-navy-400 whitespace-nowrap text-xs">
                      {format(new Date(lead.created_at), 'dd/MM/yy')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewLead(lead)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors">
                          <Eye size={14} />
                        </button>
                        {(isAdmin || isManager) && (
                          <>
                            <button onClick={() => setEditLead(lead)}
                              className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500 transition-colors">
                              <Edit2 size={14} />
                            </button>
                            {isAdmin && (
                              <button onClick={() => setDeletingId(lead.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title={t('leads.addLead')} size="lg">
        <LeadForm onSubmit={handleCreate} onCancel={() => setAddOpen(false)} loading={saving} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editLead} onClose={() => setEditLead(null)} title={t('leads.editLead')} size="lg">
        {editLead && <LeadForm initial={editLead} onSubmit={handleEdit} onCancel={() => setEditLead(null)} loading={saving} />}
      </Modal>

      {/* View Modal */}
      <Modal isOpen={!!viewLead} onClose={() => setViewLead(null)} title={t('leads.leadDetail')} size="xl">
        {viewLead && <LeadDetail lead={viewLead} onClose={() => setViewLead(null)} onUpdated={refetch} />}
      </Modal>

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        title={t('leads.deleteLead')}
        size="sm"
        footer={
          <>
            <button onClick={() => setDeletingId(null)}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-navy-700 text-sm text-gray-600 dark:text-navy-300 hover:bg-gray-50">
              {t('cancel')}
            </button>
            <button onClick={handleDelete}
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold">
              {t('delete')}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-navy-300">{t('leads.deleteConfirm')}</p>
      </Modal>
    </div>
  )
}
