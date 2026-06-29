import { useState, useEffect, useRef } from 'react'
import { Send, Search, MessageSquare, CheckCheck, Check, Clock, User } from 'lucide-react'
import { supabase, invokeFunction } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'

function StatusIcon({ status }) {
  if (status === 'read')      return <CheckCheck size={12} className="text-blue-400" />
  if (status === 'delivered') return <CheckCheck size={12} className="text-gray-400" />
  if (status === 'sent')      return <Check size={12} className="text-gray-400" />
  return <Clock size={12} className="text-gray-300" />
}

function MessageBubble({ msg, isRTL }) {
  const isOut = msg.direction === 'outbound'
  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-2 message-enter`}>
      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
        isOut
          ? 'bg-navy-800 text-white rounded-ee-sm'
          : 'bg-white dark:bg-navy-900 text-gray-800 dark:text-white border border-gray-100 dark:border-navy-700 rounded-es-sm'
      }`}>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
        <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
          <span className={`text-xs ${isOut ? 'text-navy-400' : 'text-gray-400'}`}>
            {format(new Date(msg.created_at), 'HH:mm')}
          </span>
          {isOut && <StatusIcon status={msg.status} />}
        </div>
      </div>
    </div>
  )
}

export default function WhatsApp() {
  const { t, isRTL } = useLang()
  const { profile } = useAuth()

  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  // Load leads that have conversations
  useEffect(() => {
    async function loadLeads() {
      const { data } = await supabase
        .from('leads')
        .select('id, full_name, phone, source')
        .order('last_activity_at', { ascending: false })
      setLeads(data || [])
      setLoading(false)
    }
    loadLeads()
  }, [])

  // Load messages for selected lead
  useEffect(() => {
    if (!selectedLead) return
    async function loadMessages() {
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('lead_id', selectedLead.id)
        .order('created_at', { ascending: true })
      setMessages(data || [])
    }
    loadMessages()

    // Realtime subscription
    const channel = supabase
      .channel(`wa-${selectedLead.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `lead_id=eq.${selectedLead.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [selectedLead])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || !selectedLead) return
    setSending(true)
    try {
      await invokeFunction('whatsapp-send', {
        lead_id: selectedLead.id,
        phone: selectedLead.phone,
        message: text.trim(),
        sent_by: profile.id,
      })
      setText('')
    } catch (err) {
      toast.error(err.message || t('errors.generic'))
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const sendWelcome = async () => {
    if (!selectedLead) return
    try {
      await invokeFunction('whatsapp-welcome', {
        lead_id: selectedLead.id,
        phone: selectedLead.phone,
      })
      toast.success(t('success'))
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  const filtered = leads.filter(l =>
    l.full_name.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search)
  )

  if (loading) return <LoadingSpinner size="lg" className="py-20" />

  return (
    <div className="flex h-[calc(100vh-8rem)] card overflow-hidden">
      {/* Sidebar: conversation list */}
      <div className="w-72 shrink-0 border-e border-gray-100 dark:border-navy-800 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-gray-100 dark:border-navy-800">
          <div className="relative">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('search') + '…'}
              className="w-full ps-8 pe-3 py-2 rounded-lg bg-gray-100 dark:bg-navy-800 text-sm
                         text-gray-700 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-navy-800">
          {filtered.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400 dark:text-navy-500">
              {t('whatsapp.noConversations')}
            </p>
          )}
          {filtered.map(lead => (
            <button
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors ${
                selectedLead?.id === lead.id
                  ? 'bg-gold-50 dark:bg-gold-900/10'
                  : 'hover:bg-gray-50 dark:hover:bg-navy-800'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {lead.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-gray-800 dark:text-white truncate">{lead.full_name}</p>
                <p className="text-xs text-gray-400 dark:text-navy-500 font-mono" dir="ltr">{lead.phone}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      {selectedLead ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="px-5 py-3 border-b border-gray-100 dark:border-navy-800 flex items-center justify-between bg-white dark:bg-navy-900">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white text-sm font-bold">
                {selectedLead.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">{selectedLead.full_name}</p>
                <p className="text-xs text-gray-400 dark:text-navy-500 font-mono" dir="ltr">{selectedLead.phone}</p>
              </div>
            </div>
            <button
              onClick={sendWelcome}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors"
            >
              {t('whatsapp.sendTemplateMsg')}
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-navy-950">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300 dark:text-navy-700">
                <MessageSquare size={40} />
                <p className="text-sm">{t('whatsapp.noConversations')}</p>
              </div>
            ) : (
              messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} isRTL={isRTL} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-100 dark:border-navy-800 bg-white dark:bg-navy-900 flex gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('whatsapp.typeMessage')}
              rows={1}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-navy-800 text-sm text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none max-h-32"
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="p-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-white disabled:opacity-50 transition-colors shrink-0"
            >
              <Send size={18} className={isRTL ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-300 dark:text-navy-700">
          <MessageSquare size={48} />
          <p className="text-sm">{t('whatsapp.noConversations')}</p>
        </div>
      )}
    </div>
  )
}
