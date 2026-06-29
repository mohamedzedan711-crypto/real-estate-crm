import { useState, useEffect } from 'react'
import {
  Megaphone, TrendingUp, BarChart3, Sparkles, DollarSign,
  RefreshCw, AlertTriangle, ExternalLink, Info
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { supabase, invokeFunction } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'
import { useSettings } from '../hooks/useSettings'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import LocationPicker from '../components/marketing/LocationPicker'
import { selectionToLabels } from '../data/egyptLocations'
import toast from 'react-hot-toast'

const COLORS = ['#d4a017', '#1a3560', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b']

const GOALS = [
  { key: 'lead_generation',    ar: 'توليد عملاء محتملين',        en: 'Lead Generation' },
  { key: 'brand_awareness',    ar: 'الوعي بالعلامة التجارية',    en: 'Brand Awareness' },
  { key: 'seller_acquisition', ar: 'جذب البائعين',               en: 'Seller Acquisition' },
  { key: 'buyer_targeting',    ar: 'استهداف المشترين',            en: 'Buyer Targeting' },
  { key: 'project_launch',     ar: 'إطلاق مشروع جديد',           en: 'New Project Launch' },
]

const TABS = [
  { key: 'launch',   icon: Megaphone,   ar: 'منصة الحملات',      en: 'Campaign Launcher' },
  { key: 'sources',  icon: TrendingUp,  ar: 'أداء المصادر',      en: 'Source Performance' },
  { key: 'meta',     icon: BarChart3,   ar: 'إعلانات ميتا',      en: 'Meta Ads' },
  { key: 'insights', icon: Sparkles,    ar: 'رؤى أسبوعية',       en: 'Weekly Insights' },
  { key: 'budget',   icon: DollarSign,  ar: 'توصيات الميزانية',  en: 'Budget Recommendations' },
]

const SOURCE_NAMES = {
  olx_dubizzle: { ar: 'OLX / دوبيزل', en: 'OLX / Dubizzle' },
  aqarmap:      { ar: 'عقارماب',       en: 'Aqarmap' },
  meta:         { ar: 'ميتا',           en: 'Meta Ads' },
  whatsapp:     { ar: 'واتساب',         en: 'WhatsApp' },
  manual:       { ar: 'يدوي',           en: 'Manual' },
}

function Section({ icon: Icon, title, children, action }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gold-500" />
          <h2 className="text-sm font-bold text-gray-800 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Campaign Launcher
// ─────────────────────────────────────────────────────────────────────────────
function CampaignLauncher({ lang }) {
  const isAr = lang === 'ar'
  const [form, setForm]         = useState({ situation: '', goal: 'lead_generation', budget: '', duration: '' })
  const [locations, setLocations] = useState(new Set())
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAnalyze = async () => {
    setLoading(true)
    setResult(null)
    try {
      const locationLabelStr = selectionToLabels(locations, lang)
      const allEgypt = locationLabelStr === (isAr ? 'جميع أنحاء مصر' : 'All of Egypt')
      const data = await invokeFunction('marketing-ai', {
        situation: form.situation.trim() || null,
        goal:      form.goal,
        locations: allEgypt ? [] : locationLabelStr.split(', '),
        budget:    form.budget ? Number(form.budget) : null,
        duration:  form.duration ? Number(form.duration) : null,
        lang,
      })
      setResult(data)
    } catch (err) {
      toast.error(err.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <Section icon={Megaphone} title={isAr ? 'منصة إطلاق الحملة' : 'Campaign Launcher'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-navy-400 mb-1.5">
              {isAr ? 'هدف الحملة' : 'Campaign Goal'} <span className="text-red-400">*</span>
            </label>
            <select
              value={form.goal}
              onChange={e => set('goal', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700
                         bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              {GOALS.map(g => (
                <option key={g.key} value={g.key}>{isAr ? g.ar : g.en}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-navy-400 mb-1.5">
              {isAr ? 'الميزانية الإجمالية (جنيه)' : 'Total Budget (EGP)'}
              <span className="text-gray-400 font-normal ms-1">({isAr ? 'اختياري' : 'optional'})</span>
            </label>
            <input type="number" value={form.budget} onChange={e => set('budget', e.target.value)}
              placeholder={isAr ? 'مثال: 5000' : 'e.g. 5000'}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700
                         bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-gold-500" dir="ltr" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-navy-400 mb-1.5">
              {isAr ? 'مدة الحملة (أيام)' : 'Duration (days)'}
              <span className="text-gray-400 font-normal ms-1">({isAr ? 'اختياري' : 'optional'})</span>
            </label>
            <input type="number" value={form.duration} onChange={e => set('duration', e.target.value)}
              placeholder={isAr ? 'مثال: 14' : 'e.g. 14'} min="1"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700
                         bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-gold-500" dir="ltr" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-navy-400 mb-1.5">
              {isAr ? 'السياق / الموقف' : 'Situation / Context'}
              <span className="text-gray-400 font-normal ms-1">({isAr ? 'اختياري تماماً' : 'fully optional'})</span>
            </label>
            <textarea value={form.situation} onChange={e => set('situation', e.target.value)} rows={3}
              placeholder={isAr
                ? 'مثال: لدينا مشروع جديد في التجمع الخامس، نريد جذب مشترين...'
                : 'e.g. We have a new project in Fifth Settlement targeting young families...'}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700
                         bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none" />
          </div>
        </div>

        <div className="relative">
          <label className="block text-xs font-semibold text-gray-500 dark:text-navy-400 mb-1.5">
            {isAr ? 'المناطق المستهدفة' : 'Target Locations'}
            <span className="text-gray-400 font-normal ms-1">
              ({isAr ? 'اختياري — AI ستختار بدونها' : 'optional — AI will suggest from CRM data'})
            </span>
          </label>
          <LocationPicker selection={locations} onChange={setLocations} />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-navy-50 dark:bg-navy-800/50 border border-navy-100 dark:border-navy-700">
          <Info size={14} className="text-navy-400 mt-0.5 shrink-0" />
          <p className="text-xs text-navy-500 dark:text-navy-400">
            {isAr
              ? 'الذكاء الاصطناعي سيقرأ بيانات عملائك الحاليين أولاً، ثم يبني التوصية على الأنماط الحقيقية.'
              : 'The AI reads your real CRM data first, then builds the recommendation on actual patterns — not generic advice.'}
          </p>
        </div>

        <button onClick={handleAnalyze} disabled={loading}
          className="w-full btn-gold py-3 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? (
            <>
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {isAr ? 'جاري التحليل...' : 'Analyzing CRM data...'}
            </>
          ) : (
            <>
              <Sparkles size={16} />
              {isAr ? 'حلّل وولِّد التوصية' : 'Analyze & Generate Recommendation'}
            </>
          )}
        </button>
      </Section>

      {result && (
        <div className="space-y-4">
          {result.crmSnapshot && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-navy-400 uppercase tracking-wider mb-3">
                {isAr ? 'البيانات المستخدمة في التحليل' : 'CRM Data Used for Analysis'}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: isAr ? 'إجمالي العملاء' : 'Total Leads',  value: result.crmSnapshot.totalLeads },
                  { label: isAr ? 'مشترون' : 'Buyers',                value: result.crmSnapshot.totalBuyers },
                  { label: isAr ? 'بائعون' : 'Sellers',               value: result.crmSnapshot.totalSellers },
                  { label: isAr ? 'صفقات مغلقة' : 'Closed Deals',    value: result.crmSnapshot.totalConverted },
                  { label: isAr ? 'راكدون' : 'Dead Leads',            value: result.crmSnapshot.deadLeads },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-lg bg-gray-50 dark:bg-navy-800">
                    <p className="text-lg font-bold text-gold-600 dark:text-gold-400">{s.value}</p>
                    <p className="text-xs text-gray-500 dark:text-navy-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {result.crmSnapshot.topLocations?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-navy-400 mb-2">
                    {isAr ? 'أكثر المناطق نشاطاً في CRM:' : 'Most active CRM areas:'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.crmSnapshot.topLocations.map(loc => (
                      <span key={loc.name} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs
                                                       bg-navy-100 text-navy-800 dark:bg-navy-800 dark:text-navy-200">
                        <span className="font-semibold">{loc.name}</span>
                        <span className="text-navy-400">·</span>
                        <span>{loc.total}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card p-5 border-l-4 border-gold-500">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                {isAr ? 'التوصية التسويقية' : 'Marketing Recommendation'}
              </h3>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-navy-200 font-sans leading-relaxed
                            bg-gray-50 dark:bg-navy-800/50 p-4 rounded-xl">
              {result.recommendation}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Source Performance
// ─────────────────────────────────────────────────────────────────────────────
function SourcePerformance({ lang }) {
  const isAr = lang === 'ar'
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: leads } = await supabase
        .from('leads')
        .select('source, status, ai_score, type, created_at')

      if (!leads) { setLoading(false); return }

      const SOURCES = ['olx_dubizzle', 'aqarmap', 'meta', 'whatsapp', 'manual']

      const rows = SOURCES.map(src => {
        const sl     = leads.filter(l => l.source === src)
        const won    = sl.filter(l => l.status === 'closed_won').length
        const scores = sl.filter(l => l.ai_score).map(l => l.ai_score)
        return {
          source:   src,
          name:     SOURCE_NAMES[src]?.[lang] || src,
          total:    sl.length,
          buyers:   sl.filter(l => l.type === 'buyer').length,
          sellers:  sl.filter(l => l.type === 'seller').length,
          won,
          convRate: sl.length ? Math.round((won / sl.length) * 100) : 0,
          avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        }
      }).filter(r => r.total > 0).sort((a, b) => b.total - a.total)

      // Weekly trend — last 6 weeks
      const trend = []
      for (let i = 5; i >= 0; i--) {
        const end   = new Date(); end.setDate(end.getDate() - i * 7)
        const start = new Date(end); start.setDate(start.getDate() - 7)
        const entry = { week: `W${6 - i}` }
        for (const src of SOURCES) {
          entry[src] = leads.filter(l => {
            const d = new Date(l.created_at)
            return l.source === src && d >= start && d <= end
          }).length
        }
        trend.push(entry)
      }

      setData({ rows, trend })
      setLoading(false)
    }
    load()
  }, [lang])

  if (loading) return <LoadingSpinner size="lg" className="py-12" />

  return (
    <div className="space-y-5">
      <Section icon={TrendingUp} title={isAr ? 'مقارنة أداء المصادر' : 'Source Performance Comparison'}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-navy-800">
                {[
                  isAr ? 'المصدر' : 'Source',
                  isAr ? 'الإجمالي' : 'Total',
                  isAr ? 'مشترون' : 'Buyers',
                  isAr ? 'بائعون' : 'Sellers',
                  isAr ? 'مغلقة' : 'Won',
                  isAr ? 'معدل التحويل' : 'Conv. Rate',
                  isAr ? 'متوسط AI' : 'Avg Score',
                  isAr ? 'الجودة' : 'Quality',
                ].map(h => (
                  <th key={h} className="pb-2 text-start text-xs font-semibold text-gray-400 dark:text-navy-500 pe-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-navy-800">
              {(data?.rows || []).map((row, i) => (
                <tr key={row.source} className={i === 0 ? 'bg-gold-50 dark:bg-gold-900/10' : ''}>
                  <td className="py-3 pe-3 font-semibold text-gray-800 dark:text-white">
                    {i === 0 && <span className="me-1">🥇</span>}{row.name}
                  </td>
                  <td className="py-3 pe-3 font-bold text-gray-700 dark:text-navy-200">{row.total}</td>
                  <td className="py-3 pe-3 text-blue-600 dark:text-blue-400">{row.buyers}</td>
                  <td className="py-3 pe-3 text-pink-600 dark:text-pink-400">{row.sellers}</td>
                  <td className="py-3 pe-3 text-green-600 dark:text-green-400 font-semibold">{row.won}</td>
                  <td className="py-3 pe-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      row.convRate >= 15 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      row.convRate >= 5  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                           'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    }`}>{row.convRate}%</span>
                  </td>
                  <td className="py-3 pe-3 text-gray-600 dark:text-navy-300">{row.avgScore || '—'}</td>
                  <td className="py-3">
                    <div className="w-20 h-1.5 bg-gray-100 dark:bg-navy-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${Math.min(row.convRate * 3, 100)}%`,
                                 backgroundColor: row.convRate >= 15 ? '#10b981' : row.convRate >= 5 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                  </td>
                </tr>
              ))}
              {(!data?.rows || data.rows.length === 0) && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-400 dark:text-navy-500 text-sm">
                  {isAr ? 'لا توجد بيانات بعد' : 'No data yet'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {data?.trend && (
        <Section icon={BarChart3} title={isAr ? 'الاتجاه الأسبوعي حسب المصدر' : 'Weekly Trend by Source'}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend iconSize={10} />
              {['meta', 'whatsapp', 'olx_dubizzle', 'aqarmap'].map((src, i) => (
                <Line key={src} type="monotone" dataKey={src}
                  name={src} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: Meta Ads Monitor
// ─────────────────────────────────────────────────────────────────────────────
function MetaAdsMonitor({ lang }) {
  const isAr = lang === 'ar'
  const { settings, loading: sLoading } = useSettings()
  const [campaigns, setCampaigns] = useState(null)
  const [fetching, setFetching]   = useState(false)
  const [error, setError]         = useState('')

  const fetchCampaigns = async () => {
    const token       = settings.meta_api_token
    const adAccountId = settings.meta_ad_account_id
    if (!token || !adAccountId) {
      setError(isAr
        ? 'يرجى إضافة Meta API Token و Ad Account ID في الإعدادات أولاً.'
        : 'Please add your Meta API Token and Ad Account ID in Settings first.')
      return
    }
    setFetching(true)
    setError('')
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/act_${adAccountId}/campaigns` +
        `?fields=name,status,objective,insights{impressions,clicks,spend,reach,actions}` +
        `&access_token=${token}`
      )
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error?.message || 'Meta API error')
      setCampaigns(json.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    if (!sLoading && settings.meta_api_token) fetchCampaigns()
  }, [sLoading])

  if (sLoading) return <LoadingSpinner size="md" className="py-8" />

  const hasKeys = settings.meta_api_token && settings.meta_ad_account_id

  return (
    <Section
      icon={BarChart3}
      title={isAr ? 'مراقب إعلانات ميتا' : 'Meta Ads Monitor'}
      action={hasKeys && (
        <button onClick={fetchCampaigns} disabled={fetching}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
                     bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100 transition-colors">
          <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
          {isAr ? 'تحديث' : 'Refresh'}
        </button>
      )}
    >
      {!hasKeys ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle size={32} className="text-amber-400" />
          <p className="text-sm text-gray-600 dark:text-navy-300">
            {isAr
              ? 'يرجى إضافة Meta API Token و Ad Account ID في الإعدادات لعرض بيانات الإعلانات.'
              : 'Add your Meta API Token and Ad Account ID in Settings to see campaign data.'}
          </p>
          <a href="/settings" className="text-xs text-gold-500 hover:underline flex items-center gap-1">
            {isAr ? 'الذهاب للإعدادات' : 'Go to Settings'} <ExternalLink size={11} />
          </a>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : fetching ? (
        <LoadingSpinner size="md" className="py-8" />
      ) : campaigns && campaigns.length === 0 ? (
        <p className="text-sm text-center text-gray-400 dark:text-navy-500 py-8">
          {isAr ? 'لا توجد حملات نشطة' : 'No active campaigns found'}
        </p>
      ) : campaigns ? (
        <div className="space-y-3">
          {campaigns.map(c => {
            const ins    = c.insights?.data?.[0] || {}
            const spend  = Number(ins.spend || 0)
            const leadsAction = (ins.actions || []).find(a => a.action_type === 'lead')
            const leadsCount  = leadsAction ? Number(leadsAction.value) : 0
            const cpl    = leadsCount > 0 ? Math.round(spend / leadsCount) : null
            return (
              <div key={c.id} className="p-4 rounded-xl border border-gray-100 dark:border-navy-700 bg-gray-50 dark:bg-navy-800/50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-gray-800 dark:text-white">{c.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-navy-700 dark:text-navy-400'
                  }`}>{c.status}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: isAr ? 'إنفاق' : 'Spend',            value: spend ? `${spend} EGP` : '—' },
                    { label: isAr ? 'مرات الظهور' : 'Impressions', value: Number(ins.impressions || 0).toLocaleString() || '—' },
                    { label: isAr ? 'عملاء' : 'Leads',            value: leadsCount || '—' },
                    { label: isAr ? 'تكلفة/عميل' : 'Cost/Lead',   value: cpl ? `${cpl} EGP` : '—' },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-white dark:bg-navy-900">
                      <p className="text-sm font-bold text-gold-600 dark:text-gold-400">{s.value}</p>
                      <p className="text-xs text-gray-400 dark:text-navy-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4: Weekly Insights
// ─────────────────────────────────────────────────────────────────────────────
function WeeklyInsights({ lang }) {
  const isAr = lang === 'ar'
  const [report, setReport]   = useState('')
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState(null)

  const generate = async () => {
    setLoading(true)
    try {
      const data = await invokeFunction('ai-report', { period: 'week', lang })
      setReport(data.report || '')
      setLastRun(new Date())
    } catch (err) {
      toast.error(err.message || 'Error generating report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section
      icon={Sparkles}
      title={isAr ? 'الرؤى التسويقية الأسبوعية' : 'Weekly Marketing Insights'}
      action={
        <button onClick={generate} disabled={loading}
          className="btn-gold text-xs px-3 py-1.5 flex items-center gap-1.5">
          {loading
            ? <><span className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin" /> {isAr ? 'جاري...' : 'Loading...'}</>
            : <><Sparkles size={12} /> {isAr ? 'توليد التقرير' : 'Generate Report'}</>
          }
        </button>
      }
    >
      {!report && !loading && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Sparkles size={40} className="text-gold-400 opacity-50" />
          <p className="text-sm text-gray-400 dark:text-navy-500">
            {isAr
              ? 'اضغط على "توليد التقرير" لتحليل أداء التسويق هذا الأسبوع'
              : 'Click "Generate Report" to analyze this week\'s marketing performance'}
          </p>
        </div>
      )}
      {loading && <LoadingSpinner size="md" className="py-10" />}
      {report && (
        <div className="space-y-3">
          {lastRun && (
            <p className="text-xs text-gray-400 dark:text-navy-500">
              {isAr ? 'آخر تحديث:' : 'Last updated:'} {lastRun.toLocaleTimeString()}
            </p>
          )}
          <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-navy-200 font-sans leading-relaxed
                          bg-gray-50 dark:bg-navy-800/50 p-5 rounded-xl border border-gray-100 dark:border-navy-700">
            {report}
          </pre>
        </div>
      )}
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5: Budget Recommendations
// ─────────────────────────────────────────────────────────────────────────────
function BudgetRecommendations({ lang }) {
  const isAr = lang === 'ar'
  const [totalBudget, setTotalBudget] = useState(5000)
  const [leads, setLeads]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('leads').select('source, status, ai_score')
      .then(({ data }) => { setLeads(data || []); setLoading(false) })
  }, [])

  if (loading) return <LoadingSpinner size="md" className="py-8" />

  const SOURCES = ['olx_dubizzle', 'aqarmap', 'meta', 'whatsapp']

  const sourceScores = SOURCES.map(src => {
    const sl     = leads.filter(l => l.source === src)
    const won    = sl.filter(l => l.status === 'closed_won').length
    const scores = sl.filter(l => l.ai_score).map(l => l.ai_score)
    const convR  = sl.length ? won / sl.length : 0
    const avgS   = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const quality = convR * 60 + (avgS / 10) * 40
    return { src, name: SOURCE_NAMES[src]?.[lang] || src, quality, total: sl.length, won }
  }).filter(s => s.total > 0)

  const totalQuality = sourceScores.reduce((a, s) => a + s.quality, 0) || 1

  const allocations = sourceScores.map(s => ({
    ...s,
    pct:    Math.round((s.quality / totalQuality) * 100),
    budget: Math.round((s.quality / totalQuality) * totalBudget),
  })).sort((a, b) => b.pct - a.pct)

  return (
    <Section icon={DollarSign} title={isAr ? 'محرك توصيات الميزانية' : 'Budget Recommendation Engine'}>
      <p className="text-xs text-gray-500 dark:text-navy-400">
        {isAr
          ? 'التوزيع مبني على معدلات التحويل ودرجات AI الفعلية لكل مصدر في CRM.'
          : 'Allocation based on actual conversion rates and AI scores per source in your CRM.'}
      </p>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-navy-300 shrink-0">
          {isAr ? 'الميزانية الشهرية (جنيه):' : 'Monthly Budget (EGP):'}
        </label>
        <input type="number" value={totalBudget} onChange={e => setTotalBudget(Number(e.target.value) || 0)}
          className="w-32 px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700
                     bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-gold-500" dir="ltr" />
      </div>

      {allocations.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-navy-500 text-center py-4">
          {isAr ? 'لا توجد بيانات كافية بعد.' : 'Not enough data yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {allocations.map((a, i) => (
            <div key={a.src} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {i === 0 && <span>⭐</span>}
                  <span className="font-semibold text-gray-800 dark:text-white">{a.name}</span>
                  <span className="text-xs text-gray-400 dark:text-navy-500">
                    ({a.total} {isAr ? 'عميل' : 'leads'}, {a.won} {isAr ? 'مغلقة' : 'won'})
                  </span>
                </div>
                <div className="text-end">
                  <span className="font-bold text-gold-600 dark:text-gold-400">
                    {a.budget.toLocaleString()} EGP
                  </span>
                  <span className="text-xs text-gray-400 dark:text-navy-500 ms-1">({a.pct}%)</span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-navy-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${a.pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-navy-800 text-sm font-semibold">
            <span className="text-gray-700 dark:text-navy-200">{isAr ? 'الإجمالي' : 'Total'}</span>
            <span className="text-gold-600 dark:text-gold-400">{totalBudget.toLocaleString()} EGP</span>
          </div>

          <div className="p-3 rounded-xl bg-navy-50 dark:bg-navy-800/50 border border-navy-100 dark:border-navy-700">
            <p className="text-xs font-semibold text-navy-600 dark:text-navy-300 mb-2">
              {isAr ? 'الميزانية اليومية الموصى بها:' : 'Recommended daily budget:'}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {allocations.map(a => (
                <div key={a.src} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-navy-400">{a.name}</span>
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {Math.round(a.budget / 30)} EGP/{isAr ? 'يوم' : 'day'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function MarketingBrain() {
  const { lang } = useLang()
  const [tab, setTab] = useState('launch')
  const isAr = lang === 'ar'

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ key, icon: Icon, ar, en }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === key
                ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-md'
                : 'card text-gray-600 dark:text-navy-300 hover:bg-gray-100 dark:hover:bg-navy-800'
            }`}>
            <Icon size={15} />
            {isAr ? ar : en}
          </button>
        ))}
      </div>

      <div>
        {tab === 'launch'   && <CampaignLauncher     lang={lang} />}
        {tab === 'sources'  && <SourcePerformance    lang={lang} />}
        {tab === 'meta'     && <MetaAdsMonitor        lang={lang} />}
        {tab === 'insights' && <WeeklyInsights         lang={lang} />}
        {tab === 'budget'   && <BudgetRecommendations  lang={lang} />}
      </div>
    </div>
  )
}
