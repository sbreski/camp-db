import { useEffect, useMemo, useState, useRef } from 'react'
import {
  AlertCircle, Check, Edit2, Plus, RefreshCw, Save,
  Shield, Trash2, User, X, FileText, Upload, Download, Eye, EyeOff,
  Key, Lock, Unlock, Star, Heart, Award, ChevronDown, ChevronUp,
  Paperclip, Calendar, Phone, Mail, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_OPTIONS = [
  { id: 'dashboard',      label: 'Dashboard' },
  { id: 'signin',         label: 'Sign In / Out' },
  { id: 'shared-info',    label: 'Shared Info' },
  { id: 'attendance',     label: 'Attendance' },
  { id: 'star-of-day',    label: 'Star of the Day' },
  { id: 'participants',   label: 'Participants' },
  { id: 'parents',        label: 'Parents' },
  { id: 'dressing-rooms', label: 'Dressing Rooms' },
  { id: 'medical',        label: 'Medical' },
  { id: 'behaviour',      label: 'Behaviour Log' },
  { id: 'incidents',      label: 'Reporting' },
  { id: 'staff',          label: 'Staff' },
  { id: 'documents',      label: 'Documents' },
]

const ALWAYS_ALLOWED = ['dashboard', 'signin', 'shared-info']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeAllowedTabs(tabIds) {
  const valid = (Array.isArray(tabIds) ? tabIds : []).filter(tab =>
    TAB_OPTIONS.some(o => o.id === tab)
  )
  ALWAYS_ALLOWED.forEach(id => { if (!valid.includes(id)) valid.unshift(id) })
  return [...new Set(valid)]
}

function normalizeUsername(value) {
  return String(value || '')
    .trim().toLowerCase()
    .replace(/[']/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

function initials(name) {
  return String(name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function expiryStatus(dateStr, warnDays = 60) {
  if (!dateStr) return null
  const today = new Date()
  const exp = new Date(dateStr)
  const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= warnDays) return 'soon'
  return 'ok'
}

function toYmd(date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addYearsToDate(dateStr, years) {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setFullYear(date.getFullYear() + years)
  return toYmd(date)
}

function getDbsMeta(source) {
  const issueDate = source?.dbsIssueDate || source?.dbs_issue_date || ''
  const onUpdateService = Boolean(source?.dbsOnUpdateService ?? source?.dbs_on_update_service)
  if (!issueDate) return { issueDate: '', onUpdateService, expiryDate: '', status: null }

  const expiryDate = addYearsToDate(issueDate, 3)
  if (!expiryDate) return { issueDate: '', onUpdateService, expiryDate: '', status: null }
  if (onUpdateService) return { issueDate, onUpdateService, expiryDate, status: 'ok' }

  return {
    issueDate,
    onUpdateService,
    expiryDate,
    status: expiryStatus(expiryDate, 90),
  }
}

function asBool(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === 't' || normalized === '1' || normalized === 'yes'
  }
  return false
}

function getTrainingMeta(source) {
  return {
    firstAidTrained: asBool(source?.firstAidTrained ?? source?.first_aid_trained),
    safeguardingTrained: asBool(source?.safeguardingTrained ?? source?.safeguarding_trained),
    firstAidExpiresOn: source?.firstAidExpiresOn || source?.first_aid_expires_on || '',
    safeguardingExpiresOn: source?.safeguardingExpiresOn || source?.safeguarding_expires_on || '',
  }
}

function ExpiryBadge({ dateStr }) {
  const status = expiryStatus(dateStr)
  if (!status) return null
  const color = status === 'expired' ? 'bg-red-100 text-red-700 border-red-200'
    : status === 'soon' ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-emerald-100 text-emerald-700 border-emerald-200'
  const label = status === 'expired' ? `Expired ${dateStr}`
    : status === 'soon' ? `Expires ${dateStr}`
    : `Valid to ${dateStr}`
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${color}`}>{label}</span>
  )
}

// ─── Staff Profile Form ────────────────────────────────────────────────────────

function StaffProfileForm({ initial, onSave, onCancel, isNew }) {
  const initialTraining = getTrainingMeta(initial)
  const empty = {
    name: '', role: '', phone: '', email: '',
    emergencyContact: '', emergencyPhone: '', notes: '',
    firstAidTrained: false, safeguardingTrained: false,
    firstAidExpiresOn: '', safeguardingExpiresOn: '',
    dbsOnUpdateService: false, dbsIssueDate: '',
    isAssignedThisSeason: true,
    // login
    tempPassword: '',
    // permissions
    isAdmin: false, canViewSafeguarding: false,
    allowedTabs: ['dashboard', 'signin', 'shared-info'],
  }

  const [form, setForm] = useState({
    ...empty,
    ...initial,
    firstAidTrained: initialTraining.firstAidTrained,
    safeguardingTrained: initialTraining.safeguardingTrained,
    firstAidExpiresOn: initialTraining.firstAidExpiresOn,
    safeguardingExpiresOn: initialTraining.safeguardingExpiresOn,
    dbsOnUpdateService: Boolean(initial?.dbsOnUpdateService ?? initial?.dbs_on_update_service),
    dbsIssueDate: initial?.dbsIssueDate || initial?.dbs_issue_date || '',
    isAssignedThisSeason: (initial?.isAssignedThisSeason ?? initial?.is_assigned_this_season) !== false,
    isAdmin: Boolean(initial?.isAdmin),
    canViewSafeguarding: Boolean(initial?.canViewSafeguarding),
    allowedTabs: sanitizeAllowedTabs(initial?.allowedTabs || ['dashboard', 'signin', 'shared-info']),
    tempPassword: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [section, setSection] = useState('profile') // profile | login | permissions

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function toggleTab(id) {
    if (ALWAYS_ALLOWED.includes(id)) return
    const next = form.allowedTabs.includes(id)
      ? form.allowedTabs.filter(t => t !== id)
      : [...form.allowedTabs, id]
    set('allowedTabs', sanitizeAllowedTabs(next))
  }

  const loginId = form.email?.trim()
    ? form.email.trim().toLowerCase()
    : normalizeUsername(form.name)
  const dbsMeta = getDbsMeta(form)

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (isNew && form.tempPassword && form.tempPassword.length < 8) return
    onSave(form)
  }

  const tabs = [
    { id: 'profile', label: 'Profile & Training' },
    { id: 'login', label: 'Login Account' },
    { id: 'permissions', label: 'Permissions & Views' },
  ]

  return (
    <div className="card border-2 border-forest-200 fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-forest-950 text-lg">
          {isNew ? 'Add Staff Member' : `Edit — ${initial?.name || 'Staff'}`}
        </h3>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-600 p-1"><X size={18} /></button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-5 border-b border-stone-100 pb-3">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSection(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              section === t.id
                ? 'bg-forest-900 text-white'
                : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">

        {/* ── Profile & Training ── */}
        {section === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Full Name *</label>
                <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="First Last" />
              </div>
              <div>
                <label className="label">Role</label>
                <input className="input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Coordinator, Assistant" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+44 7700 000000" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="staff@email.com" />
                <p className="text-xs text-stone-400 mt-1">Also used as login identifier</p>
              </div>
              <div>
                <label className="label">Emergency Contact</label>
                <input className="input" value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} placeholder="Name (Relationship)" />
              </div>
              <div>
                <label className="label">Emergency Phone</label>
                <input className="input" type="tel" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional information..." />
              </div>
            </div>

            {/* Season assignment */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-stone-800 cursor-pointer">
                <input type="checkbox" className="h-4 w-4" checked={form.isAssignedThisSeason !== false}
                  onChange={e => set('isAssignedThisSeason', e.target.checked)} />
                <Calendar size={14} className="text-forest-600" />
                Active this season — can log in
              </label>
              <p className="text-xs text-stone-400 mt-1 ml-6">Uncheck to retain the profile but disable login access for this season.</p>
            </div>

            {/* Training */}
            <div>
              <p className="label mb-2">Training & Qualifications</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-forest-900 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4" checked={form.firstAidTrained}
                      onChange={e => set('firstAidTrained', e.target.checked)} />
                    <Heart size={13} className="text-rose-500" /> First aid trained
                  </label>
                  {form.firstAidTrained && (
                    <div className="ml-6">
                      <label className="label">Expiry date</label>
                      <input type="date" className="input" value={form.firstAidExpiresOn}
                        onChange={e => set('firstAidExpiresOn', e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-forest-900 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4" checked={form.safeguardingTrained}
                      onChange={e => set('safeguardingTrained', e.target.checked)} />
                    <Shield size={13} className="text-blue-500" /> Safeguarding trained
                  </label>
                  {form.safeguardingTrained && (
                    <div className="ml-6">
                      <label className="label">Expiry date</label>
                      <input type="date" className="input" value={form.safeguardingExpiresOn}
                        onChange={e => set('safeguardingExpiresOn', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="label mb-2">DBS</p>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm text-forest-900 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.dbsOnUpdateService}
                    onChange={e => set('dbsOnUpdateService', e.target.checked)}
                  />
                  <Shield size={13} className="text-indigo-500" /> On DBS update service
                </label>
                <div>
                  <label className="label">DBS issue date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.dbsIssueDate}
                    onChange={e => set('dbsIssueDate', e.target.value)}
                  />
                </div>
                {dbsMeta.issueDate && (
                  <div className="text-xs text-stone-500">
                    {dbsMeta.onUpdateService
                      ? `On update service. DBS issued ${dbsMeta.issueDate}.`
                      : `DBS expires ${dbsMeta.expiryDate} (3 years from issue date). Warning starts 3 months before expiry.`}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Login Account ── */}
        {section === 'login' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-forest-200 bg-forest-50 p-4 space-y-1">
              <p className="text-sm font-semibold text-forest-900">Login identifier</p>
              <p className="font-mono text-forest-800 text-sm">{loginId || <span className="italic text-stone-400">enter a name or email above</span>}</p>
              <p className="text-xs text-stone-500">
                {form.email?.trim() ? 'Using email address as login.' : 'Auto-generated from name (no email set).'}
              </p>
            </div>

            {isNew ? (
              <div>
                <label className="label">Temporary Password *</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    placeholder="Min 8 characters — share with staff member"
                    value={form.tempPassword}
                    onChange={e => set('tempPassword', e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {form.tempPassword.length > 0 && form.tempPassword.length < 8 && (
                  <p className="text-xs text-red-600 mt-1">Must be at least 8 characters</p>
                )}
                <p className="text-xs text-stone-400 mt-1">Leave blank to create staff profile without a login account.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                <p className="text-sm font-medium text-stone-700">Password Management</p>
                <p className="text-xs text-stone-500">To reset this staff member's password, use the password field in the account section below the staff list, found in the access management panel.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Permissions ── */}
        {section === 'permissions' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
              <p className="label">Access Level</p>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" className="h-4 w-4 mt-0.5" checked={form.isAdmin}
                  onChange={e => set('isAdmin', e.target.checked)} />
                <div>
                  <span className="text-sm font-semibold text-forest-900 flex items-center gap-1.5">
                    <Star size={13} className="text-amber-500" /> Full admin access
                  </span>
                  <p className="text-xs text-stone-400 mt-0.5">Can access all tabs, manage users, and view all information.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" className="h-4 w-4 mt-0.5" checked={form.canViewSafeguarding}
                  onChange={e => {
                    const checked = e.target.checked
                    set('canViewSafeguarding', checked)
                    if (checked && !form.allowedTabs.includes('incidents')) {
                      set('allowedTabs', sanitizeAllowedTabs([...form.allowedTabs, 'incidents']))
                    }
                  }}
                  disabled={form.isAdmin} />
                <div>
                  <span className={`text-sm font-semibold flex items-center gap-1.5 ${form.isAdmin ? 'text-stone-400' : 'text-forest-900'}`}>
                    <Shield size={13} className="text-blue-500" /> View safeguarding reports
                  </span>
                  <p className="text-xs text-stone-400 mt-0.5">Can access confidential safeguarding incident records.</p>
                </div>
              </label>
            </div>

            {!form.isAdmin && (
              <div>
                <p className="label mb-2">Allowed Tabs</p>
                <p className="text-xs text-stone-400 mb-3">Dashboard, Sign In/Out, and Shared Info are always available.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TAB_OPTIONS.map(tab => {
                    const locked = ALWAYS_ALLOWED.includes(tab.id)
                    return (
                      <label key={tab.id} className={`flex items-center gap-2 text-sm cursor-pointer ${locked ? 'text-stone-400' : 'text-forest-800'}`}>
                        <input type="checkbox" className="h-4 w-4"
                          checked={form.allowedTabs.includes(tab.id) || locked}
                          onChange={() => toggleTab(tab.id)}
                          disabled={locked || form.isAdmin} />
                        {tab.label}
                        {locked && <span className="text-[10px] text-stone-300">(always)</span>}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-stone-100">
          <button type="submit" className="btn-primary flex-1">
            {isNew ? 'Add Staff Member' : 'Save Changes'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}

// ─── Staff Detail Panel ───────────────────────────────────────────────────────

function StaffDetailPanel({
  member, loginUser, onEdit, onClose, onDelete,
  onSavePermissions, onResetPassword, onToggleArchive, onDeleteAccount,
  accessActionLoading, canManageAccess, currentUserEmail,
  accessEdits, setAccessEdit,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileRef = useRef()

  const isCurrentUser = loginUser
    ? (loginUser.internalEmail || loginUser.email || '').toLowerCase() === currentUserEmail
    : false

  const edit = loginUser ? (accessEdits[loginUser.id] || {
    isAdmin: !!loginUser.isAdmin,
    canViewSafeguarding: !!loginUser.canViewSafeguarding,
    allowedTabs: sanitizeAllowedTabs(loginUser.allowedTabs),
    newPassword: '',
    deleteConfirmed: false,
  }) : null

  function setEdit(nextState) {
    if (!loginUser) return
    setAccessEdit(loginUser.id, nextState)
  }

  function toggleTab(id) {
    if (!edit || ALWAYS_ALLOWED.includes(id)) return
    const next = edit.allowedTabs.includes(id)
      ? edit.allowedTabs.filter(t => t !== id)
      : [...edit.allowedTabs, id]
    setEdit({ allowedTabs: sanitizeAllowedTabs(next) })
  }

  async function uploadDocument(file) {
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { alert('File must be under 8MB.'); return }
    setUploadingDoc(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `staff-documents/${member.id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: false })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
      const doc = {
        id: crypto.randomUUID(),
        name: file.name,
        url: urlData.publicUrl,
        uploadedAt: new Date().toISOString(),
        size: file.size,
      }

      const existing = Array.isArray(member.staff_documents) ? member.staff_documents : []
      onEdit({ ...member, staff_documents: [...existing, doc] }, true) // true = save only
    } catch (err) {
      alert(err.message || 'Upload failed')
    } finally {
      setUploadingDoc(false)
    }
  }

  function removeDocument(docId) {
    if (!window.confirm('Remove this document?')) return
    const existing = Array.isArray(member.staff_documents) ? member.staff_documents : []
    onEdit({ ...member, staff_documents: existing.filter(d => d.id !== docId) }, true)
  }

  const staffDocuments = Array.isArray(member.staff_documents) ? member.staff_documents : []
  const training = getTrainingMeta(member)
  const faExpiry = expiryStatus(training.firstAidExpiresOn)
  const sgExpiry = expiryStatus(training.safeguardingExpiresOn)
  const dbsMeta = getDbsMeta(member)

  const detailTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'permissions', label: 'Login & Permissions' },
    { id: 'documents', label: `Documents${staffDocuments.length > 0 ? ` (${staffDocuments.length})` : ''}` },
  ]

  return (
    <div className="card fade-in space-y-0 p-0 overflow-hidden">
      {/* Header */}
      <div className="bg-forest-900 text-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white font-display font-bold text-xl flex-shrink-0">
              {initials(member.name)}
            </div>
            <div>
              <h3 className="font-display font-bold text-xl leading-tight">{member.name}</h3>
              {member.role && <p className="text-forest-200 text-sm mt-0.5">{member.role}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {training.firstAidTrained && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    faExpiry === 'expired' ? 'bg-red-900/40 text-red-200 border-red-700'
                    : faExpiry === 'soon' ? 'bg-amber-900/40 text-amber-200 border-amber-700'
                    : 'bg-emerald-900/40 text-emerald-200 border-emerald-700'
                  }`}>
                    <Heart size={9} /> First Aid
                    {faExpiry === 'expired' && ' · EXPIRED'}
                    {faExpiry === 'soon' && ' · Expiring soon'}
                  </span>
                )}
                {training.safeguardingTrained && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    sgExpiry === 'expired' ? 'bg-red-900/40 text-red-200 border-red-700'
                    : sgExpiry === 'soon' ? 'bg-amber-900/40 text-amber-200 border-amber-700'
                    : 'bg-emerald-900/40 text-emerald-200 border-emerald-700'
                  }`}>
                    <Shield size={9} /> Safeguarding
                    {sgExpiry === 'expired' && ' · EXPIRED'}
                    {sgExpiry === 'soon' && ' · Expiring soon'}
                  </span>
                )}
                {dbsMeta.issueDate && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    dbsMeta.onUpdateService
                      ? 'bg-indigo-900/40 text-indigo-200 border-indigo-700'
                      : dbsMeta.status === 'expired'
                        ? 'bg-red-900/40 text-red-200 border-red-700'
                        : dbsMeta.status === 'soon'
                          ? 'bg-amber-900/40 text-amber-200 border-amber-700'
                          : 'bg-emerald-900/40 text-emerald-200 border-emerald-700'
                  }`}>
                    <Shield size={9} /> DBS
                    {dbsMeta.onUpdateService ? ' · Update service' : ` · ${dbsMeta.expiryDate}`}
                    {!dbsMeta.onUpdateService && dbsMeta.status === 'expired' && ' · EXPIRED'}
                    {!dbsMeta.onUpdateService && dbsMeta.status === 'soon' && ' · Expiring soon'}
                  </span>
                )}
                {member.isAssignedThisSeason === false && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-900/40 text-rose-200 border border-rose-700">
                    Not active this season
                  </span>
                )}
                {loginUser?.isArchived && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-200 border border-amber-700">
                    Login archived
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => onEdit(member, false)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white">
              <Edit2 size={15} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white">
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Detail tabs */}
      <div className="flex border-b border-stone-100 bg-stone-50">
        {detailTabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === t.id
                ? 'border-forest-700 text-forest-900'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {member.email && (
                <div>
                  <p className="label mb-0.5">Email / Login</p>
                  <p className="text-forest-700 flex items-center gap-1.5"><Mail size={13} /> {member.email}</p>
                </div>
              )}
              {member.phone && (
                <div>
                  <p className="label mb-0.5">Phone</p>
                  <p className="text-forest-700 flex items-center gap-1.5"><Phone size={13} /> {member.phone}</p>
                </div>
              )}
              {member.emergencyContact && (
                <div>
                  <p className="label mb-0.5">Emergency Contact</p>
                  <p className="text-stone-700">{member.emergencyContact}</p>
                </div>
              )}
              {member.emergencyPhone && (
                <div>
                  <p className="label mb-0.5">Emergency Phone</p>
                  <p className="text-forest-700 flex items-center gap-1.5"><Phone size={13} /> {member.emergencyPhone}</p>
                </div>
              )}
            </div>

            {member.notes && (
              <div className="pt-3 border-t border-stone-100">
                <p className="label mb-1">Notes</p>
                <p className="text-sm text-stone-700 leading-relaxed">{member.notes}</p>
              </div>
            )}

            <div className="pt-3 border-t border-stone-100 space-y-3">
              <p className="label">Training & Qualifications</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`rounded-xl border p-3 ${training.firstAidTrained ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-stone-50'}`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Heart size={14} className={training.firstAidTrained ? 'text-rose-500' : 'text-stone-300'} />
                    <span className={training.firstAidTrained ? 'text-emerald-900' : 'text-stone-400'}>
                      {training.firstAidTrained ? 'First Aid Trained' : 'No First Aid'}
                    </span>
                  </div>
                  {training.firstAidTrained && <ExpiryBadge dateStr={training.firstAidExpiresOn} />}
                </div>
                <div className={`rounded-xl border p-3 ${training.safeguardingTrained ? 'border-blue-200 bg-blue-50' : 'border-stone-200 bg-stone-50'}`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Shield size={14} className={training.safeguardingTrained ? 'text-blue-500' : 'text-stone-300'} />
                    <span className={training.safeguardingTrained ? 'text-blue-900' : 'text-stone-400'}>
                      {training.safeguardingTrained ? 'Safeguarding Trained' : 'No Safeguarding'}
                    </span>
                  </div>
                  {training.safeguardingTrained && <ExpiryBadge dateStr={training.safeguardingExpiresOn} />}
                </div>
                <div className={`rounded-xl border p-3 ${dbsMeta.issueDate ? 'border-indigo-200 bg-indigo-50' : 'border-stone-200 bg-stone-50'}`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Shield size={14} className={dbsMeta.issueDate ? 'text-indigo-500' : 'text-stone-300'} />
                    <span className={dbsMeta.issueDate ? 'text-indigo-900' : 'text-stone-400'}>
                      {dbsMeta.issueDate ? 'DBS Logged' : 'No DBS details'}
                    </span>
                  </div>
                  {dbsMeta.issueDate && (
                    <p className="text-[10px] mt-1 text-stone-600">
                      {dbsMeta.onUpdateService
                        ? `Issue date ${dbsMeta.issueDate} · On update service`
                        : `Issue date ${dbsMeta.issueDate} · Expires ${dbsMeta.expiryDate}${dbsMeta.status === 'expired' ? ' (expired)' : dbsMeta.status === 'soon' ? ' (expiring soon)' : ''}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex flex-wrap gap-2">
              <button onClick={() => onDelete(member.id)}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors border border-red-200">
                <Trash2 size={13} /> Remove Staff Profile
              </button>
            </div>
          </div>
        )}

        {/* ── Login & Permissions ── */}
        {activeTab === 'permissions' && (
          <div className="space-y-5">
            {!canManageAccess ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Only admin users can manage login permissions. Sign in with an admin account to make changes.
              </div>
            ) : !loginUser ? (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                <p className="text-sm font-medium text-stone-700">No login account linked</p>
                <p className="text-xs text-stone-500">This staff member doesn't have a login account. Edit their profile and set a temporary password to create one.</p>
                <button onClick={() => onEdit(member, false)}
                  className="btn-secondary text-xs flex items-center gap-1.5">
                  <Key size={13} /> Add Login Account
                </button>
              </div>
            ) : (
              <>
                {/* Login info */}
                <div className="rounded-xl border border-forest-200 bg-forest-50 p-4 space-y-1">
                  <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide">Login Account</p>
                  <p className="font-mono text-sm text-forest-900">{loginUser.email || loginUser.username || '—'}</p>
                  <p className="text-xs text-stone-500">User ID: {loginUser.id}</p>
                  {loginUser.isArchived && (
                    <p className="text-xs text-amber-700 font-medium">⚠ Login currently archived (disabled)</p>
                  )}
                </div>

                {/* Admin / safeguarding toggles */}
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" className="h-4 w-4 mt-0.5"
                      checked={!!edit.isAdmin}
                      onChange={e => setEdit({ isAdmin: e.target.checked })}
                      disabled={isCurrentUser} />
                    <div>
                      <span className="text-sm font-semibold text-forest-900 flex items-center gap-1.5">
                        <Star size={13} className="text-amber-500" /> Full admin access
                      </span>
                      <p className="text-xs text-stone-400 mt-0.5">Access all tabs, manage staff, and view all information.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 mt-0.5"
                      checked={!!edit.canViewSafeguarding}
                      onChange={e => {
                        const checked = e.target.checked
                        const updatedTabs = checked && !edit.allowedTabs.includes('incidents')
                          ? sanitizeAllowedTabs([...edit.allowedTabs, 'incidents'])
                          : edit.allowedTabs
                        setEdit({ canViewSafeguarding: checked, allowedTabs: updatedTabs })
                      }}
                      disabled={!!edit.isAdmin} />
                    <div>
                      <span className="text-sm font-semibold text-forest-900 flex items-center gap-1.5">
                        <Shield size={13} className="text-blue-500" /> View safeguarding reports
                      </span>
                    </div>
                  </label>
                </div>

                {/* Allowed tabs */}
                {!edit.isAdmin && (
                  <div>
                    <p className="label mb-2">Allowed Tabs</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TAB_OPTIONS.map(tab => {
                        const locked = ALWAYS_ALLOWED.includes(tab.id)
                        return (
                          <label key={tab.id} className={`flex items-center gap-2 text-sm ${locked ? 'text-stone-400 cursor-default' : 'text-forest-800 cursor-pointer'}`}>
                            <input type="checkbox" className="h-4 w-4"
                              checked={edit.allowedTabs.includes(tab.id) || locked}
                              onChange={() => toggleTab(tab.id)}
                              disabled={locked} />
                            {tab.label}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Season access toggle — shown here too */}
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-stone-800 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4"
                      checked={!loginUser.isArchived}
                      onChange={e => onToggleArchive(loginUser, !e.target.checked)}
                      disabled={accessActionLoading || isCurrentUser} />
                    <Calendar size={14} className="text-forest-600" />
                    Login account active (not archived)
                  </label>
                  <p className="text-xs text-stone-400 mt-1 ml-6">Uncheck to archive this login without deleting the account.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-primary text-sm flex items-center gap-1.5"
                    onClick={() => onSavePermissions(loginUser.id, member.name)}
                    disabled={accessActionLoading}>
                    <Save size={14} /> Save Permissions
                  </button>
                </div>

                {/* Password reset */}
                <div className="pt-4 border-t border-stone-100 space-y-2">
                  <p className="label">Reset Password</p>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder="New password (min 8 chars)"
                      value={edit.newPassword || ''}
                      onChange={e => setEdit({ newPassword: e.target.value })}
                    />
                    <button className="btn-secondary text-sm"
                      onClick={() => onResetPassword(loginUser.id)}
                      disabled={accessActionLoading}>
                      Reset
                    </button>
                  </div>
                </div>

                {/* Permanent delete */}
                {!isCurrentUser && (
                  <div className="pt-4 border-t border-stone-100 space-y-2">
                    <p className="label text-red-700">Danger Zone</p>
                    <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4"
                        checked={!!edit.deleteConfirmed}
                        onChange={e => setEdit({ deleteConfirmed: e.target.checked })} />
                      I understand this permanently deletes the login account.
                    </label>
                    <button
                      className="btn-secondary text-sm text-red-700 border-red-200"
                      onClick={() => onDeleteAccount(loginUser)}
                      disabled={accessActionLoading || !edit.deleteConfirmed}>
                      Permanently Delete Login Account
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Documents ── */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <p className="text-xs text-stone-500">Upload first aid certificates, DBS checks, incident forms, and other staff documents.</p>

            {staffDocuments.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-stone-200 p-8 text-center">
                <Paperclip size={24} className="text-stone-300 mx-auto mb-2" />
                <p className="text-sm text-stone-400">No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {staffDocuments.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                    <FileText size={14} className="text-forest-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{doc.name}</p>
                      {doc.uploadedAt && (
                        <p className="text-xs text-stone-400">
                          {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <a href={doc.url} target="_blank" rel="noreferrer"
                      className="p-1.5 text-forest-600 hover:text-forest-800 hover:bg-forest-50 rounded-lg transition-colors">
                      <Download size={14} />
                    </a>
                    <button onClick={() => removeDocument(doc.id)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <input ref={fileRef} type="file" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocument(f); e.target.value = '' }} />
              <button onClick={() => fileRef.current?.click()}
                disabled={uploadingDoc}
                className="btn-secondary text-sm flex items-center gap-2">
                <Upload size={14} /> {uploadingDoc ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Staff Component ─────────────────────────────────────────────────────

export default function Staff({ staffList, setStaffList, campPeriods, setCampPeriods, canManageCampPeriod = false }) {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editingMember, setEditingMember] = useState(null)

  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [canManageAccess, setCanManageAccess] = useState(false)
  const [accessUsers, setAccessUsers] = useState([])
  const [accessEdits, setAccessEdits] = useState({})
  const [accessLoading, setAccessLoading] = useState(true)
  const [accessActionLoading, setAccessActionLoading] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [accessMessage, setAccessMessage] = useState('')
  const [resetRequests, setResetRequests] = useState([])

  const [staffActionLoading, setStaffActionLoading] = useState(false)
  const [staffMessage, setStaffMessage] = useState('')
  const [staffError, setStaffError] = useState('')

  const [campPeriodDrafts, setCampPeriodDrafts] = useState([])
  const [newPeriodDraft, setNewPeriodDraft] = useState({ label: '', startDate: '', endDate: '' })
  const [campPeriodSaving, setCampPeriodSaving] = useState(false)
  const [campPeriodMessage, setCampPeriodMessage] = useState('')
  const [campPeriodError, setCampPeriodError] = useState('')

  const [search, setSearch] = useState('')
  const [filterSeason, setFilterSeason] = useState('all') // all | active | inactive

  const ownerEmail = (import.meta.env.VITE_OWNER_EMAIL || '').toLowerCase()

  useEffect(() => {
    setCampPeriodDrafts(campPeriods?.map(p => ({
      id: p.id, label: p.label || '',
      startDate: p.startDate || p.start_date || '',
      endDate: p.endDate || p.end_date || '',
    })) || [])
  }, [campPeriods])

  // Keep selected/editing snapshots fresh when staffList changes (e.g. after save/reload).
  useEffect(() => {
    if (!selected?.id) return
    const fresh = staffList.find(s => s.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [staffList, selected?.id])

  useEffect(() => {
    if (!editingMember?.id) return
    const fresh = staffList.find(s => s.id === editingMember.id)
    if (fresh) setEditingMember(prev => (prev ? { ...fresh, tempPassword: prev.tempPassword || '' } : fresh))
  }, [staffList, editingMember?.id])

  async function withAccessToken() {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) throw new Error('No active auth session')
    setCurrentUserEmail((data.session.user?.email || '').toLowerCase())
    return data.session.access_token
  }

  async function loadAccessUsers() {
    setAccessLoading(true)
    setAccessError('')
    setAccessMessage('')
    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', { headers: { Authorization: `Bearer ${token}` } })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load users')

      const users = payload.users || []
      setCanManageAccess(!!payload.currentUser?.isAdmin)
      setAccessUsers(users)
      setResetRequests(Array.isArray(payload.resetRequests) ? payload.resetRequests : [])

      const edits = {}
      users.forEach(user => {
        edits[user.id] = {
          identifier: user.username || user.email || '',
          isAdmin: !!user.isAdmin,
          canViewSafeguarding: !!user.canViewSafeguarding,
          allowedTabs: sanitizeAllowedTabs(user.allowedTabs),
          newPassword: '',
          deleteConfirmed: false,
        }
      })
      // Merge with any existing edits so optimistic updates (e.g. after savePermissions)
      // are not overwritten by a background reload returning stale server values.
      // Preserve allowedTabs, isAdmin, and canViewSafeguarding so saved permissions
      // (including star-of-day tab) are not reverted by a background reload.
      setAccessEdits(prev => {
        const merged = { ...edits }
        Object.keys(prev).forEach(id => {
          if (merged[id]) {
            merged[id] = {
              ...merged[id],
              isAdmin: prev[id].isAdmin ?? merged[id].isAdmin,
              canViewSafeguarding: prev[id].canViewSafeguarding ?? merged[id].canViewSafeguarding,
              allowedTabs: prev[id].allowedTabs ?? merged[id].allowedTabs,
              newPassword: prev[id].newPassword || '',
              deleteConfirmed: false,
            }
          }
        })
        return merged
      })
    } catch (error) {
      setCanManageAccess(false)
      setAccessUsers([])
      setResetRequests([])
      setAccessError(error.message)
    } finally {
      setAccessLoading(false)
    }
  }

  useEffect(() => { loadAccessUsers() }, [])

  function setAccessEdit(userId, nextState) {
    setAccessEdits(prev => ({ ...prev, [userId]: { ...prev[userId], ...nextState } }))
  }

  // Build email→loginUser map
  const loginUserByEmail = useMemo(() => {
    const map = new Map()
    accessUsers.forEach(user => {
      if (user.email) map.set(user.email.toLowerCase(), user)
      if (user.internalEmail) map.set(user.internalEmail.toLowerCase(), user)
      if (user.username) map.set(user.username.toLowerCase(), user)
    })
    return map
  }, [accessUsers])

  function getLinkedLoginUser(member) {
    if (!member) return null
    if (member.email) {
      const u = loginUserByEmail.get(member.email.toLowerCase())
      if (u) return u
    }
    const byUsername = loginUserByEmail.get(normalizeUsername(member.name))
    if (byUsername) return byUsername
    return null
  }

  async function attemptCreateLoginAccount({ identifier, password, allowedTabs, isAdmin, canViewSafeguarding, fullName }) {
    const token = await withAccessToken()
    const response = await fetch('/api/admin-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        action: 'create_user',
        email: identifier,
        password,
        isAdmin: !!isAdmin,
        canViewTimetableOverview: false,
        canEditTimetable: false,
        canViewSafeguarding: !!canViewSafeguarding,
        allowedTabs: sanitizeAllowedTabs(allowedTabs || ['dashboard', 'signin']),
        ...(fullName ? { fullName } : {}),
      }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to create login account')
    return payload
  }

  async function addStaff(data) {
    setStaffActionLoading(true)
    setStaffError('')
    setStaffMessage('')
    try {
      const newId = crypto.randomUUID()
      const loginIdentifier = data.email?.trim()
        ? data.email.trim().toLowerCase()
        : normalizeUsername(data.name)

      const { tempPassword, ...staffData } = data
      await setStaffList(prev => [...prev, { ...staffData, id: newId }])
      setShowForm(false)

      if (data.tempPassword && data.tempPassword.length >= 8 && loginIdentifier) {
        try {
          await attemptCreateLoginAccount({
            identifier: loginIdentifier,
            password: data.tempPassword,
            allowedTabs: data.allowedTabs,
            isAdmin: data.isAdmin,
            canViewSafeguarding: data.canViewSafeguarding,
            fullName: data.name?.trim() || '',
          })
          setStaffMessage(`Staff profile and login account created. Login: ${loginIdentifier} · Password: ${data.tempPassword}`)
          await loadAccessUsers()
        } catch (accountError) {
          setStaffMessage('Staff profile added.')
          setStaffError(`Login account error: ${accountError.message}`)
        }
      } else {
        setStaffMessage('Staff profile added. No login account created (no password provided).')
      }
    } catch (error) {
      setStaffError(error.message || 'Unable to add staff profile')
    } finally {
      setStaffActionLoading(false)
    }
  }

  async function saveEditStaff(data, saveOnly = false) {
    if (!editingMember && !saveOnly) return
    const target = saveOnly ? data : editingMember
    setStaffActionLoading(true)
    try {
      // Strip fields that belong to the login/permissions system, not the staff DB table.
      const { tempPassword, isAdmin, canViewSafeguarding, allowedTabs, ...staffData } = data
      await setStaffList(prev => prev.map(s => s.id === target.id ? { ...s, ...staffData } : s))
      if (selected?.id === target.id) setSelected(s => ({ ...s, ...staffData }))
      if (!saveOnly) {
        setEditingMember(null)
        setStaffMessage('Staff profile updated.')
      }
    } catch (error) {
      setStaffError(error.message || 'Unable to update staff profile')
    } finally {
      setStaffActionLoading(false)
    }
  }

  async function deleteStaff(id) {
    if (!window.confirm('Remove this staff member from the system?')) return
    setStaffActionLoading(true)
    try {
      await setStaffList(prev => prev.filter(s => s.id !== id))
      if (selected?.id === id) setSelected(null)
      setStaffMessage('Staff profile removed.')
    } catch (error) {
      setStaffError(error.message || 'Unable to remove')
    } finally {
      setStaffActionLoading(false)
    }
  }

  async function savePermissions(userId, fullName = '') {
    const edit = accessEdits[userId]
    if (!edit) return
    setAccessActionLoading(true)
    setAccessError('')
    setAccessMessage('')
    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'update_permissions',
          userId,
          isAdmin: !!edit.isAdmin,
          canViewTimetableOverview: false,
          canEditTimetable: false,
          canViewSafeguarding: !!edit.canViewSafeguarding,
          allowedTabs: sanitizeAllowedTabs(edit.allowedTabs),
          ...(fullName ? { fullName } : {}),
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to save permissions')
      setAccessMessage('Permissions updated.')
      // Optimistically update local state so canViewSafeguarding and allowedTabs
      // (incl. star-of-day) reflect the saved values immediately, rather than
      // being overwritten if the background reload returns stale data
      setAccessUsers(prev => prev.map(u => u.id !== userId ? u : {
        ...u,
        isAdmin: !!edit.isAdmin,
        canViewSafeguarding: !!edit.canViewSafeguarding,
        allowedTabs: sanitizeAllowedTabs(edit.allowedTabs),
      }))
      setAccessEdits(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          isAdmin: !!edit.isAdmin,
          canViewSafeguarding: !!edit.canViewSafeguarding,
          allowedTabs: sanitizeAllowedTabs(edit.allowedTabs),
        },
      }))
      loadAccessUsers().catch(() => {})
    } catch (error) {
      setAccessError(error.message)
    } finally {
      setAccessActionLoading(false)
    }
  }

  async function resetPassword(userId) {
    const edit = accessEdits[userId]
    const newPassword = edit?.newPassword || ''
    if (newPassword.length < 8) { setAccessError('Password must be at least 8 characters'); return }
    setAccessActionLoading(true)
    setAccessError('')
    setAccessMessage('')
    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'reset_password', userId, newPassword }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to reset password')
      setAccessEdit(userId, { newPassword: '' })
      setAccessMessage('Password reset successfully.')
      await loadAccessUsers()
    } catch (error) {
      setAccessError(error.message)
    } finally {
      setAccessActionLoading(false)
    }
  }

  async function toggleArchive(user, shouldArchive) {
    const internalEmail = (user.internalEmail || user.email || '').toLowerCase()
    if (internalEmail && internalEmail === currentUserEmail) {
      setAccessError('You cannot change archive status on your own account')
      return
    }
    const confirmed = window.confirm(`${shouldArchive ? 'Archive' : 'Restore'} login account for ${accountLabel(user)}?`)
    if (!confirmed) return
    setAccessActionLoading(true)
    setAccessError('')
    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: shouldArchive ? 'archive_user' : 'restore_user', userId: user.id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to update account')
      setAccessMessage(`${shouldArchive ? 'Archived' : 'Restored'} account.`)
      await loadAccessUsers()
    } catch (error) {
      setAccessError(error.message)
    } finally {
      setAccessActionLoading(false)
    }
  }

  async function deleteLoginAccount(user) {
    const internalEmail = (user.internalEmail || user.email || '').toLowerCase()
    if (internalEmail && internalEmail === currentUserEmail) {
      setAccessError('You cannot delete your own account')
      return
    }
    const check = window.prompt(`Type DELETE to permanently remove ${accountLabel(user)}.`)
    if (check !== 'DELETE') return
    setAccessActionLoading(true)
    setAccessError('')
    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete_user', userId: user.id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to delete account')
      setAccessMessage('Login account permanently deleted.')
      await loadAccessUsers()
    } catch (error) {
      setAccessError(error.message)
    } finally {
      setAccessActionLoading(false)
    }
  }

  function accountLabel(user) {
    return user.username || user.email || user.internalEmail || ''
  }

  // Camp period helpers
  async function saveCampPeriod(id) {
    const draft = campPeriodDrafts.find(d => d.id === id)
    if (!draft) return
    setCampPeriodSaving(true)
    try {
      await setCampPeriods(prev => prev.map(p => p.id === id ? { ...p, ...draft } : p))
      setCampPeriodMessage('Period updated.')
    } catch (error) { setCampPeriodError(error.message) }
    finally { setCampPeriodSaving(false) }
  }

  async function addCampPeriod() {
    if (!newPeriodDraft.label || !newPeriodDraft.startDate || !newPeriodDraft.endDate) return
    setCampPeriodSaving(true)
    try {
      await setCampPeriods(prev => [...prev, { ...newPeriodDraft, id: crypto.randomUUID() }])
      setNewPeriodDraft({ label: '', startDate: '', endDate: '' })
      setCampPeriodMessage('Period added.')
    } catch (error) { setCampPeriodError(error.message) }
    finally { setCampPeriodSaving(false) }
  }

  async function deleteCampPeriod(id) {
    if (!window.confirm('Remove this period?')) return
    await setCampPeriods(prev => prev.filter(p => p.id !== id))
  }

  // Filtered staff list
  const filtered = useMemo(() => {
    let list = [...staffList].sort((a, b) => String(a.name).localeCompare(String(b.name)))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.role?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
      )
    }
    if (filterSeason === 'active') list = list.filter(s => s.isAssignedThisSeason !== false)
    if (filterSeason === 'inactive') list = list.filter(s => s.isAssignedThisSeason === false)
    return list
  }, [staffList, search, filterSeason])

  const activeCount = staffList.filter(s => s.isAssignedThisSeason !== false).length
  const faCount = staffList.filter(s => getTrainingMeta(s).firstAidTrained).length
  const sgCount = staffList.filter(s => getTrainingMeta(s).safeguardingTrained).length

  // Detect missing training columns: if the DB column doesn't exist, select('*') simply
  // won't return it, so the key is entirely absent from every staffList member.
  // PostgREST silently ignores unknown columns on UPDATE, so saves appear to succeed
  // with no error — we must detect the missing column from the read side instead.
  const [missingTrainingColumns, setMissingTrainingColumns] = useState(false)
  useEffect(() => {
    if (staffList.length > 0) {
      const first = staffList[0]
      setMissingTrainingColumns(!('firstAidTrained' in first) && !('first_aid_trained' in first))
    }
  }, [staffList])

  // Unlinked login accounts (no matching staff profile)
  const unlinkedLoginUsers = useMemo(() => {
    return accessUsers.filter(user => {
      const email = (user.email || '').toLowerCase()
      const username = (user.username || '').toLowerCase()
      const fullName = (user.fullName || '').toLowerCase()
      return !staffList.some(s =>
        (s.email && s.email.toLowerCase() === email) ||
        normalizeUsername(s.name) === username ||
        s.name?.toLowerCase() === fullName
      )
    })
  }, [accessUsers, staffList])

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Staff</h2>
          <p className="text-stone-500 text-sm">
            {activeCount} active this season · {faCount} first aid · {sgCount} safeguarding
          </p>
        </div>
        <button onClick={() => { setShowForm(true); setSelected(null); setEditingMember(null) }}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
          <Plus size={15} strokeWidth={2.5} /> Add Staff Member
        </button>
      </div>

      {/* Messages */}
      {missingTrainingColumns && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-red-800 text-sm space-y-2">
          <p className="font-bold flex items-center gap-2"><AlertCircle size={16} className="flex-shrink-0" /> Database migration required — training fields will not save</p>
          <p>The <code className="bg-red-100 px-1 rounded font-mono text-xs">first_aid_trained</code> and <code className="bg-red-100 px-1 rounded font-mono text-xs">safeguarding_trained</code> columns are missing from the staff table. Run the following in <strong>Supabase SQL Editor</strong>:</p>
          <pre className="bg-red-100 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{`alter table public.staff\n  add column if not exists first_aid_trained boolean not null default false,\n  add column if not exists safeguarding_trained boolean not null default false,\n  add column if not exists first_aid_expires_on date,\n  add column if not exists safeguarding_expires_on date;`}</pre>
          <p className="text-xs text-red-600">This is the content of <strong>db/31_staff_training_fields.sql</strong>. After running it, refresh the page.</p>
        </div>
      )}
      {staffError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{staffError}</span>
        </div>
      )}
      {staffMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm flex items-start gap-2">
          <Check size={16} className="mt-0.5 flex-shrink-0" /><span>{staffMessage}</span>
        </div>
      )}
      {accessError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{accessError}</span>
        </div>
      )}
      {accessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm flex items-start gap-2">
          <Check size={16} className="mt-0.5 flex-shrink-0" /><span>{accessMessage}</span>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <StaffProfileForm
          isNew
          onSave={addStaff}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text" placeholder="Search staff..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="input flex-1"
        />
        <div className="flex gap-1">
          {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, label]) => (
            <button key={val} onClick={() => setFilterSeason(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filterSeason === val ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Staff list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card text-center py-10">
            <User size={32} className="text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500">No staff found.</p>
          </div>
        ) : (
          filtered.map(s => {
            const loginUser = getLinkedLoginUser(s)
            const hasLogin = Boolean(loginUser)
            const isArchived = loginUser?.isArchived
            const training = getTrainingMeta(s)
            const faExp = expiryStatus(training.firstAidExpiresOn)
            const sgExp = expiryStatus(training.safeguardingExpiresOn)
            const dbsMeta = getDbsMeta(s)
            const isActive = s.isAssignedThisSeason !== false
            const isExpanded = selected?.id === s.id

            function toggleExpanded() {
              setSelected(prev => (prev?.id === s.id ? null : s))
              setEditingMember(null)
              setShowForm(false)
            }

            return (
              <div key={s.id} className="space-y-2">
                <div className={`card p-0 overflow-hidden ${isExpanded ? 'ring-2 ring-forest-400' : ''} ${!isActive ? 'opacity-60' : ''}`}>
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    className="w-full p-4 flex items-center gap-4 hover:shadow-sm transition-all group text-left"
                    aria-label={isExpanded ? `Collapse ${s.name}` : `Expand ${s.name}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-display font-bold text-sm flex-shrink-0 ${
                      isActive ? 'bg-forest-900' : 'bg-stone-400'
                    }`}>
                      {initials(s.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display font-semibold text-forest-950 group-hover:text-forest-700 transition-colors">{s.name}</p>
                        {hasLogin && !isArchived && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-forest-100 text-forest-800 border border-forest-200 flex items-center gap-0.5">
                            <Key size={8} /> Login
                          </span>
                        )}
                        {hasLogin && isArchived && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Login archived
                          </span>
                        )}
                        {!hasLogin && (
                          <span className="text-[10px] text-stone-400 italic">No login</span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 truncate mt-0.5">{s.role || 'Staff'}{s.email ? ` · ${s.email}` : ''}</p>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {training.firstAidTrained && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                            faExp === 'expired' ? 'bg-red-100 text-red-700 border-red-200' :
                            faExp === 'soon' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            <Heart size={8} /> FA
                            {faExp === 'expired' && ' ⚠'}
                            {faExp === 'soon' && ' !'}
                          </span>
                        )}
                        {training.safeguardingTrained && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                            sgExp === 'expired' ? 'bg-red-100 text-red-700 border-red-200' :
                            sgExp === 'soon' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-blue-100 text-blue-800 border-blue-200'
                          }`}>
                            <Shield size={8} /> SG
                            {sgExp === 'expired' && ' ⚠'}
                            {sgExp === 'soon' && ' !'}
                          </span>
                        )}
                        {dbsMeta.issueDate && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                            dbsMeta.onUpdateService ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                            dbsMeta.status === 'expired' ? 'bg-red-100 text-red-700 border-red-200' :
                            dbsMeta.status === 'soon' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            <Shield size={8} /> DBS
                            {!dbsMeta.onUpdateService && dbsMeta.status === 'expired' && ' ⚠'}
                            {!dbsMeta.onUpdateService && dbsMeta.status === 'soon' && ' !'}
                          </span>
                        )}
                        {!isActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">Not this season</span>
                        )}
                        {loginUser?.isAdmin && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-0.5">
                            <Star size={8} /> Admin
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-1.5 rounded-lg text-stone-400 group-hover:text-forest-700 transition-colors flex-shrink-0">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>
                </div>

                {isExpanded && editingMember?.id === s.id && (
                  <StaffProfileForm
                    initial={editingMember}
                    isNew={false}
                    onSave={saveEditStaff}
                    onCancel={() => setEditingMember(null)}
                  />
                )}

                {isExpanded && editingMember?.id !== s.id && (
                  <StaffDetailPanel
                    member={s}
                    loginUser={getLinkedLoginUser(s)}
                    onEdit={(member, saveOnly) => {
                      if (saveOnly) { saveEditStaff(member, true); return }
                      setEditingMember(member)
                    }}
                    onClose={() => setSelected(null)}
                    onDelete={deleteStaff}
                    onSavePermissions={savePermissions}
                    onResetPassword={resetPassword}
                    onToggleArchive={toggleArchive}
                    onDeleteAccount={deleteLoginAccount}
                    accessActionLoading={accessActionLoading}
                    canManageAccess={canManageAccess}
                    currentUserEmail={currentUserEmail}
                    accessEdits={accessEdits}
                    setAccessEdit={setAccessEdit}
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Unlinked login accounts notice */}
      {canManageAccess && unlinkedLoginUsers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <AlertTriangle size={15} /> {unlinkedLoginUsers.length} login account{unlinkedLoginUsers.length > 1 ? 's' : ''} without a staff profile
          </p>
          <p className="text-xs text-amber-700">These accounts can log in but have no staff record. Add a staff profile with a matching email, or delete these accounts.</p>
          <div className="space-y-1.5">
            {unlinkedLoginUsers.map(user => (
              <div key={user.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-stone-700 flex items-center justify-between gap-2">
                <span className="font-mono">{user.email || user.username || user.id}</span>
                <div className="flex gap-2">
                  {user.isAdmin && <span className="text-amber-700 font-semibold">Admin</span>}
                  {user.isArchived && <span className="text-stone-500">Archived</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Password reset requests */}
      {canManageAccess && resetRequests.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900">Open Password Reset Requests</p>
          <div className="space-y-2">
            {resetRequests.map(req => (
              <div key={req.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-stone-700">
                <p><span className="font-semibold">Email:</span> {req.requester_email}</p>
                {req.requester_identifier && <p><span className="font-semibold">Identifier:</span> {req.requester_identifier}</p>}
                {req.reason && <p><span className="font-semibold">Reason:</span> {req.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camp Periods */}
      <section className="card border-2 border-forest-200 space-y-4">
        <div>
          <h3 className="font-display font-bold text-forest-950 text-lg">Camp Periods</h3>
          <p className="text-sm text-stone-500">Shared date ranges used across all tabs.</p>
        </div>

        {campPeriodDrafts.length === 0 ? (
          <p className="text-sm text-stone-500">No camp periods defined yet.</p>
        ) : (
          <div className="space-y-3">
            {campPeriodDrafts.map((draft, index) => (
              <div key={draft.id} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                <div>
                  <label className="label">Label</label>
                  <input type="text" className="input" value={draft.label || ''}
                    onChange={e => setCampPeriodDrafts(prev => prev.map(item => item.id === draft.id ? { ...item, label: e.target.value } : item))}
                    placeholder={`Range ${index + 1}`} disabled={!canManageCampPeriod} />
                </div>
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" className="input" value={draft.startDate}
                    onChange={e => setCampPeriodDrafts(prev => prev.map(item => item.id === draft.id ? { ...item, startDate: e.target.value } : item))}
                    disabled={!canManageCampPeriod} />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" value={draft.endDate}
                    onChange={e => setCampPeriodDrafts(prev => prev.map(item => item.id === draft.id ? { ...item, endDate: e.target.value } : item))}
                    disabled={!canManageCampPeriod} />
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => saveCampPeriod(draft.id)} disabled={!canManageCampPeriod || campPeriodSaving}>Save</button>
                  <button type="button" className="btn-secondary text-sm text-rose-700 border-rose-200" onClick={() => deleteCampPeriod(draft.id)} disabled={!canManageCampPeriod || campPeriodSaving}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {canManageCampPeriod && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold mb-3">Add new period</p>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
              <div>
                <label className="label">Label</label>
                <input type="text" className="input" value={newPeriodDraft.label}
                  onChange={e => setNewPeriodDraft(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Week 1" />
              </div>
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input" value={newPeriodDraft.startDate}
                  onChange={e => setNewPeriodDraft(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" className="input" value={newPeriodDraft.endDate}
                  onChange={e => setNewPeriodDraft(p => ({ ...p, endDate: e.target.value }))} />
              </div>
              <button type="button" className="btn-primary text-sm" onClick={addCampPeriod}
                disabled={campPeriodSaving || !newPeriodDraft.startDate || !newPeriodDraft.endDate}>
                {campPeriodSaving ? 'Saving...' : 'Add Range'}
              </button>
            </div>
          </div>
        )}

        {!canManageCampPeriod && <p className="text-xs text-stone-500">Only owner/admin can change dates.</p>}
        {campPeriodError && <p className="text-xs text-red-700">{campPeriodError}</p>}
        {campPeriodMessage && <p className="text-xs text-emerald-700">{campPeriodMessage}</p>}
      </section>

      {/* Refresh button for access users */}
      <div className="flex items-center justify-between text-xs text-stone-400">
        <span>{currentUserEmail ? `Signed in as: ${currentUserEmail}` : ''}</span>
        <button className="flex items-center gap-1.5 text-stone-500 hover:text-stone-700" onClick={loadAccessUsers} disabled={accessLoading || accessActionLoading}>
          <RefreshCw size={12} className={accessLoading ? 'animate-spin' : ''} /> Refresh accounts
        </button>
      </div>
    </div>
  )
}
