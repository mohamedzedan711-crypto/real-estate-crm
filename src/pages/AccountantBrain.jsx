import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Calculator, TrendingUp, TrendingDown, Wallet, List, MessageSquare,
  Check, X, Trash2, Send, RefreshCw
} from 'lucide-react'
import { supabase, invokeFunction } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/shared/LoadingSpinner'

// ── Category labels ──────────────────────────────────────────────────────────
const INCOME_CATS = {
  property_sale:        { ar: 'بيع عقار',          en: 'Property Sale' },
  brokerage_commission: { ar: 'عمولة سمسرة',        en: 'Brokerage Commission' },
  rental_income:        { ar: 'دخل إيجار',          en: 'Rental Income' },
  other_income:         { ar: 'دخل آخر',            en: 'Other Income' },
}
const EXPENSE_CATS = {
  property_purchase:      { ar: 'شراء عقار',          en: 'Property Purchase' },
  renovation_maintenance: { ar: 'تجديد وصيانة',       en: 'Renovation & Maintenance' },
  marketing_ads:          { ar: 'تسويق وإعلانات',     en: 'Marketing & Ads' },
  salaries:               { ar: 'رواتب',              en: 'Salaries' },
  agent_commission:       { ar: 'عمولة وكيل',         en: 'Agent Commission' },
  office_overhead:        { ar: 'مصاريف مكتب',        en: 'Office & Overhead' },
  other_expense:          { ar: 'مصروف آخر',          en: 'Other Expense' },
}
const ALL_CATS = { ...INCOME_CATS, ...EXPENSE_CATS }

const COLORS_INC = ['#10b981','#f59e0b','#3b82f6','#8b5cf6']
const COLORS_EXP = ['#ef4444','#f97316','#ec4899','#84cc16','#06b6d4','#a78bfa','#94a3b8']

const TABS = [
  { key: 'chat',     ar: 'المحادثة',      en: 'Chat',     Icon: MessageSquare },
  { key: 'overview', ar: 'النظرة العامة', en: 'Overview', Icon: Wallet },
  { key: 'entries',  ar: 'كشف القيود',    en: 'Entries',  Icon: List },
]

function fmt(n) {
  return Number(n || 0).toLocaleString('ar-EG')
}

function catLabel(key, lang) {
  return ALL_CATS[key]?.[lang === 'ar' ? 'ar' : 'en'] || key
}

export default function AccountantBrain() {
  const { lang } = useLang()
  const { profile } = useAuth()
  const isAr    = lang === 'ar'
  const isAdmin = profile?.role === 'admin'

  const [tab, setTab] = useState('chat')

  // ── Chat state ─────────────────────────────────────────────────────────────
  const chatEndRef = useRef(null)
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: isAr
      ? 'مرحباً! أنا مساعدك المحاسبي. أخبرني عن أي معاملة مالية وسأسجلها لك.\n\nمثلاً:\n• "اشترينا شقة في المهندسين بـ 3 مليون"\n• "عمولة سمسرة 50 ألف على صفقة ماضي"\n• "دفعنا رواتب الشهر 85 ألف"'
      : 'Hello! I\'m your accounting assistant. Tell me about any financial transaction.\n\nExamples:\n• "Bought apartment in Maadi for 2.5M"\n• "Brokerage commission 45,000 EGP for New Cairo deal"\n• "Paid salaries this month: 95,000 EGP"',
  }])
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const [pendingEntries, setPendingEntries] = useState(null)

  // ── Financial data state ───────────────────────────────────────────────────
  const [balance, setBalance]             = useState(null)
  const [startingCapital, setStartingCapital] = useState(0)
  const [capitalInput, setCapitalInput]   = useState('')
  const [savingCapital, setSavingCapital] = useState(false)
  const [entries, setEntries]             = useState([])
  const [dataLoading, setDataLoading]     = useState(false)

  // ── Entries filter state ───────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingEntries, sending])

  // Load balance on mount (lightweight — just for the header)
  useEffect(() => { loadBalance() }, [])

  // Load full entries when switching to non-chat tabs
  useEffect(() => {
    if (tab !== 'chat') loadEntries()
  }, [tab])

  async function loadBalance() {
    try {
      const [{ data: cap }, { data: inc }, { data: exp }] = await Promise.all([
        supabase.from('settings').select('value').eq('key','starting_capital').single(),
        supabase.from('financial_entries').select('amount').eq('type','income').eq('confirmed',true),
        supabase.from('financial_entries').select('amount').eq('type','expense').eq('confirmed',true),
      ])
      const start = parseFloat(cap?.value || '0')
      const totalInc = (inc || []).reduce((s, r) => s + Number(r.amount), 0)
      const totalExp = (exp || []).reduce((s, r) => s + Number(r.amount), 0)
      setStartingCapital(start)
      setCapitalInput(String(start))
      setBalance(start + totalInc - totalExp)
    } catch {}
  }

  async function loadEntries() {
    setDataLoading(true)
    try {
      const [{ data: rows }, { data: cap }] = await Promise.all([
        supabase.from('financial_entries').select('*').eq('confirmed',true).order('entry_date',{ ascending: false }),
        supabase.from('settings').select('value').eq('key','starting_capital').single(),
      ])
      const all = rows || []
      const start = parseFloat(cap?.value || '0')
      setStartingCapital(start)
      setCapitalInput(String(start))
      setEntries(all)
      const totalInc = all.filter(e => e.type==='income').reduce((s,e) => s+Number(e.amount), 0)
      const totalExp = all.filter(e => e.type==='expense').reduce((s,e) => s+Number(e.amount), 0)
      setBalance(start + totalInc - totalExp)
    } finally {
      setDataLoading(false)
    }
  }

  // ── Chat handlers ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const userMsg = input.trim()
    setInput('')
    setSending(true)

    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)

    try {
      const history = newMessages.slice(1, -1).map(m => ({ role: m.role, content: m.content }))
      const data = await invokeFunction('accountant-ai', { action:'parse', message: userMsg, history, lang })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (data.pendingEntries?.length > 0) setPendingEntries(data.pendingEntries)
    } catch (err) {
      const errMsg = isAr ? 'حدث خطأ، حاول مرة أخرى.' : 'An error occurred. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
      toast.error(err.message || errMsg)
    } finally {
      setSending(false)
    }
  }

  const confirmEntries = async () => {
    if (!pendingEntries) return
    setSending(true)
    try {
      const data = await invokeFunction('accountant-ai', { action:'confirm', entries: pendingEntries, lang })
      setPendingEntries(null)
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (data.newBalance !== undefined) setBalance(data.newBalance)
    } catch (err) {
      toast.error(err.message || (isAr ? 'خطأ في التسجيل' : 'Failed to log entries'))
    } finally {
      setSending(false)
    }
  }

  const cancelPending = () => {
    setPendingEntries(null)
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: isAr ? 'تم إلغاء القيد. كيف يمكنني مساعدتك؟' : 'Entry cancelled. How can I help you?'
    }])
  }

  const deleteEntry = async (id) => {
    if (!window.confirm(isAr ? 'حذف هذا القيد؟' : 'Delete this entry?')) return
    try {
      await supabase.from('financial_entries').delete().eq('id', id)
      setEntries(prev => prev.filter(e => e.id !== id))
      await loadBalance()
      toast.success(isAr ? 'تم حذف القيد' : 'Entry deleted')
    } catch {
      toast.error(isAr ? 'خطأ في الحذف' : 'Delete failed')
    }
  }

  const saveStartingCapital = async () => {
    const val = parseFloat(capitalInput)
    if (isNaN(val) || val < 0) { toast.error(isAr ? 'أدخل رقماً صحيحاً' : 'Enter a valid number'); return }
    setSavingCapital(true)
    try {
      await supabase.from('settings').upsert({ key:'starting_capital', value:String(val), updated_at: new Date().toISOString() }, { onConflict:'key' })
      setStartingCapital(val)
      if (tab !== 'chat') await loadEntries(); else await loadBalance()
      toast.success(isAr ? 'تم حفظ رأس المال' : 'Starting capital saved')
    } catch { toast.error(isAr ? 'خطأ' : 'Error') }
    finally { setSavingCapital(false) }
  }

  // ── Derived financial metrics ──────────────────────────────────────────────
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const yearStart  = `${now.getFullYear()}-01-01`

  const monthInc = entries.filter(e => e.type==='income'  && e.entry_date >= monthStart).reduce((s,e) => s+Number(e.amount), 0)
  const monthExp = entries.filter(e => e.type==='expense' && e.entry_date >= monthStart).reduce((s,e) => s+Number(e.amount), 0)
  const yearInc  = entries.filter(e => e.type==='income'  && e.entry_date >= yearStart).reduce((s,e) => s+Number(e.amount), 0)
  const yearExp  = entries.filter(e => e.type==='expense' && e.entry_date >= yearStart).reduce((s,e) => s+Number(e.amount), 0)

  const incPieData = useMemo(() =>
    Object.entries(INCOME_CATS).map(([key, labels], i) => ({
      name: labels[isAr ? 'ar' : 'en'],
      value: entries.filter(e => e.type==='income' && e.category===key).reduce((s,e) => s+Number(e.amount), 0),
      fill: COLORS_INC[i],
    })).filter(d => d.value > 0),
  [entries, lang])

  const expPieData = useMemo(() =>
    Object.entries(EXPENSE_CATS).map(([key, labels], i) => ({
      name: labels[isAr ? 'ar' : 'en'],
      value: entries.filter(e => e.type==='expense' && e.category===key).reduce((s,e) => s+Number(e.amount), 0),
      fill: COLORS_EXP[i],
    })).filter(d => d.value > 0),
  [entries, lang])

  const filteredEntries = useMemo(() =>
    entries.filter(e => {
      if (typeFilter && e.type !== typeFilter) return false
      if (dateFrom && e.entry_date < dateFrom) return false
      if (dateTo   && e.entry_date > dateTo)   return false
      return true
    }),
  [entries, typeFilter, dateFrom, dateTo])

  const flips = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      if (!e.property_reference?.trim()) return
      const key = e.property_reference.toLowerCase().trim()
      if (!map[key]) map[key] = { name: e.property_reference, income: 0, expenses: 0 }
      if (e.type === 'income') map[key].income   += Number(e.amount)
      else                     map[key].expenses += Number(e.amount)
    })
    return Object.values(map)
      .map(f => ({ ...f, profit: f.income - f.expenses }))
      .sort((a, b) => b.profit - a.profit)
  }, [entries])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-gold-500 to-gold-700 shrink-0">
          <Calculator size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {isAr ? 'الدماغ المحاسبي' : 'Accountant Brain'}
          </h1>
          {balance !== null && (
            <p className="text-xs text-gray-400 dark:text-navy-400">
              {isAr ? 'الرصيد: ' : 'Balance: '}
              <span className={`font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {fmt(balance)} EGP
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-navy-800 rounded-xl p-1">
        {TABS.map(({ key, ar, en, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white dark:bg-navy-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-navy-400 hover:text-gray-700 dark:hover:text-navy-200'
            }`}
          >
            <Icon size={14} />
            {isAr ? ar : en}
          </button>
        ))}
      </div>

      {/* ── CHAT TAB ─────────────────────────────────────────────────────── */}
      {tab === 'chat' && (
        <div className="card flex flex-col" style={{ height: '66vh' }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gold-500 text-white rounded-br-sm'
                    : 'bg-gray-50 dark:bg-navy-800 text-gray-800 dark:text-white border border-gray-100 dark:border-navy-700 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Pending entry confirmation card */}
            {pendingEntries && (
              <div className="mb-3 rounded-2xl border-2 border-gold-500 bg-gold-50 dark:bg-gold-900/10 p-4">
                <p className="text-xs font-bold text-gold-700 dark:text-gold-400 mb-3">
                  {isAr ? '⚡ قيد مقترح — راجع وأكد التسجيل' : '⚡ Proposed Entry — Review and confirm'}
                </p>
                <div className="space-y-2 mb-4">
                  {pendingEntries.map((e, i) => (
                    <div key={i} className="bg-white dark:bg-navy-800 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold text-base ${e.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                          {e.type === 'income' ? '↑' : '↓'} {fmt(e.amount)} EGP
                        </span>
                        <span className="text-xs text-gray-400" dir="ltr">{e.entry_date}</span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-white font-medium">{e.description}</p>
                      <p className="text-xs text-gray-400 dark:text-navy-500 mt-0.5">
                        {catLabel(e.category, lang)}
                        {e.property_reference && ` · ${e.property_reference}`}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={confirmEntries} disabled={sending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                    <Check size={15} />
                    {isAr ? 'تسجيل القيد' : 'Log Entry'}
                  </button>
                  <button onClick={cancelPending} disabled={sending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-200 dark:bg-navy-700 text-gray-600 dark:text-navy-200 text-sm font-semibold transition-colors disabled:opacity-60">
                    <X size={15} />
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {sending && (
              <div className="flex justify-start mb-3">
                <div className="bg-gray-50 dark:bg-navy-800 border border-gray-100 dark:border-navy-700 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    {[0,150,300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-100 dark:border-navy-800">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={isAr ? 'اكتب معاملة مالية...' : 'Describe a financial transaction...'}
                disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-60"
              />
              <button onClick={sendMessage} disabled={sending || !input.trim()}
                className="px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-white transition-colors disabled:opacity-40">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        dataLoading ? <LoadingSpinner size="lg" className="py-20" /> :
        <div className="space-y-4">

          {/* Balance hero */}
          <div className="card p-6 bg-gradient-to-br from-navy-800 to-navy-950 border-0 text-center">
            <p className="text-navy-400 text-sm mb-1">{isAr ? 'الرصيد الحالي' : 'Current Balance'}</p>
            <p className={`text-5xl font-bold tracking-tight ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(balance)}
            </p>
            <p className="text-navy-400 text-lg mt-1">EGP</p>
            <p className="text-navy-500 text-xs mt-3">
              {isAr ? `رأس المال الأولي: ${fmt(startingCapital)} EGP` : `Starting capital: ${fmt(startingCapital)} EGP`}
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: isAr ? 'دخل الشهر'    : 'Monthly Income',   val: monthInc,           positive: true,              Icon: TrendingUp },
              { label: isAr ? 'مصروف الشهر'  : 'Monthly Expenses', val: monthExp,           positive: false,             Icon: TrendingDown },
              { label: isAr ? 'صافي الشهر'   : 'Monthly Net',      val: monthInc - monthExp, positive: monthInc>=monthExp, Icon: Wallet },
              { label: isAr ? 'دخل السنة'    : 'Yearly Income',    val: yearInc,            positive: true,              Icon: TrendingUp },
              { label: isAr ? 'مصروف السنة'  : 'Yearly Expenses',  val: yearExp,            positive: false,             Icon: TrendingDown },
              { label: isAr ? 'صافي السنة'   : 'Yearly Net',       val: yearInc - yearExp,  positive: yearInc>=yearExp,  Icon: Wallet },
            ].map(({ label, val, positive, Icon }) => (
              <div key={label} className="card p-4 text-center">
                <Icon size={16} className={`mx-auto mb-1.5 ${positive ? 'text-green-500' : 'text-red-500'}`} />
                <p className="text-xs text-gray-500 dark:text-navy-400 mb-1">{label}</p>
                <p className={`text-lg font-bold ${positive ? 'text-green-500' : 'text-red-500'}`}>{fmt(val)}</p>
                <p className="text-xs text-gray-400">EGP</p>
              </div>
            ))}
          </div>

          {/* Pie charts */}
          {(incPieData.length > 0 || expPieData.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incPieData.length > 0 && (
                <div className="card p-4">
                  <p className="text-xs font-semibold text-gray-600 dark:text-navy-300 mb-3">
                    {isAr ? 'توزيع الدخل' : 'Income Breakdown'}
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={incPieData} cx="50%" cy="50%" outerRadius={68} dataKey="value" stroke="none">
                        {incPieData.map((d,i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip formatter={v => [`${fmt(v)} EGP`]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {incPieData.map((d,i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-gray-500 dark:text-navy-400">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                        {d.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {expPieData.length > 0 && (
                <div className="card p-4">
                  <p className="text-xs font-semibold text-gray-600 dark:text-navy-300 mb-3">
                    {isAr ? 'توزيع المصروفات' : 'Expense Breakdown'}
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={expPieData} cx="50%" cy="50%" outerRadius={68} dataKey="value" stroke="none">
                        {expPieData.map((d,i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip formatter={v => [`${fmt(v)} EGP`]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {expPieData.map((d,i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-gray-500 dark:text-navy-400">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                        {d.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Property Flips */}
          {flips.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-navy-300 mb-3">
                {isAr ? 'تتبع العقارات (تفليب)' : 'Property Flip Tracker'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-navy-800 text-xs text-gray-400">
                      <th className="pb-2 text-start pe-4">{isAr ? 'العقار' : 'Property'}</th>
                      <th className="pb-2 text-end pe-4">{isAr ? 'تكلفة' : 'Cost'}</th>
                      <th className="pb-2 text-end pe-4">{isAr ? 'عائد' : 'Revenue'}</th>
                      <th className="pb-2 text-end">{isAr ? 'الربح' : 'Profit'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flips.map((f,i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-navy-800 last:border-0">
                        <td className="py-2 pe-4 font-medium text-gray-800 dark:text-white">{f.name}</td>
                        <td className="py-2 pe-4 text-end text-red-500 text-sm">{fmt(f.expenses)}</td>
                        <td className="py-2 pe-4 text-end text-green-500 text-sm">{fmt(f.income)}</td>
                        <td className={`py-2 text-end font-bold text-sm ${f.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {f.profit >= 0 ? '+' : ''}{fmt(f.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Starting capital — admin only */}
          {isAdmin && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-navy-300 mb-3">
                {isAr ? 'رأس المال الأولي للشركة' : 'Company Starting Capital'}
              </p>
              <div className="flex gap-2 max-w-sm">
                <input
                  type="number"
                  value={capitalInput}
                  onChange={e => setCapitalInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                  dir="ltr"
                  placeholder="0"
                />
                <span className="self-center text-sm text-gray-400">EGP</span>
                <button onClick={saveStartingCapital} disabled={savingCapital}
                  className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                  {savingCapital ? '...' : (isAr ? 'حفظ' : 'Save')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ENTRIES TAB ──────────────────────────────────────────────────── */}
      {tab === 'entries' && (
        dataLoading ? <LoadingSpinner size="lg" className="py-20" /> :
        <div className="card p-4">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500">
              <option value="">{isAr ? 'الكل' : 'All Types'}</option>
              <option value="income">{isAr ? 'دخل' : 'Income'}</option>
              <option value="expense">{isAr ? 'مصروف' : 'Expense'}</option>
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              title={isAr ? 'من تاريخ' : 'From date'}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
              dir="ltr" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              title={isAr ? 'إلى تاريخ' : 'To date'}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
              dir="ltr" />
            {(typeFilter || dateFrom || dateTo) && (
              <button onClick={() => { setTypeFilter(''); setDateFrom(''); setDateTo('') }}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-navy-700 text-gray-600 dark:text-navy-300 hover:bg-gray-200">
                {isAr ? 'مسح' : 'Clear'}
              </button>
            )}
            <button onClick={loadEntries} className="ms-auto p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-700 text-gray-400">
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Totals bar */}
          <div className="flex gap-4 mb-3 text-xs font-semibold">
            <span className="text-green-500">
              {isAr ? 'دخل: ' : 'Income: '}
              {fmt(filteredEntries.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0))} EGP
            </span>
            <span className="text-red-500">
              {isAr ? 'مصروف: ' : 'Expenses: '}
              {fmt(filteredEntries.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0))} EGP
            </span>
            <span className="text-gray-400">
              {isAr ? `${filteredEntries.length} قيد` : `${filteredEntries.length} entries`}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-navy-800 text-xs text-gray-400 dark:text-navy-500">
                  <th className="pb-2 text-start pe-3 font-semibold">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="pb-2 text-start pe-3 font-semibold">{isAr ? 'الوصف' : 'Description'}</th>
                  <th className="pb-2 text-start pe-3 font-semibold">{isAr ? 'الفئة' : 'Category'}</th>
                  <th className="pb-2 text-start pe-3 font-semibold">{isAr ? 'العقار' : 'Property'}</th>
                  <th className="pb-2 text-end font-semibold">{isAr ? 'المبلغ (EGP)' : 'Amount (EGP)'}</th>
                  {isAdmin && <th className="pb-2 ps-2 text-end font-semibold">&nbsp;</th>}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-sm text-gray-400 dark:text-navy-500">
                      {isAr ? 'لا توجد قيود' : 'No entries found'}
                    </td>
                  </tr>
                ) : filteredEntries.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 dark:border-navy-800 last:border-0 hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                    <td className="py-2.5 pe-3 text-xs text-gray-400 whitespace-nowrap" dir="ltr">{e.entry_date}</td>
                    <td className="py-2.5 pe-3 text-gray-800 dark:text-white max-w-[180px] truncate" title={e.description}>{e.description || '—'}</td>
                    <td className="py-2.5 pe-3 text-xs text-gray-500 dark:text-navy-400 whitespace-nowrap">{catLabel(e.category, lang)}</td>
                    <td className="py-2.5 pe-3 text-xs text-gray-400 max-w-[100px] truncate">{e.property_reference || '—'}</td>
                    <td className={`py-2.5 text-end font-bold whitespace-nowrap text-sm ${e.type==='income' ? 'text-green-500' : 'text-red-500'}`}>
                      {e.type === 'income' ? '+' : '-'}{fmt(e.amount)}
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 ps-2 text-end">
                        <button onClick={() => deleteEntry(e.id)}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
