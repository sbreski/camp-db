import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronRight,
  Edit2,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { supabase } from '../supabase'

const TAB_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'signin', label: 'Sign In / Out' },
  { id: 'shared-info', label: 'Shared Info' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'star-of-day', label: 'Star of the Day' },
  { id: 'participants', label: 'Participants' },
  { id: 'parents', label: 'Parents' },
  { id: 'dressing-rooms', label: 'Dressing Rooms' },
  { id: 'medical', label: 'Medical' },
  { id: 'behaviour', label: 'Behaviour Log' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'incidents', label: 'Reporting' },
  { id: 'staff', label: 'Staff' },
  { id: 'documents', label: 'Documents' },
]

function sanitizeAllowedTabs(tabIds) {
  const valid = (Array.isArray(tabIds) ? tabIds : []).filter(tab => TAB_OPTIONS.some(option => option.id === tab))
  if (!valid.includes('dashboard')) valid.unshift('dashboard')
  if (!valid.includes('signin')) valid.unshift('signin')
  if (!valid.includes('shared-info')) valid.unshift('shared-info')
  return [...new Set(valid)]
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[']/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

function accountLabel(user) {
  return user.username || user.email || user.internalEmail || ''
}

function StaffForm({ initial, onSave, onCancel }) {
  const empty = {
    name: '',
    role: '',
    phone: '',
    email: '',
    emergencyContact: '',
    emergencyPhone: '',
    notes: '',
    firstAidTrained: false,
    safeguardingTrained: false,
    firstAidExpiresOn: '',
    safeguardingExpiresOn: '',
    isAssignedThisSeason: true,
    createLoginAccount: false,
    tempPassword: '',
  }
  const [form, setForm] = useState({
    ...empty,
    ...initial,
    firstAidTrained: Boolean(initial?.firstAidTrained),
    safeguardingTrained: Boolean(initial?.safeguardingTrained),
    firstAidExpiresOn: initial?.firstAidExpiresOn || '',
    safeguardingExpiresOn: initial?.safeguardingExpiresOn || '',
    isAssignedThisSeason: (initial?.isAssignedThisSeason ?? initial?.is_assigned_this_season) !== false,
    createLoginAccount: false,
    tempPassword: '',
  })
  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  const derivedUsername = normalizeUsername(form.name)
  const loginIdentifier = form.email?.trim() ? form.email.trim() : derivedUsername

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (form.createLoginAccount && form.tempPassword.length < 8) return
    await onSave(form)
  }

  return (
    <div className="card border-2 border-forest-200 fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-forest-950">{initial?.id ? 'Edit Staff Member' : 'Add Staff Member'}</h3>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
      </div>
      <form onSubmit={submit} className="space-y-4">
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
          </div>
          <div>
            <label className="label">Emergency Contact Name</label>
            <input className="input" value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} placeholder="Name (Relationship)" />
          </div>
          <div>
            <label className="label">Emergency Contact Phone</label>
            <input className="input" type="tel" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} placeholder="+44 7700 000000" />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional information..." />
          </div>
          <div className="col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.isAssignedThisSeason !== false}
                onChange={e => set('isAssignedThisSeason', e.target.checked)}
              />
              Assigned to current season (can sign in)
            </label>
          </div>
          <div className="col-span-2">
            <p className="label mb-2">Training & Expiry</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <label className="inline-flex items-center gap-2 text-sm text-forest-900">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.firstAidTrained}
                  onChange={e => set('firstAidTrained', e.target.checked)}
                />
                First aid trained
              </label>
              <div>
                <label className="label">First aid expiry</label>
                <input
                  type="date"
                  className="input"
                  value={form.firstAidExpiresOn || ''}
                  onChange={e => set('firstAidExpiresOn', e.target.value)}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-forest-900">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.safeguardingTrained}
                  onChange={e => set('safeguardingTrained', e.target.checked)}
                />
                Safeguarding trained
              </label>
              <div>
                <label className="label">Safeguarding expiry</label>
                <input
                  type="date"
                  className="input"
                  value={form.safeguardingExpiresOn || ''}
                  onChange={e => set('safeguardingExpiresOn', e.target.value)}
                />
              </div>
            </div>
          </div>

          {!initial?.id && (
            <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-amber-900">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.createLoginAccount}
                  onChange={e => set('createLoginAccount', e.target.checked)}
                />
                Also create a login account for this staff member
              </label>
              {form.createLoginAccount && (
                <div className="space-y-2 pt-1">
                  <div className="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    <span className="font-semibold">Login identifier: </span>
                    {loginIdentifier
                      ? <span className="font-mono">{loginIdentifier}</span>
                      : <span className="italic">enter a name above to generate</span>}
                    {!form.email?.trim() && derivedUsername && (
                      <span className="ml-1">(auto-generated from name — no email provided)</span>
                    )}
                  </div>
                  <div>
                    <label className="label">Temporary Password *</label>
                    <input
                      className="input"
                      type="text"
                      minLength={8}
                      placeholder="Min 8 characters — share this with the staff member"
                      value={form.tempPassword}
                      onChange={e => set('tempPassword', e.target.value)}
                      required={form.createLoginAccount}
                    />
                    {form.createLoginAccount && form.tempPassword.length > 0 && form.tempPassword.length < 8 && (
                      <p className="text-xs text-red-600 mt-1">Password must be at least 8 characters</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1">{initial?.id ? 'Save Changes' : 'Add Staff Member'}</button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}

function StaffDetail({ member, onEdit, onClose }) {
  const username = normalizeUsername(member.name)
  return (
    <div className="card fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-forest-900 flex items-center justify-center text-white font-display font-bold text-lg">
            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-display font-bold text-forest-950 text-lg">{member.name}</h3>
            {member.role && <p className="text-sm text-stone-500">{member.role}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Edit2 size={13} /> Edit</button>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1"><X size={18} /></button>
        </div>
      </div>
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2 text-forest-700"><span className="text-stone-500 w-28 flex-shrink-0">Username</span>{username || '—'}</p>
        {member.phone && <p className="flex items-center gap-2 text-forest-700"><span className="text-stone-500 w-28 flex-shrink-0">Phone</span>{member.phone}</p>}
        {member.email && <p className="flex items-center gap-2 text-forest-700"><span className="text-stone-500 w-28 flex-shrink-0">Email</span>{member.email}</p>}
        {member.emergencyContact && (
          <p className="flex items-center gap-2 text-stone-700"><span className="text-stone-500 w-28 flex-shrink-0">Emergency</span>{member.emergencyContact}</p>
        )}
        {member.emergencyPhone && (
          <p className="flex items-center gap-2 text-forest-700"><span className="text-stone-500 w-28 flex-shrink-0">Emerg. Phone</span>{member.emergencyPhone}</p>
        )}
        {member.notes && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <p className="label mb-1">Notes</p>
            <p className="text-stone-700 leading-relaxed">{member.notes}</p>
          </div>
        )}
        <p className="flex items-center gap-2 text-stone-700">
          <span className="text-stone-500 w-28 flex-shrink-0">Season</span>
          <span>{member.isAssignedThisSeason === false ? 'Not assigned' : 'Assigned'}</span>
        </p>
        <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
          <p className="label">Training & Expiry</p>
          <p className="flex items-center gap-2 text-stone-700">
            <span className="text-stone-500 w-28 flex-shrink-0">First Aid</span>
            <span>{member.firstAidTrained ? 'Yes' : 'No'}</span>
            {member.firstAidExpiresOn && <span className="text-xs text-stone-500">(expires {member.firstAidExpiresOn})</span>}
          </p>
          <p className="flex items-center gap-2 text-stone-700">
            <span className="text-stone-500 w-28 flex-shrink-0">Safeguarding</span>
            <span>{member.safeguardingTrained ? 'Yes' : 'No'}</span>
            {member.safeguardingExpiresOn && <span className="text-xs text-stone-500">(expires {member.safeguardingExpiresOn})</span>}
          </p>
        </div>
      </div>
    </div>
  )
}

function CreateAccountForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    identifier: '',
    password: '',
    name: '',
    role: '',
    isAdmin: false,
    canViewTimetableOverview: false,
    canEditTimetable: false,
    canViewSafeguarding: false,
    allowedTabs: ['dashboard', 'signin'],
  })

  const resolvedIdentifier = form.identifier.trim()
    ? form.identifier.trim()
    : (form.name.trim() ? normalizeUsername(form.name) : '')

  const identifierIsEmail = resolvedIdentifier.includes('@')

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleTab(tabId) {
    setForm(prev => {
      const nextTabs = prev.allowedTabs.includes(tabId)
        ? prev.allowedTabs.filter(tab => tab !== tabId)
        : [...prev.allowedTabs, tabId]
      return { ...prev, allowedTabs: sanitizeAllowedTabs(nextTabs) }
    })
  }

  function submit(e) {
    e.preventDefault()
    onSubmit({ ...form, identifier: resolvedIdentifier })
  }

  return (
    <form onSubmit={submit} className="card border-2 border-amber-200 space-y-4">
      <div>
        <h3 className="font-display font-bold text-forest-950 text-lg">Create Login Account</h3>
        <p className="text-sm text-stone-500">Creates a Supabase auth user and permission row in one action.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Staff Name (optional)</label>
          <input className="input" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Used to auto-generate username" />
        </div>
        <div>
          <label className="label">Role (optional)</label>
          <input className="input" value={form.role} onChange={e => updateField('role', e.target.value)} />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="label">Email or Username</label>
          <input
            className="input"
            type="text"
            value={form.identifier}
            onChange={e => updateField('identifier', e.target.value)}
            placeholder="email@example.com or firstname.lastname"
          />
          {resolvedIdentifier && (
            <p className="text-xs text-stone-500 mt-1">
              Login identifier: <span className="font-mono font-semibold text-forest-800">{resolvedIdentifier}</span>
              {!identifierIsEmail && <span className="ml-1 text-amber-700">(username — no email)</span>}
            </p>
          )}
          {!form.identifier.trim() && form.name.trim() && (
            <p className="text-xs text-amber-700 mt-1">Auto-generated from name. Enter an identifier above to override.</p>
          )}
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="label">Temporary Password *</label>
          <input
            className="input"
            type="text"
            minLength={8}
            value={form.password}
            onChange={e => updateField('password', e.target.value)}
            placeholder="Min 8 characters — share this with the staff member"
            required
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-forest-900">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={form.isAdmin}
          onChange={e => updateField('isAdmin', e.target.checked)}
        />
        Full admin access
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-forest-900">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={form.canViewSafeguarding}
          onChange={e => updateField('canViewSafeguarding', e.target.checked)}
          disabled={form.isAdmin}
        />
        Can view safeguarding information
      </label>

      <div>
        <p className="label mb-2">Allowed Tabs</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TAB_OPTIONS.map(tab => (
            <label key={tab.id} className="inline-flex items-center gap-2 text-sm text-forest-800">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.allowedTabs.includes(tab.id)}
                onChange={() => toggleTab(tab.id)}
                disabled={form.isAdmin}
              />
              {tab.label}
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
        <Plus size={15} />
        {loading ? 'Creating...' : 'Create Account'}
      </button>
    </form>
  )
}

export default function Staff({ staffList, setStaffList, campPeriods, setCampPeriods, canManageCampPeriod = false }) {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)

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
  const ownerEmail = (import.meta.env.VITE_OWNER_EMAIL || '').toLowerCase()

  useEffect(() => {
    setCampPeriodDrafts(campPeriods?.map(p => ({
      id: p.id,
      label: p.label || '',
      startDate: p.startDate || p.start_date || '',
      endDate: p.endDate || p.end_date || '',
    })) || [])
  }, [campPeriods])

  async function withAccessToken() {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) {
      throw new Error('No active auth session')
    }
    setCurrentUserEmail((data.session.user?.email || '').toLowerCase())
    return data.session.access_token
  }

  async function loadAccessUsers() {
    setAccessLoading(true)
    setAccessError('')
    setAccessMessage('')

    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load users')
      }

      const users = payload.users || []
      setCanManageAccess(!!payload.currentUser?.isAdmin)
      setAccessUsers(users)
      setResetRequests(Array.isArray(payload.resetRequests) ? payload.resetRequests : [])

      const edits = {}
      users.forEach(user => {
        edits[user.id] = {
          identifier: user.username || user.email || '',
          isAdmin: !!user.isAdmin,
          canViewTimetableOverview: !!user.canViewTimetableOverview,
          canEditTimetable: !!user.canEditTimetable,
          canViewSafeguarding: !!user.canViewSafeguarding,
          allowedTabs: sanitizeAllowedTabs(user.allowedTabs),
          newPassword: '',
          deleteConfirmed: false,
        }
      })
      setAccessEdits(edits)
    } catch (error) {
      setCanManageAccess(false)
      setAccessUsers([])
      setResetRequests([])
      setAccessError(error.message)
    } finally {
      setAccessLoading(false)
    }
  }

  useEffect(() => {
    loadAccessUsers()
  }, [])

  function setEdit(userId, nextState) {
    setAccessEdits(prev => ({
      ...prev,
      [userId]: { ...prev[userId], ...nextState },
    }))
  }

  async function attemptCreateLoginAccount({ identifier, password, allowedTabs, fullName = '' }) {
    const token = await withAccessToken()
    const response = await fetch('/api/admin-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'create_user',
        email: identifier,
        password,
        isAdmin: false,
        canViewTimetableOverview: false,
        canEditTimetable: false,
        canViewSafeguarding: false,
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

      const { createLoginAccount, tempPassword, ...staffData } = data
      await setStaffList(prev => [...prev, { ...staffData, id: newId }])
      setShowForm(false)

      if (data.createLoginAccount) {
        if (!data.tempPassword || data.tempPassword.length < 8) {
          setStaffError('Login account not created: temporary password must be at least 8 characters.')
          setStaffMessage('Staff profile added.')
          return
        }
        if (!loginIdentifier) {
          setStaffError('Login account not created: could not determine a login identifier.')
          setStaffMessage('Staff profile added.')
          return
        }
        try {
          await attemptCreateLoginAccount({
            identifier: loginIdentifier,
            password: data.tempPassword,
            allowedTabs: ['dashboard', 'signin'],
            fullName: data.name?.trim() || '',
          })
          if (data.email?.trim()) {
            await setStaffList(prev => prev.map(s =>
              s.id === newId ? { ...s, email: data.email.trim().toLowerCase() } : s
            ))
          }
          setStaffMessage(
            `Staff profile added and login account created. ` +
            `Login: ${loginIdentifier} · Password: ${data.tempPassword}`
          )
          await loadAccessUsers()
        } catch (accountError) {
          setStaffMessage('Staff profile added.')
          setStaffError(`Login account error: ${accountError.message}`)
        }
      } else {
        setStaffMessage('Staff profile added.')
      }
    } catch (error) {
      setStaffError(error.message || 'Unable to add staff profile')
    } finally {
      setStaffActionLoading(false)
    }
  }

  async function saveEdit(data) {
    if (!selected) return
    setStaffActionLoading(true)
    setStaffError('')
    setStaffMessage('')
    try {
      const { createLoginAccount, tempPassword, ...staffData } = data
      await setStaffList(prev => prev.map(s => s.id === selected.id ? { ...s, ...staffData } : s))
      setSelected(s => ({ ...s, ...staffData }))
      setEditing(false)
      setStaffMessage('Staff profile updated.')
    } catch (error) {
      setStaffError(error.message || 'Unable to update staff profile')
    } finally {
      setStaffActionLoading(false)
    }
  }

  async function deleteStaff(id) {
    if (!window.confirm('Remove this staff member?')) return
    setStaffActionLoading(true)
    setStaffError('')
    setStaffMessage('')
    try {
      await setStaffList(prev => prev.filter(s => s.id !== id))
      setSelected(null)
      setStaffMessage('Staff profile removed.')
    } catch (error) {
      setStaffError(error.message || 'Unable to remove staff profile')
    } finally {
      setStaffActionLoading(false)
    }
  }

  async function createAccount(form) {
    setAccessActionLoading(true)
    setAccessError('')
    setAccessMessage('')

    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'create_user',
          email: form.identifier,
          password: form.password,
          isAdmin: form.isAdmin,
          canViewTimetableOverview: !!form.canViewTimetableOverview,
          canEditTimetable: !!form.canEditTimetable,
          canViewSafeguarding: !!form.canViewSafeguarding,
          allowedTabs: sanitizeAllowedTabs(form.allowedTabs),
          ...(form.name?.trim() ? { fullName: form.name.trim() } : {}),
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to create account')
      }

      if (form.name.trim()) {
        const isEmail = form.identifier.includes('@')
        const exists = isEmail
          ? staffList.some(member => (member.email || '').toLowerCase() === form.identifier.toLowerCase())
          : false

        if (!exists) {
          setStaffList(prev => [
            ...prev,
            {
              id: crypto.randomUUID(),
              name: form.name.trim(),
              role: form.role?.trim() || '',
              email: isEmail ? form.identifier.toLowerCase() : '',
              phone: '',
              emergencyContact: '',
              emergencyPhone: '',
              notes: '',
            },
          ])
        }
      }

      const label = payload.user?.username || payload.user?.email || form.identifier
      setAccessMessage(`Created account: ${label}`)
      await loadAccessUsers()
    } catch (error) {
      setAccessError(error.message)
    } finally {
      setAccessActionLoading(false)
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'update_permissions',
          userId,
          isAdmin: !!edit.isAdmin,
          canViewTimetableOverview: !!edit.canViewTimetableOverview,
          canEditTimetable: !!edit.canEditTimetable,
          canViewSafeguarding: !!edit.canViewSafeguarding,
          allowedTabs: sanitizeAllowedTabs(edit.allowedTabs),
          ...(fullName ? { fullName } : {}),
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save permissions')
      }

      setAccessMessage('Permissions updated successfully')
      await loadAccessUsers()
    } catch (error) {
      setAccessError(error.message)
    } finally {
      setAccessActionLoading(false)
    }
  }

  async function saveUserDetails(userId) {
    const edit = accessEdits[userId]
    if (!edit) return

    setAccessActionLoading(true)
    setAccessError('')
    setAccessMessage('')

    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'update_user',
          userId,
          email: edit.identifier,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save user details')
      }

      setAccessMessage('User details updated successfully')
      await loadAccessUsers()
    } catch (error) {
      setAccessError(error.message)
    } finally {
      setAccessActionLoading(false)
    }
  }

  async function resetPassword(userId, requestId = '') {
    const edit = accessEdits[userId]
    const newPassword = edit?.newPassword || ''
    if (newPassword.length < 8) {
      setAccessError('Password must be at least 8 characters')
      return
    }

    setAccessActionLoading(true)
    setAccessError('')
    setAccessMessage('')

    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'reset_password',
          userId,
          newPassword,
          requestId,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to reset password')
      }

      setEdit(userId, { newPassword: '' })
      setAccessMessage('Password reset. User will be asked to set a new password at next login.')
      await loadAccessUsers()
    } catch (error) {
      setAccessError(error.message)
    } finally {
      setAccessActionLoading(false)
    }
  }

  async function setArchivedState(user, shouldArchive) {
    const internalEmail = (user.internalEmail || user.email || '').toLowerCase()
    if (internalEmail && internalEmail === currentUserEmail) {
      setAccessError('You cannot change archive status for your own account while signed in')
      return
    }

    const label = accountLabel(user)
    const confirmed = window.confirm(`${shouldArchive ? 'Archive' : 'Restore'} login account for ${label}?`)
    if (!confirmed) return

    setAccessActionLoading(true)
    setAccessError('')
    setAccessMessage('')

    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: shouldArchive ? 'archive_user' : 'restore_user',
          userId: user.id,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || `Unable to ${shouldArchive ? 'archive' : 'restore'} account`)
      }

      setAccessMessage(`${shouldArchive ? 'Archived' : 'Restored'} account: ${label}`)
      await loadAccessUsers()
    } catch (error) {
      setAccessError(error.message)
    } finally {
      setAccessActionLoading(false)
    }
  }

  async function permanentlyDeleteUser(user) {
    const internalEmail = (user.internalEmail || user.email || '').toLowerCase()
    if (internalEmail && internalEmail === currentUserEmail) {
      setAccessError('You cannot permanently delete your own account while signed in')
      return
    }

    const label = accountLabel(user)
    const check = window.prompt(`Type DELETE to permanently remove ${label}. This cannot be undone.`)
    if (check !== 'DELETE') return

    setAccessActionLoading(true)
    setAccessError('')
    setAccessMessage('')

    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'delete_user',
          userId: user.id,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to permanently delete account')
      }

      setAccessMessage(`Permanently deleted account: ${label}`)
      await loadAccessUsers()
    } catch (error) {
      setAccessError(error.message)
    } finally {
      setAccessActionLoading(false)
    }
  }

  async function assignLoginToStaff(user) {
    const edit = accessEdits[user.id]
    const selectedStaffId = edit?.linkedStaffId || ''
    if (!selectedStaffId) {
      setAccessError('Choose a staff profile first.')
      return
    }

    const loginEmail = String(user.email || '').trim().toLowerCase()
    if (!loginEmail) {
      setAccessError('This login account has no email (username-only accounts cannot be linked by email).')
      return
    }

    const selectedStaff = staffList.find(member => member.id === selectedStaffId)
    if (!selectedStaff) {
      setAccessError('Selected staff profile no longer exists.')
      return
    }

    setAccessActionLoading(true)
    setAccessError('')
    setAccessMessage('')
    try {
      await setStaffList(prev => prev.map(member => {
        if (member.id === selectedStaffId) {
          return { ...member, email: loginEmail }
        }
        return member
      }))
      setAccessMessage(`Linked ${selectedStaff.name} to ${loginEmail}`)
    } catch (error) {
      setAccessError(error.message || 'Unable to link staff to login account')
    } finally {
      setAccessActionLoading(false)
    }
  }

  async function assignOwnerProfile() {
    if (!ownerEmail) {
      setStaffError('Owner email is not configured.')
      return
    }

    setStaffActionLoading(true)
    setStaffError('')
    setStaffMessage('')
    try {
      await setStaffList(prev => {
        const existing = prev.find(member => (member.email || '').toLowerCase() === ownerEmail)
        if (existing) {
          return prev.map(member => member.id === existing.id
            ? { ...member, name: 'Sam Brenner', role: 'Camp Coordinator', email: ownerEmail, isAssignedThisSeason: true }
            : member
          )
        }

        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: 'Sam Brenner',
            role: 'Camp Coordinator',
            email: ownerEmail,
            phone: '',
            emergencyContact: '',
            emergencyPhone: '',
            notes: '',
            firstAidTrained: false,
            safeguardingTrained: false,
            firstAidExpiresOn: '',
            safeguardingExpiresOn: '',
            isAssignedThisSeason: true,
          },
        ]
      })
      setStaffMessage(`Owner profile assigned to Sam Brenner (${ownerEmail}).`)
    } catch (error) {
      setStaffError(error.message || 'Unable to assign owner profile')
    } finally {
      setStaffActionLoading(false)
    }
  }

  async function saveCampPeriod(id) {
    const draft = campPeriodDrafts.find(d => d.id === id)
    if (!draft) return
    setCampPeriodSaving(true)
    try {
      await setCampPeriods(prev => prev.map(p => p.id === id ? { ...p, ...draft } : p))
      setCampPeriodMessage('Period updated.')
    } catch (error) {
      setCampPeriodError(error.message)
    } finally {
      setCampPeriodSaving(false)
    }
  }

  async function addCampPeriod() {
    if (!newPeriodDraft.label || !newPeriodDraft.startDate || !newPeriodDraft.endDate) return
    setCampPeriodSaving(true)
    try {
      await setCampPeriods(prev => [...prev, { ...newPeriodDraft, id: crypto.randomUUID() }])
      setNewPeriodDraft({ label: '', startDate: '', endDate: '' })
      setCampPeriodMessage('Period added.')
    } catch (error) {
      setCampPeriodError(error.message)
    } finally {
      setCampPeriodSaving(false)
    }
  }

  async function deleteCampPeriod(id) {
    if (!window.confirm('Remove this period?')) return
    await setCampPeriods(prev => prev.filter(p => p.id !== id))
  }

  const staffByEmail = useMemo(() => {
    const map = new Map()
    staffList.forEach(member => {
      const email = (member.email || '').toLowerCase()
      if (email) map.set(email, member)
    })
    return map
  }, [staffList])

  return (
    <div className="fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Staff</h2>
          <p className="text-stone-500 text-sm">{staffList.length} staff members</p>
        </div>
        <button onClick={() => { setShowForm(true); setSelected(null) }} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
          <Plus size={15} strokeWidth={2.5} /> Add Staff
        </button>
      </div>

      {showForm && (
        <StaffForm onSave={addStaff} onCancel={() => setShowForm(false)} />
      )}

      {staffError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5" />
          <span>{staffError}</span>
        </div>
      )}

      {staffMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm flex items-start gap-2">
          <Check size={16} className="mt-0.5" />
          <span>{staffMessage}</span>
        </div>
      )}

      {selected && !editing && (
        <StaffDetail
          member={selected}
          onEdit={() => setEditing(true)}
          onClose={() => setSelected(null)}
        />
      )}

      {selected && editing && (
        <StaffForm initial={selected} onSave={saveEdit} onCancel={() => setEditing(false)} />
      )}

      <div className="space-y-2">
        {staffList.length === 0 ? (
          <div className="card text-center py-10">
            <User size={32} className="text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500">No staff added yet.</p>
          </div>
        ) : (
          staffList.map(s => (
            <div key={s.id}
              className={`card flex items-center gap-4 hover:shadow-sm transition-shadow group cursor-pointer ${selected?.id === s.id ? 'ring-2 ring-forest-400' : ''}`}
              onClick={() => { setSelected(s); setEditing(false); setShowForm(false) }}>
              <div className="w-10 h-10 rounded-full bg-forest-900 flex items-center justify-center text-white font-display font-bold text-sm flex-shrink-0">
                {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-forest-950 group-hover:text-forest-700">{s.name}</p>
                <p className="text-xs text-stone-400 truncate">{s.role || 'Staff'}{s.phone ? ` · ${s.phone}` : ''}</p>
                <p className="text-xs text-forest-700 mt-0.5">@{normalizeUsername(s.name) || 'no-username'}</p>
                <div className="flex items-center gap-1 mt-1">
                  {s.firstAidTrained && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">FA</span>}
                  {s.safeguardingTrained && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">SG</span>}
                  {s.isAssignedThisSeason === false && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">No camp assigned</span>}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteStaff(s.id) }}
                className="p-1.5 text-stone-400 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <Trash2 size={15} />
              </button>
              <ChevronRight size={18} className="text-stone-400 group-hover:text-forest-700" />
            </div>
          ))
        )}
      </div>

      <section className="card border-2 border-forest-200 space-y-4">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3">
          <div>
            <h3 className="font-display font-bold text-forest-950 text-lg">Camp Period</h3>
            <p className="text-sm text-stone-600">Used as the shared custom date ranges across tabs.</p>
          </div>

          {campPeriodDrafts.length === 0 ? (
            <p className="text-sm text-stone-500">No camp period ranges defined yet.</p>
          ) : (
            <div className="space-y-3">
              {campPeriodDrafts.map((draft, index) => (
                <div key={draft.id} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <label className="label">Label</label>
                    <input
                      type="text"
                      className="input"
                      value={draft.label || ''}
                      onChange={e => setCampPeriodDrafts(prev => prev.map(item => item.id === draft.id ? { ...item, label: e.target.value } : item))}
                      placeholder={`Range ${index + 1}`}
                      disabled={!canManageCampPeriod}
                    />
                  </div>
                  <div>
                    <label className="label">Start Date</label>
                    <input
                      type="date"
                      className="input"
                      value={draft.startDate}
                      onChange={e => setCampPeriodDrafts(prev => prev.map(item => item.id === draft.id ? { ...item, startDate: e.target.value } : item))}
                      disabled={!canManageCampPeriod}
                    />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input
                      type="date"
                      className="input"
                      value={draft.endDate}
                      onChange={e => setCampPeriodDrafts(prev => prev.map(item => item.id === draft.id ? { ...item, endDate: e.target.value } : item))}
                      disabled={!canManageCampPeriod}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => saveCampPeriod(draft.id)}
                      disabled={!canManageCampPeriod || campPeriodSaving}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm text-rose-700 border-rose-200 hover:bg-rose-50"
                      onClick={() => deleteCampPeriod(draft.id)}
                      disabled={!canManageCampPeriod || campPeriodSaving}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {canManageCampPeriod && (
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-sm font-semibold mb-3">Add a new camp period</p>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                <div>
                  <label className="label">Label</label>
                  <input
                    type="text"
                    className="input"
                    value={newPeriodDraft.label}
                    onChange={e => setNewPeriodDraft(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g. Week 1"
                  />
                </div>
                <div>
                  <label className="label">Start Date</label>
                  <input
                    type="date"
                    className="input"
                    value={newPeriodDraft.startDate}
                    onChange={e => setNewPeriodDraft(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input
                    type="date"
                    className="input"
                    value={newPeriodDraft.endDate}
                    onChange={e => setNewPeriodDraft(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={addCampPeriod}
                  disabled={campPeriodSaving || !newPeriodDraft.startDate || !newPeriodDraft.endDate}
                >
                  {campPeriodSaving ? 'Saving...' : 'Add Range'}
                </button>
              </div>
            </div>
          )}

          {!canManageCampPeriod && (
            <p className="text-xs text-stone-500">Only owner/admin can change dates. Everyone can see and use the selected ranges.</p>
          )}
          {campPeriodError && <p className="text-xs text-red-700">{campPeriodError}</p>}
          {campPeriodMessage && <p className="text-xs text-emerald-700">{campPeriodMessage}</p>}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-forest-950 text-lg flex items-center gap-2">
              <Shield size={18} /> User Access Management
            </h3>
            <p className="text-sm text-stone-500">Create login accounts, edit tab permissions, and reset passwords.</p>
            {currentUserEmail && <p className="text-xs text-stone-400 mt-1">Signed in as: {currentUserEmail}</p>}
          </div>
          <button className="btn-secondary text-sm flex items-center gap-2" onClick={loadAccessUsers} disabled={accessLoading || accessActionLoading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {accessLoading && <p className="text-sm text-stone-500">Loading user accounts...</p>}

        {accessError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{accessError}</span>
          </div>
        )}

        {accessMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm flex items-start gap-2">
            <Check size={16} className="mt-0.5" />
            <span>{accessMessage}</span>
          </div>
        )}

        {!accessLoading && !canManageAccess && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm">
            This account does not have admin permission to manage users. Sign in with the owner/admin account.
          </div>
        )}

        {!accessLoading && canManageAccess && (
          <>
            <div className="rounded-xl border border-stone-200 p-3 bg-stone-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm text-stone-700">Quick setup: assign owner profile to Sam Brenner / Camp Coordinator.</p>
              <button className="btn-secondary text-sm" onClick={assignOwnerProfile} disabled={staffActionLoading}>
                Set Owner Profile
              </button>
            </div>

            <CreateAccountForm onSubmit={createAccount} loading={accessActionLoading} />

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-900">Open Password Reset Requests</p>
              {resetRequests.length === 0 ? (
                <p className="text-xs text-amber-800">No open requests.</p>
              ) : (
                <div className="space-y-2">
                  {resetRequests.map(request => (
                    <div key={request.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-stone-700">
                      <p><span className="font-semibold">Email:</span> {request.requester_email}</p>
                      {request.requester_identifier && <p><span className="font-semibold">Identifier:</span> {request.requester_identifier}</p>}
                      {request.reason && <p><span className="font-semibold">Reason:</span> {request.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="font-display font-semibold text-forest-950">Existing Login Accounts</h4>
              {accessUsers.length === 0 && <p className="text-sm text-stone-500">No auth users found.</p>}

              {accessUsers.map(user => {
                const edit = accessEdits[user.id] || {
                  identifier: user.username || user.email || '',
                  isAdmin: false,
                  allowedTabs: ['dashboard', 'signin'],
                  newPassword: '',
                  deleteConfirmed: false,
                }
                const linkedStaff =
                staffByEmail.get((user.email || '').toLowerCase())
                  || staffByEmail.get((user.internalEmail || '').toLowerCase())
                  || staffByEmail.get((user.username || '').toLowerCase()) //
                  || (user.username ? staffList.find(m => normalizeUsername(m.name) === user.username) : null)
                  || (user.fullName ? staffList.find(m => m.name === user.fullName) : null)
                const isCurrentUser = (user.internalEmail || user.email || '').toLowerCase() === currentUserEmail
                const pendingRequest = resetRequests.find(request =>
                  (request.requester_email || '').toLowerCase() === (user.email || '').toLowerCase()
                )
                const derivedUsername = linkedStaff?.name
                  ? normalizeUsername(linkedStaff.name)
                  : (user.username || normalizeUsername((user.email || '').split('@')[0] || ''))

                const label = accountLabel(user)
                const isUsernameAccount = !!user.username

                return (
                  <div key={user.id} className="rounded-xl border border-stone-200 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <p className="font-semibold text-forest-950">{label}</p>
                        {isUsernameAccount && (
                          <p className="text-xs text-amber-700 mt-0.5">Username-only account (no email)</p>
                        )}
                        <p className="text-xs text-stone-600 mt-1">
                          Login as: <span className="font-semibold text-forest-900 font-mono">{derivedUsername || label}</span>
                        </p>
                        <p className="text-xs text-stone-500">User ID: {user.id}</p>
                        {pendingRequest && <p className="text-xs text-amber-700 mt-1">Open reset request pending</p>}
                        {user.isArchived && <p className="text-xs text-amber-700 mt-1">Archived (login disabled)</p>}
                        {linkedStaff && <p className="text-xs text-forest-700 mt-1">Linked staff record: {linkedStaff.name}</p>}
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-forest-900">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!edit.isAdmin}
                          onChange={e => setEdit(user.id, { isAdmin: e.target.checked })}
                        />
                        Full admin
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                      <div>
                        <input
                          className="input"
                          value={edit.identifier || ''}
                          onChange={e => setEdit(user.id, { identifier: e.target.value })}
                          placeholder="Email or username (firstname.lastname)"
                          disabled={isCurrentUser}
                        />
                        {!isCurrentUser && (
                          <p className="text-xs text-stone-400 mt-1">Enter an email or a plain username like firstname.lastname</p>
                        )}
                      </div>
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => saveUserDetails(user.id)}
                        disabled={accessActionLoading || isCurrentUser}
                        title={isCurrentUser ? 'Sign in as another admin to edit this identifier' : 'Save account identifier'}
                      >
                        Save Account
                      </button>
                    </div>

                    {!isUsernameAccount && (
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                        <select
                          className="input"
                          value={edit.linkedStaffId || linkedStaff?.id || ''}
                          onChange={e => setEdit(user.id, { linkedStaffId: e.target.value })}
                        >
                          <option value="">Select staff profile to link</option>
                          {[...staffList]
                            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                            .map(member => (
                              <option key={member.id} value={member.id}>
                                {member.name}{member.email ? ` (${member.email})` : ''}
                              </option>
                            ))}
                        </select>
                        <button
                          className="btn-secondary text-sm"
                          onClick={() => assignLoginToStaff(user)}
                          disabled={accessActionLoading || staffActionLoading}
                        >
                          Link Staff Email
                        </button>
                      </div>
                    )}

                    <div>
                      <p className="label mb-2">Allowed Tabs</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {TAB_OPTIONS.map(tab => (
                          <label key={tab.id} className="inline-flex items-center gap-2 text-sm text-forest-800">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={edit.allowedTabs.includes(tab.id)}
                              onChange={() => {
                                const nextTabs = edit.allowedTabs.includes(tab.id)
                                  ? edit.allowedTabs.filter(value => value !== tab.id)
                                  : [...edit.allowedTabs, tab.id]
                                setEdit(user.id, { allowedTabs: sanitizeAllowedTabs(nextTabs) })
                              }}
                              disabled={!!edit.isAdmin}
                            />
                            {tab.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        className="btn-secondary text-sm flex items-center justify-center gap-2"
                        onClick={() => savePermissions(user.id, linkedStaff?.name || user.fullName || '')}
                        disabled={accessActionLoading}
                      >
                        <Save size={14} /> Save Permissions
                      </button>
                      <input
                        className="input sm:max-w-xs"
                        placeholder="New password (min 8 chars)"
                        value={edit.newPassword || ''}
                        onChange={e => setEdit(user.id, { newPassword: e.target.value })}
                      />
                      <button
                        className="btn-primary text-sm"
                        onClick={() => resetPassword(user.id, pendingRequest?.id || '')}
                        disabled={accessActionLoading}
                      >
                        Reset Password
                      </button>
                      <button
                        className={`btn-secondary text-sm ${user.isArchived ? 'text-forest-700 border-forest-200' : 'text-amber-700 border-amber-200'}`}
                        onClick={() => setArchivedState(user, !user.isArchived)}
                        disabled={accessActionLoading || isCurrentUser}
                        title={isCurrentUser ? 'You cannot change archive status on your currently signed-in account' : user.isArchived ? 'Restore login account' : 'Archive login account'}
                      >
                        {user.isArchived ? 'Restore Account' : 'Archive Account'}
                      </button>
                      <label className="inline-flex items-center gap-2 text-xs text-stone-600 px-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!edit.deleteConfirmed}
                          onChange={e => setEdit(user.id, { deleteConfirmed: e.target.checked })}
                          disabled={isCurrentUser}
                        />
                        I understand this permanently deletes the account.
                      </label>
                      <button
                        className="btn-secondary text-sm text-red-700 border-red-200"
                        onClick={() => permanentlyDeleteUser(user)}
                        disabled={accessActionLoading || isCurrentUser || !edit.deleteConfirmed}
                        title={isCurrentUser ? 'You cannot delete your currently signed-in account' : !edit.deleteConfirmed ? 'Tick the confirmation checkbox first' : 'Permanently delete login account'}
                      >
                        Permanent Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
