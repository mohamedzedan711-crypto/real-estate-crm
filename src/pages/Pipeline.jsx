import { useState } from 'react'
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLeads, updateLead } from '../hooks/useLeads'
import { useLang } from '../contexts/LanguageContext'
import { StatusBadge, ScoreBadge, TypeBadge } from '../components/shared/Badge'
import Modal from '../components/shared/Modal'
import LeadDetail from '../components/leads/LeadDetail'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { AlertTriangle, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'

const COLUMNS = ['new','contacted','interested','negotiating','closed_won','closed_lost']

const COL_COLORS = {
  new:          'border-t-blue-500',
  contacted:    'border-t-purple-500',
  interested:   'border-t-amber-500',
  negotiating:  'border-t-orange-500',
  closed_won:   'border-t-green-500',
  closed_lost:  'border-t-red-500',
}

function PipelineCard({ lead, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className="card p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2 select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm text-gray-900 dark:text-white leading-tight line-clamp-1">
          {lead.full_name}
        </span>
        <button
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          className="text-gray-300 dark:text-navy-600 hover:text-gray-500 shrink-0 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        <TypeBadge type={lead.type} />
        {lead.ai_score && <ScoreBadge score={lead.ai_score} />}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-navy-500">
        <span dir="ltr">{lead.phone}</span>
        {lead.is_dead && <AlertTriangle size={11} className="text-red-400" />}
      </div>

      {lead.property_price && (
        <p className="text-xs font-semibold text-gold-600 dark:text-gold-400">
          {Number(lead.property_price).toLocaleString()} EGP
        </p>
      )}
    </div>
  )
}

function Column({ status, leads, onCardClick, t }) {
  const { setNodeRef } = useSortable({ id: status, disabled: true })
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[240px] flex-1 rounded-xl border-t-4 ${COL_COLORS[status]}
                  bg-gray-50 dark:bg-navy-900 border border-gray-100 dark:border-navy-800 shadow-sm`}
    >
      {/* Column header */}
      <div className="px-3 py-3 flex items-center justify-between border-b border-gray-100 dark:border-navy-800">
        <span className="font-semibold text-sm text-gray-700 dark:text-navy-200">{t(`statuses.${status}`)}</span>
        <span className="text-xs font-bold bg-gray-200 dark:bg-navy-700 text-gray-600 dark:text-navy-300 px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto min-h-[100px]">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <PipelineCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}

export default function Pipeline() {
  const { t } = useLang()
  const { leads, loading, refetch } = useLeads()
  const [viewLead, setViewLead] = useState(null)
  const [draggingLead, setDraggingLead] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const leadsByStatus = COLUMNS.reduce((acc, s) => ({
    ...acc,
    [s]: leads.filter(l => l.status === s),
  }), {})

  const totalValue = leads
    .filter(l => l.property_price && l.status !== 'closed_lost')
    .reduce((sum, l) => sum + Number(l.property_price), 0)

  const handleDragStart = ({ active }) => {
    setDraggingLead(leads.find(l => l.id === active.id) || null)
  }

  const handleDragEnd = async ({ active, over }) => {
    setDraggingLead(null)
    if (!over || active.id === over.id) return

    // Determine if 'over' is a status column or another card
    const targetStatus = COLUMNS.includes(over.id)
      ? over.id
      : leads.find(l => l.id === over.id)?.status

    const lead = leads.find(l => l.id === active.id)
    if (!lead || !targetStatus || lead.status === targetStatus) return

    try {
      await updateLead(lead.id, { status: targetStatus })
      toast.success(t('success'))
      refetch()
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  if (loading) return <LoadingSpinner size="lg" className="py-24" />

  return (
    <div className="space-y-4">
      {/* Pipeline value */}
      <div className="card px-5 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600 dark:text-navy-300">{t('pipeline.totalValue')}</span>
        <span className="text-lg font-bold text-gold-600 dark:text-gold-400">
          {totalValue.toLocaleString()} EGP
        </span>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(status => (
            <Column
              key={status}
              status={status}
              leads={leadsByStatus[status] || []}
              onCardClick={setViewLead}
              t={t}
            />
          ))}
        </div>

        <DragOverlay>
          {draggingLead && (
            <div className="card p-3 w-56 shadow-xl rotate-2 opacity-90">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{draggingLead.full_name}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Lead detail modal */}
      <Modal isOpen={!!viewLead} onClose={() => setViewLead(null)} title={t('leads.leadDetail')} size="xl">
        {viewLead && <LeadDetail lead={viewLead} onClose={() => setViewLead(null)} onUpdated={refetch} />}
      </Modal>
    </div>
  )
}
