import { useState, useEffect } from 'react'
import { useLang } from '../../contexts/LanguageContext'
import { supabase } from '../../lib/supabase'

const SOURCES   = ['olx_dubizzle', 'aqarmap', 'meta', 'whatsapp', 'manual']
const TYPES     = ['buyer', 'seller']
const PROP_TYPES = ['apartment', 'villa', 'land', 'commercial', 'office', 'warehouse', 'other']
const STATUSES  = ['new', 'contacted', 'interested', 'negotiating', 'closed_won', 'closed_lost']

const DEFAULT = {
  full_name: '', phone: '', email: '', source: 'manual', type: 'buyer',
  status: 'new', property_type: '', property_area: '', property_size: '',
  property_price: '', property_location: '', budget_min: '', budget_max: '',
  timeline: '', preferred_area: '', notes: '', assigned_to: '',
}

export default function LeadForm({ initial, onSubmit, onCancel, loading }) {
  const { t } = useLang()
  const [form, setForm] = useState({ ...DEFAULT, ...initial })
  const [agents, setAgents] = useState([])

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['agent', 'manager'])
      .eq('is_active', true)
      .then(({ data }) => setAgents(data || []))
  }, [])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const handleChange = e => set(e.target.name, e.target.value)

  const handleSubmit = (e) => {
    e.preventDefault()
    const clean = { ...form }
    // Coerce numeric strings to null if empty
    ;['property_size','property_price','budget_min','budget_max'].forEach(k => {
      clean[k] = clean[k] ? Number(clean[k]) : null
    })
    if (!clean.assigned_to) delete clean.assigned_to
    onSubmit(clean)
  }

  const field = (label, name, opts = {}) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{label}</label>
      <input
        name={name}
        value={form[name] || ''}
        onChange={handleChange}
        required={opts.required}
        type={opts.type || 'text'}
        placeholder={opts.placeholder || ''}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-700
                   bg-white dark:bg-navy-800 text-gray-900 dark:text-white text-sm
                   focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
        dir={opts.ltr ? 'ltr' : undefined}
      />
    </div>
  )

  const select = (label, name, options, tPrefix) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{label}</label>
      <select
        name={name}
        value={form[name] || ''}
        onChange={handleChange}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-700
                   bg-white dark:bg-navy-800 text-gray-900 dark:text-white text-sm
                   focus:outline-none focus:ring-2 focus:ring-gold-500"
      >
        {!options.required && <option value="">{t('select')}</option>}
        {options.map(o => (
          <option key={o} value={o}>{t(`${tPrefix}.${o}`) || o}</option>
        ))}
      </select>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field(t('leads.fullName'), 'full_name', { required: true })}
        {field(t('leads.phone'), 'phone', { required: true, ltr: true, placeholder: '01x-xxxx-xxxx' })}
        {field(t('leads.email'), 'email', { type: 'email', ltr: true })}
        {select(t('leads.source'), 'source', SOURCES, 'sources')}
        {select(t('leads.type'), 'type', TYPES, 'types')}
        {select(t('leads.status'), 'status', STATUSES, 'statuses')}
      </div>

      <hr className="border-gray-100 dark:border-navy-800" />
      <p className="text-xs font-semibold text-gray-500 dark:text-navy-400 uppercase tracking-wider">
        {t('leads.propertyArea')} / {t('details')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {select(t('leads.propertyType'), 'property_type', PROP_TYPES, 'propertyTypes')}
        {field(t('leads.propertyArea'), 'property_area')}
        {field(t('leads.propertySize'), 'property_size', { type: 'number', placeholder: 'm²' })}
        {field(t('leads.propertyPrice'), 'property_price', { type: 'number', placeholder: 'EGP' })}
        {field(t('leads.propertyLocation'), 'property_location')}
        {field(t('leads.preferredArea'), 'preferred_area')}
        {field(t('leads.budget') + ' (Min)', 'budget_min', { type: 'number' })}
        {field(t('leads.budget') + ' (Max)', 'budget_max', { type: 'number' })}
        {field(t('leads.timeline'), 'timeline')}
      </div>

      <hr className="border-gray-100 dark:border-navy-800" />

      {/* Assignment */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{t('leads.assignedTo')}</label>
        <select
          name="assigned_to"
          value={form.assigned_to || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-700
                     bg-white dark:bg-navy-800 text-gray-900 dark:text-white text-sm
                     focus:outline-none focus:ring-2 focus:ring-gold-500"
        >
          <option value="">{t('leads.filters.allAgents')}</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.full_name}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{t('notes')}</label>
        <textarea
          name="notes"
          value={form.notes || ''}
          onChange={handleChange}
          rows={3}
          placeholder={t('activity.notePlaceholder')}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-700
                     bg-white dark:bg-navy-800 text-gray-900 dark:text-white text-sm
                     focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="flex-1 btn-gold">
          {loading ? t('loading') : t('save')}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-navy-700
                     text-gray-700 dark:text-navy-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-navy-800">
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
