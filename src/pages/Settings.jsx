import { useState, useEffect } from 'react'
import { Key, Clock, MessageSquare, Calendar, Users, Eye, EyeOff, Save, Plus, Trash2, UserX, UserCheck, AlertTriangle, Edit2 } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { useLang } from '../contexts/LanguageContext'
import { supabase, invokeFunction } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/shared/Modal'
import { RoleBadge } from '../components/shared/Badge'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { ALL_PAGES, DEFAULT_PAGE_ACCESS } from '../lib/pages'

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
function UserRow({ user, currentUserId, onToggle, onDelete, onEdit }) {
  const { t } = useLang()
  const isSelf = user.id === currentUserId
  return (
    <tr className="border-b border-gray-50 dark:border-navy-800 last:border-0">
      <td className="py-3 pe-4">
        <div>
          <p className="font-medium text-sm text-gray-800 dark:text-white">
            {user.full_name}
            {isSelf && <span className="ms-2 text-xs text-gold-500 font-normal">(you)</span>}
          </p>
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
        <div className="flex items-center gap-1.5">
          {/* Edit */}
          <button
            onClick={() => onEdit(user)}
            disabled={user.role === 'admin' && !isSelf}
            title="Edit user"
            className="p-1.5 rounded-lg hover:bg-navy-50 dark:hover:bg-navy-700 text-navy-400 dark:text-navy-400 hover:text-navy-700 dark:hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Edit2 size={13} />
          </button>
          {/* Deactivate / reactivate toggle */}
          <button
            onClick={() => onToggle(user)}
            disabled={isSelf || user.role === 'admin'}
            title={user.is_active ? 'Deactivate' : 'Reactivate'}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              user.is_active
                ? 'hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500'
                : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-400'
            }`}
          >
            {user.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
          </button>
          {/* Hard delete */}
          <button
            onClick={() => onDelete(user)}
            disabled={isSelf || user.role === 'admin'}
            title="Delete permanently"
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={13} />
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

  // Add user
  const [showAddModal, setShowAddModal] = useState(false)
  const [userForm, setUserForm] = useState({
    full_name: '', email: '', role: 'agent', password: '',
    page_access: DEFAULT_PAGE_ACCESS['agent'],
  })
  const [userSaving, setUserSaving] = useState(false)

  // Edit user
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', role: 'agent', page_access: [], is_active: true })
  const [editSaving, setEditSaving] = useState(false)

  // Delete user
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  const reloadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data || [])
  }

  const openEditModal = (user) => {
    setEditTarget(user)
    setEditForm({
      full_name:   user.full_name,
      role:        user.role,
      page_access: user.page_access ?? DEFAULT_PAGE_ACCESS[user.role] ?? [],
      is_active:   user.is_active,
    })
    setShowEditModal(true)
  }

  const handleEditUser = async () => {
    setEditSaving(true)
    try {
      await invokeFunction('admin-update-user', {
        user_id:     editTarget.id,
        full_name:   editForm.full_name.trim(),
        role:        editForm.role,
        page_access: editForm.page_access,
        is_active:   editForm.is_active,
      })
      toast.success('User updated successfully')
      setShowEditModal(false)
      await reloadUsers()
    } catch (err) {
      toast.error(err.message || t('errors.generic'))
    } finally { setEditSaving(false) }
  }

  const togglePageInForm = (key, checked, formSetter) => {
    formSetter(prev => ({
      ...prev,
      page_access: checked
        ? [...(prev.page_access || []), key]
        : (prev.page_access || []).filter(k => k !== key),
    }))
  }

  const handleCreateUser = async () => {
    if (!userForm.full_name.trim()) { toast.error('Full name is required'); return }
    if (!userForm.email.trim())     { toast.error('Email is required'); return }
    if (userForm.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setUserSaving(true)
    try {
      await invokeFunction('admin-create-user', {
        full_name:   userForm.full_name.trim(),
        email:       userForm.email.trim(),
        password:    userForm.password,
        role:        userForm.role,
        page_access: userForm.page_access,
      })
      toast.success('User created successfully')
      setShowAddModal(false)
      setUserForm({ full_name: '', email: '', role: 'agent', password: '', page_access: DEFAULT_PAGE_ACCESS['agent'] })
      await reloadUsers()
    } catch (err) {
      toast.error(err.message || t('errors.generic'))
    } finally { setUserSaving(false) }
  }

  const handleToggleUser = async (user) => {
    try {
      await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      toast.success(user.is_active ? 'User deactivated' : 'User reactivated')
    } catch { toast.error(t('errors.generic')) }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await invokeFunction('admin-delete-user', { user_id: deleteTarget.id })
      toast.success(`${deleteTarget.full_name} deleted permanently`)
      setDeleteTarget(null)
      await reloadUsers()
    } catch (err) {
      toast.error(err.message || t('errors.generic'))
    } finally { setDeleting(false) }
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
          <button
            onClick={() => { setUserForm({ full_name: '', email: '', role: 'agent', password: '', page_access: DEFAULT_PAGE_ACCESS['agent'] }); setShowAddModal(true) }}
            className="btn-navy flex items-center gap-2 text-sm"
          >
            <Plus size={14} /> {t('settings.users.addUser')}
          </button>
        </div>

        {usersLoading ? <LoadingSpinner size="sm" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-navy-800">
                  {[t('name'), t('settings.users.role'), t('status'), t('actions')].map(h => (
                    <th key={h} className="pb-2 text-start text-xs font-semibold text-gray-400 dark:text-navy-500 pe-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    currentUserId={profile?.id}
                    onToggle={handleToggleUser}
                    onDelete={setDeleteTarget}
                    onEdit={openEditModal}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Add user modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('settings.users.addUser')}
        size="sm"
        footer={
          <>
            <button onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-navy-700 text-sm text-gray-600 dark:text-navy-300 hover:bg-gray-50 dark:hover:bg-navy-800">
              {t('cancel')}
            </button>
            <button onClick={handleCreateUser} disabled={userSaving} className="btn-gold text-sm px-4 py-2">
              {userSaving
                ? <span className="flex items-center gap-2">
                    <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </span>
                : 'Create User'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">
              {t('leads.fullName')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={userForm.full_name}
              onChange={e => setUserForm(p => ({ ...p, full_name: e.target.value }))}
              placeholder="Ahmed Hassan"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">
              {t('email')} <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={userForm.email}
              onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))}
              placeholder="ahmed@company.com"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">
              {t('password')} <span className="text-red-400">*</span>
              <span className="text-gray-400 font-normal ms-1">(min 6 characters)</span>
            </label>
            <input
              type="password"
              value={userForm.password}
              onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">
              {t('settings.users.role')} <span className="text-red-400">*</span>
            </label>
            <select
              value={userForm.role}
              onChange={e => setUserForm(p => ({ ...p, role: e.target.value, page_access: DEFAULT_PAGE_ACCESS[e.target.value] || [] }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              <option value="agent">Agent</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          {/* Page access checkboxes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-2">
              Page Access
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_PAGES.filter(p => p.key !== 'settings').map(page => {
                const allowed = page.maxRoles.includes(userForm.role)
                const checked = (userForm.page_access || []).includes(page.key)
                return (
                  <label key={page.key} className={`flex items-center gap-2 text-xs cursor-pointer select-none ${!allowed ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!allowed}
                      onChange={e => togglePageInForm(page.key, e.target.checked, setUserForm)}
                      className="accent-gold-500 w-3 h-3"
                    />
                    <span className="text-gray-700 dark:text-navy-200">{page.en}</span>
                  </label>
                )
              })}
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-navy-500 pt-1">
            The user can log in immediately after creation with the email and password you set here.
          </p>
        </div>
      </Modal>

      {/* ── Edit user modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit: ${editTarget?.full_name || ''}`}
        size="sm"
        footer={
          <>
            <button onClick={() => setShowEditModal(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-navy-700 text-sm text-gray-600 dark:text-navy-300 hover:bg-gray-50 dark:hover:bg-navy-800">
              {t('cancel')}
            </button>
            <button onClick={handleEditUser} disabled={editSaving} className="btn-gold text-sm px-4 py-2">
              {editSaving
                ? <span className="flex items-center gap-2"><span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</span>
                : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">Full Name</label>
            <input type="text" value={editForm.full_name}
              onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500" />
          </div>
          {editTarget?.role !== 'admin' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-1">Role</label>
                <select value={editForm.role}
                  onChange={e => setEditForm(p => ({
                    ...p, role: e.target.value,
                    page_access: p.page_access?.filter(k => {
                      const page = ALL_PAGES.find(pg => pg.key === k)
                      return page?.maxRoles.includes(e.target.value)
                    }) ?? DEFAULT_PAGE_ACCESS[e.target.value] ?? [],
                  }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500">
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-navy-400 mb-2">Page Access</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_PAGES.filter(p => p.key !== 'settings').map(page => {
                    const allowed = page.maxRoles.includes(editForm.role)
                    const checked = (editForm.page_access || []).includes(page.key)
                    return (
                      <label key={page.key} className={`flex items-center gap-2 text-xs cursor-pointer select-none ${!allowed ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input type="checkbox" checked={checked} disabled={!allowed}
                          onChange={e => togglePageInForm(page.key, e.target.checked, setEditForm)}
                          className="accent-gold-500 w-3 h-3" />
                        <span className="text-gray-700 dark:text-navy-200">{page.en}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </>
          )}
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="editActive" checked={editForm.is_active}
              onChange={e => setEditForm(p => ({ ...p, is_active: e.target.checked }))}
              className="accent-gold-500" />
            <label htmlFor="editActive" className="text-sm text-gray-700 dark:text-navy-200 cursor-pointer">Active</label>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirmation modal ──────────────────────────────────── */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-navy-700 text-sm text-gray-600 dark:text-navy-300 hover:bg-gray-50 dark:hover:bg-navy-800">
              Cancel
            </button>
            <button onClick={handleDeleteUser} disabled={deleting}
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
              {deleting
                ? <><span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting...</>
                : <><Trash2 size={14} /> Delete Permanently</>
              }
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">This action cannot be undone</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                Deleting <strong>{deleteTarget?.full_name}</strong> will:
              </p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-navy-200">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              Remove their account from Supabase Auth (they can no longer log in)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              Delete their profile from the database
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              Unassign all leads currently assigned to them
            </li>
          </ul>
        </div>
      </Modal>
    </div>
  )
}
