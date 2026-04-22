import { useState } from 'react'
import { LayoutDashboard, Users, LogIn, Stethoscope, AlertTriangle, LogOut, Menu, X, CalendarDays, UserCog, UserCheck, Shirt, FileText, ClipboardList, Star } from 'lucide-react'
import { CAMP_NAME } from '../App'

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'signin', label: 'Sign In / Out', icon: LogIn },
  { id: 'shared-info', label: 'Shared Info', icon: ClipboardList },
  { id: 'attendance', label: 'Attendance', icon: CalendarDays },
  { id: 'star-of-day', label: 'Star of the Day', icon: Star },
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'parents', label: 'Parents', icon: UserCheck },
  { id: 'dressing-rooms', label: 'Dressing Rooms', icon: Shirt },
  { id: 'medical', label: 'Medical', icon: Stethoscope },
  { id: 'behaviour', label: 'Behaviour Log', icon: FileText },
  { id: 'incidents', label: 'Reporting', icon: AlertTriangle },
  { id: 'staff', label: 'Staff', icon: UserCog },
  { id: 'documents', label: 'Documents', icon: FileText },
]

export default function Nav({ page, onNavigate, onLogout, visibleTabIds = [] }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const visibleItems = NAV_ITEMS.filter(item => visibleTabIds.includes(item.id))

  // Short name for sidebar
  const [line1, line2] = CAMP_NAME.includes(' ') ? [CAMP_NAME.split(' ').slice(0, 2).join(' '), CAMP_NAME.split(' ').slice(2).join(' ')] : [CAMP_NAME, '']

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-56 bg-forest-950 z-30">
        <div className="p-5 border-b border-forest-800">
          <div className="flex items-center gap-3">
            <img src="/ik-logo.png" alt="Impact Kidz" className="h-10 w-10 rounded-lg object-contain bg-forest-900 p-1" />
            <h1 className="font-display font-bold text-white text-base leading-tight">
              {line1}<br />
              <span className="text-amber-400">{line2}</span>
            </h1>
          </div>
          <p className="text-forest-400 text-xs mt-1 font-body">Staff Portal</p>
        </div>
        <div className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-display font-medium transition-all duration-150 ${
                page === id ? 'bg-amber-500 text-forest-950' : 'text-forest-200 hover:bg-forest-800 hover:text-white'
              }`}>
              <Icon size={17} strokeWidth={2} />{label}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-forest-800">
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-display font-medium text-forest-400 hover:bg-forest-800 hover:text-white transition-all">
            <LogOut size={17} />Sign Out
          </button>
        </div>
      </nav>

      {/* Mobile topbar */}
      <nav className="md:hidden fixed top-0 left-0 right-0 bg-forest-950 z-30 flex items-center justify-between px-4 h-14">
        <h1 className="font-display font-bold text-white text-sm">
          Impact Kidz <span className="text-amber-400">Camp</span>
        </h1>
        <button onClick={() => setMobileOpen(o => !o)} className="text-white p-1">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-forest-950 p-3 space-y-1 shadow-xl"
            onClick={e => e.stopPropagation()}>
            {visibleItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { onNavigate(id); setMobileOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-display font-medium transition-all ${
                  page === id ? 'bg-amber-500 text-forest-950' : 'text-forest-200 hover:bg-forest-800 hover:text-white'
                }`}>
                <Icon size={17} />{label}
              </button>
            ))}
            <button onClick={() => { onLogout(); setMobileOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-display font-medium text-forest-400 hover:bg-forest-800 hover:text-white">
              <LogOut size={17} />Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  )
}
