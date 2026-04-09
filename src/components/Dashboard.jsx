import { Users, LogIn, LogOut, AlertTriangle, Clock, Stethoscope } from 'lucide-react'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard({ participants, attendance, incidents, onNavigate }) {
  const today = todayKey()
  const todayAttendance = attendance.filter(a => a.date === today)
  const signedInIds = new Set(todayAttendance.filter(a => a.signIn && !a.signOut).map(a => a.participantId))
  const signedOutToday = todayAttendance.filter(a => a.signOut).length
  const medicalCount = participants.filter(p => p.medicalType && p.medicalType.length > 0).length
  const recentIncidents = incidents.slice(-3).reverse()

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-display font-bold text-forest-950">{greeting}! 👋</h2>
        <p className="text-stone-500 text-sm mt-0.5">
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Participants',
            value: participants.length,
            icon: Users,
            color: 'bg-forest-900 text-white',
            onClick: () => onNavigate('participants'),
          },
          {
            label: 'Signed In Now',
            value: signedInIds.size,
            icon: LogIn,
            color: 'bg-amber-500 text-forest-950',
            onClick: () => onNavigate('signin'),
          },
          {
            label: 'Signed Out Today',
            value: signedOutToday,
            icon: LogOut,
            color: 'bg-blue-600 text-white',
            onClick: () => onNavigate('signin'),
          },
          {
            label: 'Medical Flags',
            value: medicalCount,
            icon: Stethoscope,
            color: 'bg-red-600 text-white',
            onClick: () => onNavigate('medical'),
          },
        ].map(({ label, value, icon: Icon, color, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="card hover:shadow-md transition-shadow text-left group"
          >
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
              <Icon size={18} strokeWidth={2.5} />
            </div>
            <p className="text-2xl font-display font-bold text-forest-950">{value}</p>
            <p className="text-xs text-stone-500 font-body mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Today's attendance */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-forest-950">Currently On Site</h3>
            <button onClick={() => onNavigate('signin')} className="text-xs text-forest-600 hover:underline font-medium">
              Manage →
            </button>
          </div>
          {signedInIds.size === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">Nobody signed in yet today</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {participants.filter(p => signedInIds.has(p.id)).map(p => {
                const rec = todayAttendance.find(a => a.participantId === p.id && !a.signOut)
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-forest-950">{p.name}</p>
                      <p className="text-xs text-stone-400">{p.pronouns}{p.age ? ` · Age ${p.age}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500">
                      <Clock size={12} />
                      {fmt(rec?.signIn)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent incidents */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-forest-950">Recent Incidents</h3>
            <button onClick={() => onNavigate('incidents')} className="text-xs text-forest-600 hover:underline font-medium">
              View all →
            </button>
          </div>
          {recentIncidents.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No incidents logged</p>
          ) : (
            <div className="space-y-3">
              {recentIncidents.map(inc => {
                const p = participants.find(x => x.id === inc.participantId)
                return (
                  <div key={inc.id} className="flex items-start gap-3 py-2 border-b border-stone-50 last:border-0">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      inc.severity === 'high' ? 'bg-red-500' :
                      inc.severity === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-forest-950">{p?.name || 'Unknown'}</p>
                      <p className="text-xs text-stone-500 line-clamp-1">{inc.description}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{new Date(inc.createdAt).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h3 className="font-display font-semibold text-forest-950 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate('signin')} className="btn-primary flex items-center gap-2">
            <LogIn size={15} /> Sign In / Out
          </button>
          <button onClick={() => onNavigate('participants')} className="btn-secondary flex items-center gap-2">
            <Users size={15} /> Add Participant
          </button>
          <button onClick={() => onNavigate('incidents')} className="btn-secondary flex items-center gap-2">
            <AlertTriangle size={15} /> Log Incident
          </button>
          <button onClick={() => onNavigate('medical')} className="btn-secondary flex items-center gap-2">
            <Stethoscope size={15} /> Medical Overview
          </button>
        </div>
      </div>
    </div>
  )
}
