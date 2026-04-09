import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { CAMP_NAME, CAMP_PASSWORD } from '../App'

export default function Login({ onSuccess }) {
  const [input, setInput] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (input === CAMP_PASSWORD) {
      onSuccess()
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setInput('')
    }
  }

  return (
    <div className="min-h-screen bg-forest-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      <div className={`relative w-full max-w-sm fade-in ${shake ? 'animate-bounce' : ''}`}>
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-forest-900 rounded-2xl flex items-center justify-center shadow-lg">
              <Lock size={28} className="text-amber-400" strokeWidth={2} />
            </div>
          </div>
          <h1 className="text-2xl font-display font-bold text-center text-forest-950 mb-1">{CAMP_NAME}</h1>
          <p className="text-center text-stone-500 text-sm mb-8 font-body">Staff access only</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={input}
                  onChange={e => { setInput(e.target.value); setError(false) }}
                  className={`input pr-10 ${error ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                  placeholder="Enter staff password"
                  autoFocus
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-red-600 text-xs mt-1.5 font-medium">Incorrect password. Try again.</p>}
            </div>
            <button type="submit" className="btn-primary w-full py-3 text-base">Sign In</button>
          </form>
          <p className="text-center text-xs text-stone-400 mt-6">Forgotten the password? Contact your camp coordinator.</p>
        </div>
      </div>
    </div>
  )
}
