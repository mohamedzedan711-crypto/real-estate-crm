import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Calculator, TrendingUp, TrendingDown, Wallet, List, MessageSquare,
  Check, X, Trash2, Send, RefreshCw, Table2, ArrowUpDown, ArrowUp,
  ArrowDown, Download
} from 'lucide-react'
import * as XLSX from 'xlsx'
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
  { key: 'chat',        ar: 'المحادثة',      en: 'Chat',            Icon: MessageSquare },
  { key: 'overview',    ar: 'النظرة العامة', en: 'Overview',        Icon: Wallet },
  { key: 'entries',     ar: 'كشف القيود',    en: 'Entries',         Icon: List },
  { key: 'spreadsheet', ar: 'الجدول',        en: 'Spreadsheet View', Icon: Table2 },
]

function fmt(n) {
  return Number(n || 0).toLocaleString('ar-EG')
}

function catLabel(key, lang) {
  return ALL_CATS[key]?.[lang === 'ar' ? 'ar' : 'en'] || key
}

// Sort icon helper
function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ArrowUpDown size={11} className="opacity-40" />
  return sortDir === 'asc'
    ? <ArrowUp size={11} className="text-gold-400" />
    : <ArrowDown size={11} className="text-gold-400" />
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

  // ── Entries tab filter state ───────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')

  // ── Spreadsheet tab state ──────────────────────────────────────────────────
  const [ssCatFilter,  setSsCatFilter]  = useState('')
  const [ssDateFrom,   setSsDateFrom]   = useState('')
  const [ssDateTo,     setSsDateTo]     = useState('')
  const [ssSortBy,     setSsSortBy]     = useState('date')
  const [ssSortDir,    setSsSortDir]    = useState('asc')

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingEntries, sending])

  useEffect(() => { loadBalance() }, [])

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
      await supabase.from('settings').upsert(
        { key:'starting_capital', value:String(val), updated_at: new Date().toISOString() },
        { onConflict:'key' }
      )
      setStartingCapital(val)
      if (tab !== 'chat') await loadEntries(); else await loadBalance()
      toast.success(isAr ? 'تم حفظ رأس المال' : 'Starting capital saved')
    } catch { toast.error(isAr ? 'خطأ' : 'Error') }
    finally { setSavingCapital(false) }
  }

  // ── Column sort handler (spreadsheet tab) ──────────────────────────────────
  const handleSort = useCallback((col) => {
    setSsSortBy(prev => {
      if (prev === col) { setSsSortDir(d => d === 'asc' ? 'desc' : 'asc'); return col }
      setSsSortDir('asc')
      return col
    })
  }, [])

  // ── Derived financial metrics (overview) ───────────────────────────────────
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

  // ── Spreadsheet data ───────────────────────────────────────────────────────
  // Step 1: sort all entries by date asc and compute running balance
  const ssWithBalance = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    let running = startingCapital
    return sorted.map(e => {
      running += e.type === 'income' ? Number(e.amount) : -Number(e.amount)
      return { ...e, runningBalance: running }
    })
  }, [entries, startingCapital])

  // Step 2: apply spreadsheet filters
  const ssFiltered = useMemo(() =>
    ssWithBalance.filter(e => {
      if (ssCatFilter  && e.category    !== ssCatFilter)  return false
      if (ssDateFrom   && e.entry_date  <  ssDateFrom)    return false
      if (ssDateTo     && e.entry_date  >  ssDateTo)      return false
      return true
    }),
  [ssWithBalance, ssCatFilter, ssDateFrom, ssDateTo])

  // Step 3: apply column sort
  const ssSorted = useMemo(() => {
    if (!ssSortBy) return ssFiltered
    return [...ssFiltered].sort((a, b) => {
      let va, vb
      if      (ssSortBy === 'date')    { va = a.entry_date;       vb = b.entry_date }
      else if (ssSortBy === 'amount')  { va = Number(a.amount);   vb = Number(b.amount) }
      else if (ssSortBy === 'balance') { va = a.runningBalance;   vb = b.runningBalance }
      else if (ssSortBy === 'type')    { va = a.type;             vb = b.type }
      else if (ssSortBy === 'cat')     { va = a.category;         vb = b.category }
      else                             { va = (a[ssSortBy]||'');  vb = (b[ssSortBy]||'') }
      if (va < vb) return ssSortDir === 'asc' ? -1 : 1
      if (va > vb) return ssSortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [ssFiltered, ssSortBy, ssSortDir])

  // Spreadsheet summary totals
  const ssTotalInc = ssFiltered.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0)
  const ssTotalExp = ssFiltered.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0)
  const ssNet      = ssTotalInc - ssTotalExp

  // Category pivot
  const catPivot = useMemo(() => {
    const incRows = Object.entries(INCOME_CATS).map(([key, lbl]) => ({
      key, label: lbl[isAr ? 'ar' : 'en'], type: 'income',
      total: ssFiltered.filter(e=>e.category===key).reduce((s,e)=>s+Number(e.amount),0),
    })).filter(r => r.total > 0)
    const expRows = Object.entries(EXPENSE_CATS).map(([key, lbl]) => ({
      key, label: lbl[isAr ? 'ar' : 'en'], type: 'expense',
      total: ssFiltered.filter(e=>e.category===key).reduce((s,e)=>s+Number(e.amount),0),
    })).filter(r => r.total > 0)
    return { income: incRows, expense: expRows }
  }, [ssFiltered, lang])

  // Export to Excel
  const exportToExcel = () => {
    const L = (ar, en) => isAr ? ar : en
    const rows = ssSorted.map(e => ({
      [L('التاريخ','Date')]:                   e.entry_date,
      [L('النوع','Type')]:                     e.type === 'income' ? L('دخل','Income') : L('مصروف','Expense'),
      [L('الفئة','Category')]:                 catLabel(e.category, lang),
      [L('الوصف','Description')]:              e.description || '',
      [L('العقار','Property')]:                e.property_reference || '',
      [L('المبلغ (EGP)','Amount (EGP)')]:      Number(e.amount),
      [L('الرصيد التراكمي','Running Balance')]: e.runningBalance,
    }))

    // Blank separator + summary
    rows.push({})
    rows.push({ [L('التاريخ','Date')]: `=== ${L('الملخص','SUMMARY')} ===` })
    rows.push({ [L('التاريخ','Date')]: L('إجمالي الدخل','Total Income'),     [L('المبلغ (EGP)','Amount (EGP)')]: ssTotalInc })
    rows.push({ [L('التاريخ','Date')]: L('إجمالي المصروفات','Total Expenses'), [L('المبلغ (EGP)','Amount (EGP)')]: ssTotalExp })
    rows.push({ [L('التاريخ','Date')]: L('صافي الربح / الخسارة','Net Profit / Loss'), [L('المبلغ (EGP)','Amount (EGP)')]: ssNet })
    rows.push({ [L('التاريخ','Date')]: L('الرصيد الحالي','Current Balance'), [L('المبلغ (EGP)','Amount (EGP)')]: startingCapital + ssNet })

    // Category pivot
    rows.push({})
    rows.push({ [L('التاريخ','Date')]: `=== ${L('تفصيل الفئات','CATEGORY BREAKDOWN')} ===` })
    ;[...catPivot.income, ...catPivot.expense].forEach(r => {
      rows.push({
        [L('التاريخ','Date')]:            r.label,
        [L('النوع','Type')]:              r.type === 'income' ? L('دخل','Income') : L('مصروف','Expense'),
        [L('المبلغ (EGP)','Amount (EGP)')]: r.total,
      })
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    // Column widths
    ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, L('السجل المالي','Financial Ledger'))
    XLSX.writeFile(wb, `ledger_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success(L('تم تصدير الملف','Exported successfully'))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-4">

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
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white dark:bg-navy-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-navy-400 hover:text-gray-700 dark:hover:text-navy-200'
            }`}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{isAr ? ar : en}</span>
            <span className="sm:hidden">{isAr ? ar : en}</span>
          </button>
        ))}
      </div>

      {/* ── CHAT TAB ─────────────────────────────────────────────────────── */}
      {tab === 'chat' && (
        <div className="card flex flex-col" style={{ height: '66vh' }}>
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
                    <Check size={15} />{isAr ? 'تسجيل القيد' : 'Log Entry'}
                  </button>
                  <button onClick={cancelPending} disabled={sending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-200 dark:bg-navy-700 text-gray-600 dark:text-navy-200 text-sm font-semibold transition-colors disabled:opacity-60">
                    <X size={15} />{isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}

            {sending && (
              <div className="flex justify-start mb-3">
                <div className="bg-gray-50 dark:bg-navy-800 border border-gray-100 dark:border-navy-700 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    {[0,150,300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
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
          <div className="card p-6 bg-gradient-to-br from-navy-800 to-navy-950 border-0 text-center">
            <p className="text-navy-400 text-sm mb-1">{isAr ? 'الرصيد الحالي' : 'Current Balance'}</p>
            <p className={`text-5xl font-bold tracking-tight ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(balance)}</p>
            <p className="text-navy-400 text-lg mt-1">EGP</p>
            <p className="text-navy-500 text-xs mt-3">
              {isAr ? `رأس المال الأولي: ${fmt(startingCapital)} EGP` : `Starting capital: ${fmt(startingCapital)} EGP`}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: isAr ? 'دخل الشهر'    : 'Monthly Income',   val: monthInc,           pos: true,             Icon: TrendingUp },
              { label: isAr ? 'مصروف الشهر'  : 'Monthly Expenses', val: monthExp,           pos: false,            Icon: TrendingDown },
              { label: isAr ? 'صافي الشهر'   : 'Monthly Net',      val: monthInc - monthExp, pos: monthInc>=monthExp, Icon: Wallet },
              { label: isAr ? 'دخل السنة'    : 'Yearly Income',    val: yearInc,            pos: true,             Icon: TrendingUp },
              { label: isAr ? 'مصروف السنة'  : 'Yearly Expenses',  val: yearExp,            pos: false,            Icon: TrendingDown },
              { label: isAr ? 'صافي السنة'   : 'Yearly Net',       val: yearInc - yearExp,  pos: yearInc>=yearExp, Icon: Wallet },
            ].map(({ label, val, pos, Icon }) => (
              <div key={label} className="card p-4 text-center">
                <Icon size={16} className={`mx-auto mb-1.5 ${pos ? 'text-green-500' : 'text-red-500'}`} />
                <p className="text-xs text-gray-500 dark:text-navy-400 mb-1">{label}</p>
                <p className={`text-lg font-bold ${pos ? 'text-green-500' : 'text-red-500'}`}>{fmt(val)}</p>
                <p className="text-xs text-gray-400">EGP</p>
              </div>
            ))}
          </div>
          {(incPieData.length > 0 || expPieData.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incPieData.length > 0 && (
                <div className="card p-4">
                  <p className="text-xs font-semibold text-gray-600 dark:text-navy-300 mb-3">{isAr ? 'توزيع الدخل' : 'Income Breakdown'}</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart><Pie data={incPieData} cx="50%" cy="50%" outerRadius={68} dataKey="value" stroke="none">
                      {incPieData.map((d,i) => <Cell key={i} fill={d.fill} />)}
                    </Pie><Tooltip formatter={v => [`${fmt(v)} EGP`]} /></PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {incPieData.map((d,i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-gray-500 dark:text-navy-400">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />{d.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {expPieData.length > 0 && (
                <div className="card p-4">
                  <p className="text-xs font-semibold text-gray-600 dark:text-navy-300 mb-3">{isAr ? 'توزيع المصروفات' : 'Expense Breakdown'}</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart><Pie data={expPieData} cx="50%" cy="50%" outerRadius={68} dataKey="value" stroke="none">
                      {expPieData.map((d,i) => <Cell key={i} fill={d.fill} />)}
                    </Pie><Tooltip formatter={v => [`${fmt(v)} EGP`]} /></PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {expPieData.map((d,i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-gray-500 dark:text-navy-400">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />{d.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {flips.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-navy-300 mb-3">{isAr ? 'تتبع العقارات (تفليب)' : 'Property Flip Tracker'}</p>
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
          {isAdmin && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-navy-300 mb-3">{isAr ? 'رأس المال الأولي للشركة' : 'Company Starting Capital'}</p>
              <div className="flex gap-2 max-w-sm">
                <input type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                  dir="ltr" placeholder="0" />
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
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500">
              <option value="">{isAr ? 'الكل' : 'All Types'}</option>
              <option value="income">{isAr ? 'دخل' : 'Income'}</option>
              <option value="expense">{isAr ? 'مصروف' : 'Expense'}</option>
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} dir="ltr"
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} dir="ltr"
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500" />
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
          <div className="flex gap-4 mb-3 text-xs font-semibold">
            <span className="text-green-500">{isAr ? 'دخل: ' : 'Income: '}{fmt(filteredEntries.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0))} EGP</span>
            <span className="text-red-500">{isAr ? 'مصروف: ' : 'Expenses: '}{fmt(filteredEntries.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0))} EGP</span>
            <span className="text-gray-400">{isAr ? `${filteredEntries.length} قيد` : `${filteredEntries.length} entries`}</span>
          </div>
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
                  <tr><td colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-sm text-gray-400 dark:text-navy-500">{isAr ? 'لا توجد قيود' : 'No entries found'}</td></tr>
                ) : filteredEntries.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 dark:border-navy-800 last:border-0 hover:bg-gray-50 dark:hover:bg-navy-800/50 transition-colors">
                    <td className="py-2.5 pe-3 text-xs text-gray-400 whitespace-nowrap" dir="ltr">{e.entry_date}</td>
                    <td className="py-2.5 pe-3 text-gray-800 dark:text-white max-w-[180px] truncate">{e.description || '—'}</td>
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

      {/* ── SPREADSHEET TAB ──────────────────────────────────────────────── */}
      {tab === 'spreadsheet' && (
        dataLoading ? <LoadingSpinner size="lg" className="py-20" /> :
        <div className="space-y-4">

          {/* ── Filter / toolbar bar ─────────────────────────────────── */}
          <div className="card p-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Category filter */}
              <select value={ssCatFilter} onChange={e => setSsCatFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500">
                <option value="">{isAr ? 'كل الفئات' : 'All Categories'}</option>
                <optgroup label={isAr ? 'دخل' : 'Income'}>
                  {Object.entries(INCOME_CATS).map(([k, lbl]) => (
                    <option key={k} value={k}>{lbl[isAr?'ar':'en']}</option>
                  ))}
                </optgroup>
                <optgroup label={isAr ? 'مصروف' : 'Expense'}>
                  {Object.entries(EXPENSE_CATS).map(([k, lbl]) => (
                    <option key={k} value={k}>{lbl[isAr?'ar':'en']}</option>
                  ))}
                </optgroup>
              </select>

              {/* Date from/to */}
              <input type="date" value={ssDateFrom} onChange={e => setSsDateFrom(e.target.value)} dir="ltr"
                title={isAr ? 'من تاريخ' : 'From date'}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500" />
              <input type="date" value={ssDateTo} onChange={e => setSsDateTo(e.target.value)} dir="ltr"
                title={isAr ? 'إلى تاريخ' : 'To date'}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500" />

              {(ssCatFilter || ssDateFrom || ssDateTo) && (
                <button onClick={() => { setSsCatFilter(''); setSsDateFrom(''); setSsDateTo('') }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-navy-700 text-gray-600 dark:text-navy-300 hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors">
                  {isAr ? 'مسح الفلاتر' : 'Clear Filters'}
                </button>
              )}

              {/* Refresh + Export */}
              <button onClick={loadEntries} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-700 text-gray-400 transition-colors" title={isAr ? 'تحديث' : 'Refresh'}>
                <RefreshCw size={14} />
              </button>
              <button onClick={exportToExcel}
                className="ms-auto flex items-center gap-2 px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors shadow-sm">
                <Download size={13} />
                {isAr ? 'تصدير Excel' : 'Export Excel'}
              </button>
            </div>

            {/* Row count hint */}
            <p className="text-xs text-gray-400 dark:text-navy-500 mt-2 ps-0.5">
              {isAr
                ? `${ssSorted.length} قيد — انقر على رأس العمود للترتيب`
                : `${ssSorted.length} rows — click column headers to sort`}
            </p>
          </div>

          {/* ── Main ledger table ─────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-300 dark:border-navy-600 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]" dir={isAr ? 'rtl' : 'ltr'}>
                {/* Sticky header */}
                <thead className="sticky top-0 z-10">
                  <tr className="bg-navy-800 dark:bg-navy-900 text-white select-none">
                    {/* Row number column */}
                    <th className="border border-navy-700 px-2 py-2.5 text-xs font-semibold text-navy-400 w-9 text-center">#</th>

                    {/* Date */}
                    <th onClick={() => handleSort('date')}
                      className="border border-navy-700 px-3 py-2.5 text-xs font-semibold text-start cursor-pointer hover:bg-navy-700 transition-colors whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {isAr ? 'التاريخ' : 'Date'}
                        <SortIcon col="date" sortBy={ssSortBy} sortDir={ssSortDir} />
                      </span>
                    </th>

                    {/* Type */}
                    <th onClick={() => handleSort('type')}
                      className="border border-navy-700 px-3 py-2.5 text-xs font-semibold text-start cursor-pointer hover:bg-navy-700 transition-colors whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {isAr ? 'النوع' : 'Type'}
                        <SortIcon col="type" sortBy={ssSortBy} sortDir={ssSortDir} />
                      </span>
                    </th>

                    {/* Category */}
                    <th onClick={() => handleSort('cat')}
                      className="border border-navy-700 px-3 py-2.5 text-xs font-semibold text-start cursor-pointer hover:bg-navy-700 transition-colors whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {isAr ? 'الفئة' : 'Category'}
                        <SortIcon col="cat" sortBy={ssSortBy} sortDir={ssSortDir} />
                      </span>
                    </th>

                    {/* Description / Property */}
                    <th className="border border-navy-700 px-3 py-2.5 text-xs font-semibold text-start whitespace-nowrap">
                      {isAr ? 'الوصف / العقار' : 'Description / Property'}
                    </th>

                    {/* Amount */}
                    <th onClick={() => handleSort('amount')}
                      className="border border-navy-700 px-3 py-2.5 text-xs font-semibold text-end cursor-pointer hover:bg-navy-700 transition-colors whitespace-nowrap">
                      <span className="flex items-center justify-end gap-1.5">
                        <SortIcon col="amount" sortBy={ssSortBy} sortDir={ssSortDir} />
                        {isAr ? 'المبلغ (EGP)' : 'Amount (EGP)'}
                      </span>
                    </th>

                    {/* Running Balance */}
                    <th onClick={() => handleSort('balance')}
                      className="border border-navy-700 px-3 py-2.5 text-xs font-semibold text-end cursor-pointer hover:bg-navy-700 transition-colors whitespace-nowrap bg-navy-700/40">
                      <span className="flex items-center justify-end gap-1.5">
                        <SortIcon col="balance" sortBy={ssSortBy} sortDir={ssSortDir} />
                        {isAr ? 'الرصيد التراكمي' : 'Running Balance'}
                      </span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {ssSorted.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-gray-400 dark:text-navy-500 border border-gray-200 dark:border-navy-700">
                        {isAr ? 'لا توجد قيود مطابقة للفلتر' : 'No entries match the current filter'}
                      </td>
                    </tr>
                  ) : ssSorted.map((e, i) => {
                    const isEven = i % 2 === 0
                    const rowBg  = isEven
                      ? 'bg-white dark:bg-navy-900'
                      : 'bg-gray-50/80 dark:bg-navy-800/60'
                    const isInc  = e.type === 'income'

                    return (
                      <tr key={e.id} className={`${rowBg} hover:bg-gold-50/40 dark:hover:bg-gold-900/10 transition-colors`}>
                        {/* Row # */}
                        <td className="border border-gray-200 dark:border-navy-700 px-2 py-2 text-xs text-gray-400 dark:text-navy-500 text-center font-mono">
                          {i + 1}
                        </td>
                        {/* Date */}
                        <td className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-xs text-gray-600 dark:text-navy-300 font-mono whitespace-nowrap" dir="ltr">
                          {e.entry_date}
                        </td>
                        {/* Type badge */}
                        <td className="border border-gray-200 dark:border-navy-700 px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isInc
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>
                            {isInc ? '▲' : '▼'} {isInc ? (isAr ? 'دخل' : 'Income') : (isAr ? 'مصروف' : 'Expense')}
                          </span>
                        </td>
                        {/* Category */}
                        <td className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-xs text-gray-600 dark:text-navy-300 whitespace-nowrap">
                          {catLabel(e.category, lang)}
                        </td>
                        {/* Description / Property */}
                        <td className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-xs text-gray-800 dark:text-white max-w-[220px]">
                          <p className="truncate">{e.description || '—'}</p>
                          {e.property_reference && (
                            <p className="truncate text-gray-400 dark:text-navy-500 mt-0.5">📍 {e.property_reference}</p>
                          )}
                        </td>
                        {/* Amount */}
                        <td className={`border border-gray-200 dark:border-navy-700 px-3 py-2 text-end font-bold font-mono whitespace-nowrap ${
                          isInc ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {isInc ? '+' : '−'} {fmt(e.amount)}
                        </td>
                        {/* Running Balance */}
                        <td className={`border border-gray-200 dark:border-navy-700 px-3 py-2 text-end font-mono font-semibold whitespace-nowrap text-xs bg-gray-50/50 dark:bg-navy-800/30 ${
                          e.runningBalance >= 0 ? 'text-gray-700 dark:text-navy-200' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {fmt(e.runningBalance)}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Starting capital row pinned at top logically — shown as a total row at bottom */}
                  {ssSorted.length > 0 && (
                    <>
                      {/* Spacer */}
                      <tr className="h-0">
                        <td colSpan={7} className="border-0 p-0" />
                      </tr>
                      {/* Total Income */}
                      <tr className="bg-green-50 dark:bg-green-900/15 font-bold">
                        <td className="border border-gray-300 dark:border-navy-600 px-2 py-2 text-xs text-gray-400 text-center">Σ</td>
                        <td colSpan={4} className="border border-gray-300 dark:border-navy-600 px-3 py-2 text-xs text-green-700 dark:text-green-400">
                          {isAr ? 'إجمالي الدخل' : 'Total Income'}
                        </td>
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2 text-end text-sm font-bold text-green-600 dark:text-green-400 font-mono">
                          + {fmt(ssTotalInc)}
                        </td>
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2 bg-gray-50/50 dark:bg-navy-800/30" />
                      </tr>
                      {/* Total Expenses */}
                      <tr className="bg-red-50 dark:bg-red-900/15 font-bold">
                        <td className="border border-gray-300 dark:border-navy-600 px-2 py-2 text-xs text-gray-400 text-center">Σ</td>
                        <td colSpan={4} className="border border-gray-300 dark:border-navy-600 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                          {isAr ? 'إجمالي المصروفات' : 'Total Expenses'}
                        </td>
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2 text-end text-sm font-bold text-red-600 dark:text-red-400 font-mono">
                          − {fmt(ssTotalExp)}
                        </td>
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2 bg-gray-50/50 dark:bg-navy-800/30" />
                      </tr>
                      {/* Net */}
                      <tr className="bg-gold-50 dark:bg-gold-900/20 font-bold">
                        <td className="border border-gray-300 dark:border-navy-600 px-2 py-2 text-xs text-gray-400 text-center">≡</td>
                        <td colSpan={4} className="border border-gray-300 dark:border-navy-600 px-3 py-2.5 text-sm font-bold text-gray-800 dark:text-white">
                          {isAr ? 'صافي الربح / الخسارة' : 'Net Profit / Loss'}
                        </td>
                        <td className={`border border-gray-300 dark:border-navy-600 px-3 py-2.5 text-end text-base font-bold font-mono ${ssNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {ssNet >= 0 ? '+' : '−'} {fmt(Math.abs(ssNet))}
                        </td>
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2.5 text-end text-base font-bold font-mono text-gold-600 dark:text-gold-400 bg-gold-100/30 dark:bg-gold-900/30">
                          {fmt(startingCapital + ssNet)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Category Pivot Summary ────────────────────────────────── */}
          {(catPivot.income.length > 0 || catPivot.expense.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Income pivot */}
              {catPivot.income.length > 0 && (
                <div className="rounded-xl border border-gray-300 dark:border-navy-600 overflow-hidden shadow-sm">
                  <div className="bg-green-700 dark:bg-green-900 px-4 py-2.5">
                    <p className="text-xs font-bold text-white">{isAr ? '▲ تفصيل الدخل بالفئة' : '▲ Income by Category'}</p>
                  </div>
                  <table className="w-full text-sm border-collapse" dir={isAr ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className="bg-green-50 dark:bg-green-900/20 text-xs font-semibold text-gray-500 dark:text-navy-400">
                        <th className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-start">{isAr ? 'الفئة' : 'Category'}</th>
                        <th className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-end">{isAr ? 'الإجمالي (EGP)' : 'Total (EGP)'}</th>
                        <th className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-end">{isAr ? '%' : '%'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catPivot.income.map((r, i) => (
                        <tr key={r.key} className={i % 2 === 0 ? 'bg-white dark:bg-navy-900' : 'bg-gray-50 dark:bg-navy-800/60'}>
                          <td className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-xs text-gray-700 dark:text-navy-200">{r.label}</td>
                          <td className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-end text-xs font-semibold text-green-600 dark:text-green-400 font-mono">{fmt(r.total)}</td>
                          <td className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-end text-xs text-gray-400 font-mono">
                            {ssTotalInc ? Math.round(r.total / ssTotalInc * 100) : 0}%
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-green-100 dark:bg-green-900/30 font-bold">
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2.5 text-xs font-bold text-green-800 dark:text-green-300">{isAr ? 'الإجمالي' : 'TOTAL'}</td>
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2.5 text-end text-sm font-bold text-green-600 dark:text-green-400 font-mono">{fmt(ssTotalInc)}</td>
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2.5 text-end text-xs text-green-600 font-mono font-bold">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Expense pivot */}
              {catPivot.expense.length > 0 && (
                <div className="rounded-xl border border-gray-300 dark:border-navy-600 overflow-hidden shadow-sm">
                  <div className="bg-red-700 dark:bg-red-900 px-4 py-2.5">
                    <p className="text-xs font-bold text-white">{isAr ? '▼ تفصيل المصروفات بالفئة' : '▼ Expenses by Category'}</p>
                  </div>
                  <table className="w-full text-sm border-collapse" dir={isAr ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className="bg-red-50 dark:bg-red-900/20 text-xs font-semibold text-gray-500 dark:text-navy-400">
                        <th className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-start">{isAr ? 'الفئة' : 'Category'}</th>
                        <th className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-end">{isAr ? 'الإجمالي (EGP)' : 'Total (EGP)'}</th>
                        <th className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-end">{isAr ? '%' : '%'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catPivot.expense.map((r, i) => (
                        <tr key={r.key} className={i % 2 === 0 ? 'bg-white dark:bg-navy-900' : 'bg-gray-50 dark:bg-navy-800/60'}>
                          <td className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-xs text-gray-700 dark:text-navy-200">{r.label}</td>
                          <td className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-end text-xs font-semibold text-red-600 dark:text-red-400 font-mono">{fmt(r.total)}</td>
                          <td className="border border-gray-200 dark:border-navy-700 px-3 py-2 text-end text-xs text-gray-400 font-mono">
                            {ssTotalExp ? Math.round(r.total / ssTotalExp * 100) : 0}%
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-red-100 dark:bg-red-900/30 font-bold">
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2.5 text-xs font-bold text-red-800 dark:text-red-300">{isAr ? 'الإجمالي' : 'TOTAL'}</td>
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2.5 text-end text-sm font-bold text-red-600 dark:text-red-400 font-mono">{fmt(ssTotalExp)}</td>
                        <td className="border border-gray-300 dark:border-navy-600 px-3 py-2.5 text-end text-xs text-red-600 font-mono font-bold">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Balance summary footer ────────────────────────────────── */}
          <div className="rounded-xl border-2 border-gold-500 dark:border-gold-600 bg-gradient-to-br from-navy-800 to-navy-950 p-4" dir={isAr ? 'rtl' : 'ltr'}>
            <p className="text-xs font-semibold text-gold-400 mb-3">
              {isAr ? '≡ ملخص الميزانية' : '≡ Balance Summary'}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[
                { label: isAr ? 'رأس المال الأولي' : 'Starting Capital', val: startingCapital, color: 'text-navy-300' },
                { label: isAr ? 'إجمالي الدخل'    : 'Total Income',     val: ssTotalInc,      color: 'text-green-400' },
                { label: isAr ? 'إجمالي المصروفات': 'Total Expenses',   val: ssTotalExp,      color: 'text-red-400' },
                { label: isAr ? 'الرصيد الحالي'   : 'Current Balance',  val: startingCapital + ssNet, color: (startingCapital + ssNet) >= 0 ? 'text-gold-400' : 'text-red-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-navy-700/40 rounded-xl p-3">
                  <p className="text-xs text-navy-400 mb-1">{label}</p>
                  <p className={`text-lg font-bold font-mono ${color}`}>{fmt(val)}</p>
                  <p className="text-xs text-navy-500">EGP</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
