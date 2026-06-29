import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from 'recharts'
import { supabase, invokeFunction } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { Sparkles, TrendingUp, Users, Target, Award } from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = ['#d4a017','#1a3560','#10b981','#ef4444','#8b5cf6','#f59e0b']

const STATUSES = ['new','contacted','interested','negotiating','closed_won','closed_lost']
const SOURCES  = ['olx_dubizzle','aqarmap','meta','whatsapp','manual']

function ChartCard({ title, children }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-navy-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

export default function Reports() {
  const { t } = useLang()
  const { profile } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiReport, setAiReport] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)
  const [period, setPeriod] = useState('month')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Leads by status
        const { data: leads } = await supabase
          .from('leads')
          .select('status, source, type, ai_score, created_at, assigned_to, assigned_profile:profiles!leads_assigned_to_fkey(id, full_name)')

        // Agent performance
        const { data: agents } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', ['agent'])
          .eq('is_active', true)

        const statusData = STATUSES.map(s => ({
          name: t(`statuses.${s}`),
          value: leads?.filter(l => l.status === s).length || 0,
        }))

        const sourceData = SOURCES.map(s => ({
          name: t(`sources.${s}`),
          value: leads?.filter(l => l.source === s).length || 0,
        })).filter(d => d.value > 0)

        const agentPerf = (agents || []).map(agent => {
          const agentLeads = leads?.filter(l => l.assigned_to === agent.id) || []
          const won = agentLeads.filter(l => l.status === 'closed_won').length
          return {
            name: agent.full_name,
            total: agentLeads.length,
            won,
            rate: agentLeads.length ? Math.round((won / agentLeads.length) * 100) : 0,
            avgScore: agentLeads.length
              ? Math.round(agentLeads.reduce((s, l) => s + (l.ai_score || 0), 0) / agentLeads.length)
              : 0,
          }
        }).sort((a, b) => b.won - a.won)

        // Weekly trend (last 8 weeks)
        const weeklyData = []
        for (let i = 7; i >= 0; i--) {
          const weekStart = new Date()
          weekStart.setDate(weekStart.getDate() - i * 7 - 6)
          const weekEnd = new Date()
          weekEnd.setDate(weekEnd.getDate() - i * 7)
          const count = leads?.filter(l => {
            const d = new Date(l.created_at)
            return d >= weekStart && d <= weekEnd
          }).length || 0
          weeklyData.push({ week: `W${8 - i}`, leads: count })
        }

        setData({ statusData, sourceData, agentPerf, weeklyData, total: leads?.length || 0 })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [period])

  const generateAIReport = async () => {
    setGeneratingReport(true)
    try {
      const res = await invokeFunction('ai-report', { period, lang: t('appName') })
      setAiReport(res.report)
    } catch (err) {
      toast.error(err.message || t('errors.generic'))
    } finally {
      setGeneratingReport(false)
    }
  }

  if (loading) return <LoadingSpinner size="lg" className="py-20" />

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex gap-2">
        {['week','month','all'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              period === p
                ? 'bg-gold-500 text-white shadow-md'
                : 'card text-gray-600 dark:text-navy-300 hover:bg-gray-100 dark:hover:bg-navy-800'
            }`}
          >
            {t(p === 'week' ? 'thisWeek' : p === 'month' ? 'thisMonth' : 'all')}
          </button>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title={t('reports.leadSources')}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data?.sourceData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {data?.sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('reports.leadStatus')}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.statusData} barSize={20}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#d4a017" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Weekly trend */}
      <ChartCard title={t('reports.weeklyTrend')}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data?.weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="leads" stroke="#d4a017" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Agent performance table */}
      {profile?.role !== 'agent' && data?.agentPerf?.length > 0 && (
        <ChartCard title={t('reports.agentPerformance')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-navy-800">
                  {[t('reports.agent'), t('reports.totalLeads'), t('reports.closedWon'), t('reports.conversionRate'), t('reports.avgScore')].map(h => (
                    <th key={h} className="pb-2 text-start text-xs font-semibold text-gray-500 dark:text-navy-400 pe-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-navy-800">
                {data.agentPerf.map((a, i) => (
                  <tr key={i} className={i === 0 ? 'bg-gold-50 dark:bg-gold-900/10' : ''}>
                    <td className="py-2 pe-4 font-medium text-gray-800 dark:text-white">
                      {i === 0 && <Award size={12} className="inline me-1 text-gold-500" />}
                      {a.name}
                    </td>
                    <td className="py-2 pe-4 text-gray-600 dark:text-navy-300">{a.total}</td>
                    <td className="py-2 pe-4 text-green-600 dark:text-green-400 font-semibold">{a.won}</td>
                    <td className="py-2 pe-4">
                      <span className={`text-xs font-bold ${a.rate >= 20 ? 'text-green-500' : a.rate >= 10 ? 'text-amber-500' : 'text-red-400'}`}>
                        {a.rate}%
                      </span>
                    </td>
                    <td className="py-2 pe-4 text-gray-600 dark:text-navy-300">{a.avgScore || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* AI Report */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-gold-500" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-navy-200">{t('reports.generateReport')}</h3>
          </div>
          <button
            onClick={generateAIReport}
            disabled={generatingReport}
            className="btn-gold text-sm px-4 py-2 disabled:opacity-50"
          >
            {generatingReport ? t('loading') : t('reports.generateReport')}
          </button>
        </div>
        {aiReport ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-navy-300 font-sans leading-relaxed bg-gray-50 dark:bg-navy-800 p-4 rounded-xl">
              {aiReport}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-navy-500">{t('noData')}</p>
        )}
      </div>
    </div>
  )
}
