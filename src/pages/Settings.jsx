import { useState } from 'react'
import { Key, Clock, MessageSquare, Calendar, Users, Eye, EyeOff, Save, TestTube, Plus, Edit2, UserX, UserCheck } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { useLang } from '../contexts/LanguageContext'
import { supabase, invokeFunction } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/shared/Modal'
import { RoleBadge } from '../components/shared/Badge'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { useEffect } from 'react'

// ── Masked API key input ─────────────────────────────────────────────────────
function SecretInput({ label, settingKey, value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value || ''}
          onChange={e => onChange(settingKey, e.target.value)}
          placeholder={placeholder || '••••••••••••••••••••'}
          className="w-full px-3 py-2.5 pe-10 rounded-xl border border-gray-200 dark:border-navy-700
                     bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-gold-500 font-mono"
          dir="ltr"
        />
        <button type="button" onClick={() => setShow(v => !v)}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

// ── Settings section wrapper ─────────────────────────────────────────────────
function Section({ icon: Icon, title, children }) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-navy-800 pb-3">
        <Icon size={16} className="text-gold-500" />
        <h2 className="text-sm font-bold text-gray-800 dark:text-white">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── User management ──────────────────────────────────────────────────────────
function UserRow({ user, onEdit, onToggle, onReset }) {
  const { t } = useLang()
  return (
    <tr className="border-b border-gray-50 dark:border-navy-800 last:border-0">
      <td className="py-3 pe-4">
        <div>
          <p className="font-medium text-sm text-gray-800 dark:text-white">{user.full_name}</p>
          <p className="text-xs text-gray-400 dark:text-navy-500">{user.email}</p>
        </div>
      </td>
      <td className="py-3 pe-4"><RoleBadge role={user.role} /></td>
      <td className="py-3 pe-4">
        <span className={`text-xs font-medium ${user.is_active ? 'text-green-500' : 'text-red-400'}`}>
          {user.is_active ? t('active') : t('inactive')}
        </span>
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => onEdit(user)} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500"><Edit2 size={13} /></button>
          <button onClick={() => onToggle(user)} className={`p-1.5 rounded-lg ${user.is_active ? 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400' : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-400'}`}>
            {user.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function Settings() {
  const { t } = useLang()
  const { settings, loading: settingsLoading, saveMany } = useSettings()
  const { profile } = useAuth()
  const [local, setLocal] = useState({})
  const [saving, setSaving] = useState(false)

  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userModal, setUserModal] = useState(null) // null | 'add' | user object
  const [userForm, setUserForm] = useState({ full_name: '', email: '', role: 'agent', password: '' })
  const [userSaving, setUserSaving] = useState(false)

  // Merge loaded settings into local state
  useEffect(() => {
    if (!settingsLoading) setLocal(settings)
  }, [settingsLoading, settings])

  // Load users
  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at').then(({ data }) => {
      setUsers(data || [])
      setUsersLoading(false)
    })
  }, [])

  const set = (key, val) => setLocal(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveMany(local)
      toast.success(t('settings.settingsSaved'))
    } catch {
      toast.error(t('errors.generic'))
    } finally { setSaving(false) }
  }

  const handleCreateUser = async () => {
    setUserSaving(true)
    try {
      await invokeFunction('admin-create-user', userForm)
      toast.success(t('success'))
      setUserModal(null)
      // Reload users
      const { data } = await supabase.from('profiles').select('*').order('created_at')
      setUsers(data || [])
    } catch (err) {
      toast.error(err.message || t('errors.generic'))
    } finally { setUserSaving(false) }
  }

  const handleToggleUser = async (user) => {
    try {
      await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      toast.success(t('success'))
    } catch { toast.error(t('errors.generic')) }
  }

  const FREQ_OPTS = ['2h','4h','6h','12h']

  if (settingsLoading) return <LoadingSpinner size="lg" className="py-20" />

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── API Keys ───────────────────────────────────────────────────── */}
      <Section icon={Key} title={t('settings.apiKeys')}>
        <div className="grid grid-cols-1 gap-4">
          <SecretInput label={t('settings.anthropicKey')}   settingKey="anthropic_api_key"      value={local.anthropic_api_key}      onChange={set} />
          <SecretInput label={t('settings.whatsappToken')}  settingKey="whatsapp_token"          value={local.whatsapp_token}         onChange={set} />
          <SecretInput label={t('settings.whatsappPhoneId')}settingKey="whatsapp_phone_number_id" value={local.whatsapp_phone_number_id} onChange={set} placeholder="123456789" />
          <SecretInput label={t('settings.metaToken')}      settingKey="meta_api_token"          value={local.meta_api_token}         onChange={set} />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{t('settings.metaAdAccountId')}</label>
            <input type="text" value={local.meta_ad_account_id || ''} onChange={e => set('meta_ad_account_id', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500 font-mono" dir="ltr" />
          </div>
        </div>
      </Section>

      {/* ── Scraper schedule ───────────────────────────────────────────── */}
      <Section icon={Clock} title={t('settings.scraperSchedule')}>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-2">{t('settings.scraperFrequency')}</label>
          <div className="flex flex-wrap gap-2">
            {FREQ_OPTS.map(f => (
              <button key={f}
                onClick={() => set('scraper_frequency', f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  local.scraper_frequency === f
                    ? 'bg-gold-500 text-white'
                    : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-navy-300 hover:bg-gray-200'
                }`}
              >
                {t(`settings.scraperFrequencies.${f}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{t('settings.olxConfig')}</label>
          <input type="text" value={local.olx_search_url || ''} onChange={e => set('olx_search_url', e.target.value)}
            placeholder="https://www.olx.com.eg/properties..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500 font-mono" dir="ltr" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{t('settings.aqarmapConfig')}</label>
          <input type="text" value={local.aqarmap_search_url || ''} onChange={e => set('aqarmap_search_url', e.target.value)}
            placeholder="https://aqarmap.com.eg/..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500 font-mono" dir="ltr" />
        </div>
      </Section>

      {/* ── WhatsApp settings ──────────────────────────────────────────── */}
      <Section icon={MessageSquare} title={t('settings.whatsappSettings')}>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{t('settings.firstMessage')}</label>
          <textarea
            value={local.wa_first_message || ''}
            onChange={e => set('wa_first_message', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">
            {t('settings.followUpDelay')} ({local.wa_followup_days || 3} {t('date')})
          </label>
          <input type="range" min="1" max="14" value={local.wa_followup_days || 3}
            onChange={e => set('wa_followup_days', Number(e.target.value))}
            className="w-full accent-gold-500" />
          <div className="flex justify-between text-xs text-gray-400 dark:text-navy-500 mt-1">
            <span>1</span><span>14</span>
          </div>
        </div>
      </Section>

      {/* ── Report schedule ────────────────────────────────────────────── */}
      <Section icon={Calendar} title={t('settings.reportSettings')}>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{t('settings.reportTime')}</label>
          <input type="time" value={local.weekly_report_time || '09:00'}
            onChange={e => set('weekly_report_time', e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
            dir="ltr"
          />
        </div>
      </Section>

      {/* ── Save button ────────────────────────────────────────────────── */}
      <button onClick={handleSave} disabled={saving}
        className="w-full btn-gold py-3 text-base font-semibold flex items-center justify-center gap-2">
        <Save size={16} />
        {saving ? t('loading') : t('settings.saveSettings')}
      </button>

      {/* ── User management ────────────────────────────────────────────── */}
      <Section icon={Users} title={t('settings.users.title')}>
        <div className="flex justify-end">
          <button onClick={() => { setUserForm({ full_name:'', email:'', role:'agent', password:'' }); setUserModal('add') }}
            className="btn-navy flex items-center gap-2 text-sm">
            <Plus size={14} /> {t('settings.users.addUser')}
          </button>
        </div>

        {usersLoading ? <LoadingSpinner size="sm" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-navy-800">
                  {[t('name'), t('settings.users.role'), t('status'), t('actions')].map(h => (
                    <th key={h} className="pb-2 text-start text-xs font-semibold text-gray-400 dark:text-navy-500 pe-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <UserRow key={u.id} user={u}
                    onEdit={u => { setUserForm(u); setUserModal(u) }}
                    onToggle={handleToggleUser}
                    onReset={() => {}}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Add/Edit user modal */}
      <Modal
        isOpen={!!userModal}
        onClose={() => setUserModal(null)}
        title={userModal === 'add' ? t('settings.users.addUser') : t('settings.users.editUser')}
        size="sm"
        footer={
          <>
            <button onClick={() => setUserModal(null)}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-navy-700 text-sm text-gray-600 hover:bg-gray-50">
              {t('cancel')}
            </button>
            <button onClick={handleCreateUser} disabled={userSaving} className="btn-gold text-sm px-4 py-2">
              {userSaving ? t('loading') : t('save')}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {[
            { label: t('leads.fullName'), key: 'full_name', type: 'text' },
            { label: t('email'), key: 'email', type: 'email' },
            { label: t('password'), key: 'password', type: 'password' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{f.label}</label>
              <input type={f.type} value={userForm[f.key] || ''} onChange={e => setUserForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">{t('settings.users.role')}</label>
            <select value={userForm.role} onChange={e => setUserForm(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500">
              {['agent','manager','admin'].map(r => <option key={r} value={r}>{t(`settings.users.roles.${r}`)}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
