import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Trash2, Sparkles } from 'lucide-react'
import { invokeFunction } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

function Message({ msg, isRTL }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 message-enter ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser
          ? 'bg-gradient-to-br from-gold-500 to-gold-700'
          : 'bg-gradient-to-br from-navy-600 to-navy-800'
      }`}>
        {isUser ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-gold-500 to-gold-600 text-white rounded-ee-sm'
            : 'bg-white dark:bg-navy-900 text-gray-800 dark:text-white border border-gray-100 dark:border-navy-700 rounded-es-sm'
        }`}>
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>
        <span className="text-xs text-gray-400 dark:text-navy-500 px-1">
          {msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm') : ''}
        </span>
      </div>
    </div>
  )
}

const EXAMPLE_PROMPTS_KEY = 'aiChat.examples'

export default function AIChat() {
  const { t, lang, isRTL } = useLang()
  const { profile } = useAuth()

  const [messages, setMessages] = useState(() => {
    try {
      const stored = sessionStorage.getItem(`ai-chat-${profile?.id}`)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef(null)

  // Save messages to session storage
  useEffect(() => {
    if (profile?.id) {
      sessionStorage.setItem(`ai-chat-${profile.id}`, JSON.stringify(messages))
    }
  }, [messages, profile?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const sendMessage = async (text) => {
    const content = text || input.trim()
    if (!content || thinking) return
    setInput('')

    const userMsg = { role: 'user', content, timestamp: new Date().toISOString() }
    const history = [...messages, userMsg]
    setMessages(history)
    setThinking(true)

    try {
      const data = await invokeFunction('ai-chat', {
        messages: history.map(m => ({ role: m.role, content: m.content })),
        user_role: profile?.role,
        lang,
      })
      const assistantMsg = {
        role: 'assistant',
        content: data.reply || t('errors.generic'),
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      toast.error(err.message || t('errors.generic'))
      // Remove the user message on failure so they can retry
      setMessages(messages)
    } finally {
      setThinking(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    sessionStorage.removeItem(`ai-chat-${profile?.id}`)
  }

  // Attempt to get translated examples array
  const examples = (() => {
    try {
      const raw = t(EXAMPLE_PROMPTS_KEY)
      return Array.isArray(raw) ? raw : []
    } catch { return [] }
  })()

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-navy-800 dark:text-white">
          <Sparkles size={20} className="text-gold-500" />
          <span className="font-semibold">{t('aiChat.title')}</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"
          >
            <Trash2 size={13} /> {t('aiChat.clearChat')}
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 card overflow-y-auto p-5 space-y-5">
        {messages.length === 0 ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-navy-600 to-navy-900 flex items-center justify-center shadow-lg">
              <Bot size={28} className="text-gold-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">{t('aiChat.title')}</h2>
              <p className="text-sm text-gray-500 dark:text-navy-400 max-w-md">{t('aiChat.placeholder')}</p>
            </div>

            {/* Example prompts */}
            {examples.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {examples.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(ex)}
                    className="text-start px-4 py-3 rounded-xl border border-gray-200 dark:border-navy-700
                               text-sm text-gray-600 dark:text-navy-300 hover:border-gold-400 hover:text-gold-600
                               dark:hover:border-gold-600 dark:hover:text-gold-400 transition-all bg-white dark:bg-navy-900
                               hover:shadow-sm"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <Message key={i} msg={msg} isRTL={isRTL} />
          ))
        )}

        {/* Thinking indicator */}
        {thinking && (
          <div className="flex gap-3 message-enter">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="card px-4 py-3 flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-navy-400">{t('aiChat.thinking')}</span>
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-bounce"
                       style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('aiChat.placeholder')}
          rows={1}
          disabled={thinking}
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-navy-700
                     bg-white dark:bg-navy-900 text-sm text-gray-900 dark:text-white
                     placeholder-gray-400 dark:placeholder-navy-500
                     focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none max-h-40
                     disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={thinking || !input.trim()}
          className="px-4 rounded-xl bg-gradient-to-br from-gold-500 to-gold-700 hover:from-gold-600 hover:to-gold-800
                     text-white disabled:opacity-50 transition-all shadow-md hover:shadow-lg shrink-0"
        >
          <Send size={18} className={isRTL ? 'rotate-180' : ''} />
        </button>
      </div>
    </div>
  )
}
