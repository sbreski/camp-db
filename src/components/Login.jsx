import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { CAMP_NAME } from '../App'
import { supabase } from '../supabase'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [resetReason, setResetReason] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [resetError, setResetError] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)

  function normalizeUsername(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[']/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '')
  }

  async function resolveLoginEmail(rawIdentifier) {
    const value = String(rawIdentifier || '').trim()
    if (!value) return ''
    if (value.includes('@')) return value.toLowerCase()

    const lowered = value.toLowerCase()
    const targetUsername = normalizeUsername(value)
    const { data, error: lookupError } = await supabase
      .from('staff')
      .select('email,name')
      .is('deleted_at', null)

    if (lookupError) {
      throw new Error('Unable to look up username. Please use your email address.')
    }

    const rows = Array.isArray(data) ? data : []
    const exact = rows.find(row => String(row?.name || '').trim().toLowerCase() === lowered)
    if (exact?.email) return String(exact.email).trim().toLowerCase()

    const usernameMatches = rows.filter(row => normalizeUsername(row?.name) === targetUsername && row?.email)
    if (usernameMatches.length === 1) {
      return String(usernameMatches[0].email).trim().toLowerCase()
    }
    if (usernameMatches.length > 1) {
      throw new Error('That username matches multiple staff. Please use your email address.')
    }

    const fallback = rows.find(row => String(row?.name || '').trim().toLowerCase().startsWith(lowered))
    if (fallback?.email) return String(fallback.email).trim().toLowerCase()

    throw new Error('Username not found. Use format like sam.brenner, full name, or email address.')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    let email = ''

    try {
      email = await resolveLoginEmail(identifier)
      if (!email) {
        setError('Please enter your username or email.')
        setLoading(false)
        return
      }
    } catch (lookupError) {
      setLoading(false)
      setError(lookupError.message || 'Unable to resolve username')
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (signInError) {
      setError(signInError.message || 'Unable to sign in')
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setPassword('')
    }
  }

  async function handleResetRequest(e) {
    e.preventDefault()
    setResetError('')
    setResetMessage('')
    setResetLoading(true)

    try {
      const email = await resolveLoginEmail(identifier)
      if (!email) {
        throw new Error('Enter your username or email first.')
      }

      const response = await fetch('/api/password-reset-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_request',
          email,
          identifier: identifier.trim(),
          reason: resetReason.trim(),
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to submit reset request')

      setResetMessage('Reset request sent. An admin will reset your password and provide a temporary one.')
      setResetReason('')
    } catch (requestError) {
      setResetError(requestError.message || 'Unable to submit reset request')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-forest-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      <div className={`relative w-full max-w-sm fade-in ${shake ? 'animate-bounce' : ''}`}>
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <img
              src="/icon.svg"
              alt="Impact Kidz"
              className="w-20 h-20 rounded-2xl shadow-lg object-contain bg-forest-900 p-2"
            />
          </div>
          <h1 className="text-2xl font-display font-bold text-center text-forest-950 mb-1">{CAMP_NAME}</h1>
          <p className="text-center text-stone-500 text-sm mb-8 font-body">Staff access only</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username or Email</label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="input"
                placeholder="sam.brenner, Sam Brenner, or name@camp.org"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  className={`input pr-10 ${error ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                  placeholder="Enter your password"
                  required
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-600 text-xs mt-1.5 font-medium">{error}</p>}
            </div>
            <button type="submit" disabled={loading} className={`btn-primary w-full py-3 text-base ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <form onSubmit={handleResetRequest} className="mt-5 pt-5 border-t border-stone-100 space-y-2">
            <p className="text-xs font-semibold text-forest-900">Forgot password?</p>
            <p className="text-xs text-stone-500">Request a reset from admin/owner. Use the same username or email above.</p>
            <textarea
              className="input resize-none text-sm"
              rows={2}
              value={resetReason}
              onChange={e => setResetReason(e.target.value)}
              placeholder="Optional note for admin"
            />
            <button type="submit" disabled={resetLoading} className={`btn-secondary w-full ${resetLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {resetLoading ? 'Sending Request...' : 'Request Password Reset'}
            </button>
            {resetMessage && <p className="text-xs text-emerald-700">{resetMessage}</p>}
            {resetError && <p className="text-xs text-red-700">{resetError}</p>}
          </form>
        </div>
      </div>
    </div>
  )
}
