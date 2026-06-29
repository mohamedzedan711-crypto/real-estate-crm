import { useState, useEffect } from 'react'
import { Users, TrendingUp, AlertTriangle, CheckCircle, Zap, Target, Award } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import StatCard from '../components/shared/StatCard'
import { StatusBadge, SourceBadge, ScoreBadge } from '../components/shared/Badge'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { format, startOfWeek, startOfMonth } from 'date-fns'
import Modal from '../components/shared/Modal'
import LeadDetail from '../components/leads/LeadDetail'

const COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#f97316','#10b981','#ef4444']

export default function Dashboard() {
  const { t } = useLang()
  const { profile, loading: authLoading } = useAuth()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewLead, setViewLead] = useState(null)

  useEffect(() => {
    // Wait until auth context has resolved before fetching data.
    // Do NOT gate on `profile` being truthy — profile can be null if the
    // profiles table is missing or the row wasn't created yet, and blocking
    // on it would leave the spinner running forever.
    if (authLoading) return

    async function load() {
      try {
        const now        = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const weekStart  = startOfWeek(now, { weekStartsOn: 6 }).toISOString()
        const monthStart = startOfMonth(now).toISOString()

        let query = supabase.from('leads').select('*')
        // Agents only see their own leads (RLS enforces this server-side too)
        if (profile?.role === 'agent' && profile?.id) {
          query = query.eq('assigned_to', profile.id)
        }

        const { data: leads, error: leadsError } = await query
        if (leadsError) {
          console.error('Dashboard leads error:', leadsError.message)
          // Render empty stats so the page is visible even if DB isn't set up yet
          setStats({
            total: 0, newToday: 0, newWeek: 0, newMonth: 0,
            closedWon: 0, dead: 0, convRate: 0,
            statusData: [], sourceData: [], recent: [], hot: [], agentPerf: [],
          })
          setLoading(false)
          return
        }

        const safeLeads = leads || []
        const total     = safeLeads.length
        const newToday  = safeLeads.filter(l => l.created_at >= todayStart).length
        const newWeek   = safeLeads.filter(l => l.created_at >= weekStart).length
        const newMonth  = safeLeads.filter(l => l.created_at >= monthStart).length
        const closedWon = safeLeads.filter(l => l.status === 'closed_won').length
        const dead      = safeLeads.filter(l => l.is_dead).length
        const convRate  = total ? Math.round((closedWon / total) * 100) : 0

        const STATUSES = ['new','contacted','interested','negotiating','closed_won','closed_lost']
        const statusData = STATUSES.map((s, i) => ({
          name: t(`statuses.${s}`),
          value: safeLeads.filter(l => l.status === s).length,
          color: COLORS[i],
        })).filter(d => d.value > 0)

        const SOURCES = ['olx_dubizzle','aqarmap','meta','whatsapp','manual']
        const sourceData = SOURCES.map(s => ({
          name: t(`sources.${s}`),
          value: safeLeads.filter(l => l.source === s).length,
        })).filter(d => d.value > 0)

        const recent = [...safeLeads]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5)

        const hot = safeLeads
          .filter(l => (l.ai_score || 0) >= 7)
          .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))
          .slice(0, 5)

        let agentPerf = []
        if (profile?.role !== 'agent') {
          const { data: agents } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'agent')
            .eq('is_active', true)
          agentPerf = (agents || []).map(a => ({
            name:  a.full_name,
            total: safeLeads.filter(l => l.assigned_to === a.id).length,
            won:   safeLeads.filter(l => l.assigned_to === a.id && l.status === 'closed_won').length,
          })).sort((a, b) => b.won - a.won).slice(0, 5)
        }

        setStats({ total, newToday, newWeek, newMonth, closedWon, dead, convRate, statusData, sourceData, recent, hot, agentPerf })
      } catch (err) {
        console.error('Dashboard load error:', err)
        setStats({
          total: 0, newToday: 0, newWeek: 0, newMonth: 0,
          closedWon: 0, dead: 0, convRate: 0,
          statusData: [], sourceData: [], recent: [], hot: [], agentPerf: [],
        })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [authLoading, profile?.id])

  if (loading) return <LoadingSpinner size="lg" className="py-24" />
  if (!stats) return null

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title={t('dashboard.totalLeads')}   value={stats.total}    icon={Users}       color="navy" />
        <StatCard title={t('dashboard.newToday')}     value={stats.newToday} icon={TrendingUp}  color="gold" />
        <StatCard title={t('dashboard.closedWon')}    value={stats.closedWon} icon={CheckCircle} color="green" />
        <StatCard title={t('dashboard.deadLeads')}    value={stats.dead}     icon={AlertTriangle} color="red" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title={t('dashboard.newThisWeek')}  value={stats.newWeek}   icon={Target}      color="blue" />
        <StatCard title={t('dashboard.newThisMonth')} value={stats.newMonth}  icon={Zap}         color="navy" />
        <StatCard title={t('dashboard.conversionRate')} value={`${stats.convRate}%`} icon={TrendingUp} color="gold" />
        {profile?.role !== 'agent' && stats.agentPerf[0] && (
          <StatCard title={t('dashboard.topAgent')} value={stats.agentPerf[0].name} icon={Award} color="green"
            subtitle={`${stats.agentPerf[0].won} ${t('dashboard.closedWon').toLowerCase()}`} />
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status pie */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-navy-200 mb-4">{t('dashboard.leadsByStatus')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.statusData} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                {stats.statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Source bar */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-navy-200 mb-4">{t('dashboard.leadsBySource')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.sourceData} barSize={22}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#d4a017" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hot leads + Recent leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Hot leads */}
        {stats.hot.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-navy-200 mb-4 flex items-center gap-2">
              <Zap size={14} className="text-gold-500" /> Top AI Scored
            </h3>
            <div className="space-y-2">
              {stats.hot.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => setViewLead(lead)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors text-start"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{lead.full_name}</p>
                    <p className="text-xs text-gray-400 dark:text-navy-500" dir="ltr">{lead.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={lead.status} />
                    <ScoreBadge score={lead.ai_score} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent leads */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-navy-200 mb-4">{t('dashboard.recentLeads')}</h3>
          <div className="space-y-2">
            {stats.recent.map(lead => (
              <button
                key={lead.id}
                onClick={() => setViewLead(lead)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors text-start"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{lead.full_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <SourceBadge source={lead.source} />
                    <span className="text-xs text-gray-400 dark:text-navy-500">
                      {format(new Date(lead.created_at), 'dd/MM HH:mm')}
                    </span>
                  </div>
                </div>
                <StatusBadge status={lead.status} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent performance table (admin/manager) */}
      {profile?.role !== 'agent' && stats.agentPerf.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-navy-200 mb-4 flex items-center gap-2">
            <Award size={14} className="text-gold-500" /> {t('dashboard.agentPerformance')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-navy-800">
                  {[t('reports.agent'), t('reports.totalLeads'), t('reports.closedWon'), t('reports.conversionRate')].map(h => (
                    <th key={h} className="pb-2 text-start text-xs font-semibold text-gray-400 dark:text-navy-500 pe-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-navy-800">
                {stats.agentPerf.map((a, i) => (
                  <tr key={i}>
                    <td className="py-2 pe-4 font-medium text-gray-800 dark:text-white">
                      {i === 0 && <Award size={12} className="inline me-1 text-gold-500" />}
                      {a.name}
                    </td>
                    <td className="py-2 pe-4 text-gray-600 dark:text-navy-300">{a.total}</td>
                    <td className="py-2 pe-4 text-green-600 dark:text-green-400 font-semibold">{a.won}</td>
                    <td className="py-2 pe-4">
                      <span className="text-xs font-bold text-gray-600 dark:text-navy-300">
                        {a.total ? Math.round((a.won / a.total) * 100) : 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead detail modal */}
      <Modal isOpen={!!viewLead} onClose={() => setViewLead(null)} title={t('leads.leadDetail')} size="xl">
        {viewLead && <LeadDetail lead={viewLead} onClose={() => setViewLead(null)} />}
      </Modal>
    </div>
  )
}
