import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import Login from './components/Login'
import Nav from './components/Nav'
import Dashboard from './components/Dashboard'
import SignInOut from './components/SignInOut'
import Participants from './components/Participants'
import ParticipantDetail from './components/ParticipantDetail'
import Parents from './components/Parents'
import Medical from './components/Medical'
import Incidents from './components/Incidents'
import AttendanceOverview from './components/AttendanceOverview'
import Staff from './components/Staff'

export const CAMP_NAME = 'Impact Kidz Summer Camp'
export const CAMP_PASSWORD = 'mickey2026'
export const STAFF_PASSWORD = 'shrek2021'

function useSupabaseTable(table, orderBy = 'created_at') {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: rows, error } = await supabase.from(table).select('*').order(orderBy)
    if (!error) setData(rows || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [table])

  return [data, setData, loading, load]
}

function toSnake(obj) {
  const map = {
    parentName: 'parent_name', parentEmail: 'parent_email', parentPhone: 'parent_phone',
    approvedAdults: 'approved_adults', medicalType: 'medical_type', medicalDetails: 'medical_details',
    sendNeeds: 'send_needs', sendDiagnosed: 'send_diagnosed', dressingRoom: 'dressing_room',
    castPart: 'cast_part', costume: 'costume',
    participantId: 'participant_id', signIn: 'sign_in', signOut: 'sign_out',
    collectedBy: 'collected_by', staffMember: 'staff_member', pdfName: 'pdf_name',
    pdfData: 'pdf_data', emergencyContact: 'emergency_contact', emergencyPhone: 'emergency_phone',
    createdAt: 'created_at',
  }
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    result[map[k] || k] = v
  }
  // Only process age if it exists in the input object (for participants table)
  if ('age' in obj) {
    if (result.age === '' || result.age === undefined) result.age = null
    if (result.age !== null) result.age = parseInt(result.age) || null
  }
  return result
}

function attendanceToSnake(obj) {
  const map = {
    participantId: 'participant_id', 
    signIn: 'sign_in', 
    signOut: 'sign_out',
    collectedBy: 'collected_by',
    createdAt: 'created_at',
  }
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k in map) {
      result[map[k]] = v
    } else {
      result[k] = v // Keep original key if not in map
    }
  }
  return result
}

function toCamel(obj) {
  const map = {
    parent_name: 'parentName', parent_email: 'parentEmail', parent_phone: 'parentPhone',
    approved_adults: 'approvedAdults', medical_type: 'medicalType', medical_details: 'medicalDetails',
    send_needs: 'sendNeeds', send_diagnosed: 'sendDiagnosed', dressing_room: 'dressingRoom',
    cast_part: 'castPart', costume: 'costume',
    participant_id: 'participantId', sign_in: 'signIn', sign_out: 'signOut',
    collected_by: 'collectedBy', staff_member: 'staffMember', pdf_name: 'pdfName',
    pdf_data: 'pdfData', emergency_contact: 'emergencyContact', emergency_phone: 'emergencyPhone',
    created_at: 'createdAt',
  }
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    result[map[k] || k] = v
  }
  return result
}

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('camp_authed') === 'true')
  const [page, setPage] = useState('dashboard')
  const [selectedParticipantId, setSelectedParticipantId] = useState(null)

  const [rawParticipants, , loadingP, reloadP] = useSupabaseTable('participants')
  const [rawAttendance, , loadingA, reloadA] = useSupabaseTable('attendance', 'date')
  const [rawIncidents, , loadingI, reloadI] = useSupabaseTable('incidents')
  const [rawStaff, , loadingS, reloadS] = useSupabaseTable('staff')

  const participants = rawParticipants.map(toCamel)
  const attendance = rawAttendance.map(toCamel)
  const incidents = rawIncidents.map(toCamel)
  const staffList = rawStaff.map(toCamel)

  const loading = loadingP || loadingA || loadingI || loadingS

  async function setParticipants(updater) {
    const next = typeof updater === 'function' ? updater(participants) : updater
    const added = next.filter(p => !participants.find(x => x.id === p.id))
    const removed = participants.filter(p => !next.find(x => x.id === p.id))
    const changed = next.filter(p => {
      const old = participants.find(x => x.id === p.id)
      return old && JSON.stringify(old) !== JSON.stringify(p)
    })
    for (const p of added) {
      const { id, ...rest } = toSnake(p)
      const { error } = await supabase.from('participants').insert({ id: p.id, ...rest })
      if (error) console.error('INSERT ERROR:', error.message, error.details, error.hint)
    }
    for (const p of removed) {
      await supabase.from('participants').delete().eq('id', p.id)
    }
    for (const p of changed) {
      const { id, ...rest } = toSnake(p)
      await supabase.from('participants').update(rest).eq('id', p.id)
    }
    reloadP()
  }

  async function setAttendance(updater) {
    const next = typeof updater === 'function' ? updater(attendance) : updater
    const added = next.filter(a => !attendance.find(x => x.id === a.id))
    const changed = next.filter(a => {
      const old = attendance.find(x => x.id === a.id)
      return old && JSON.stringify(old) !== JSON.stringify(a)
    })
    const removed = attendance.filter(a => !next.find(x => x.id === a.id))
    for (const a of added) {
      const { error } = await supabase.from('attendance').insert(attendanceToSnake(a))
      if (error) console.error('ATTENDANCE INSERT ERROR:', error.message)
    }
    for (const a of changed) {
      const { id, ...rest } = attendanceToSnake(a)
      const { error } = await supabase.from('attendance').update(rest).eq('id', a.id)
      if (error) console.error('ATTENDANCE UPDATE ERROR:', error.message)
    }
    for (const a of removed) {
      await supabase.from('attendance').delete().eq('id', a.id)
    }
    reloadA()
  }

  async function setIncidents(updater) {
    const next = typeof updater === 'function' ? updater(incidents) : updater
    const added = next.filter(i => !incidents.find(x => x.id === i.id))
    const removed = incidents.filter(i => !next.find(x => x.id === i.id))
    for (const inc of added) {
      const { id, ...rest } = toSnake(inc)
      const { error } = await supabase.from('incidents').insert({ id: inc.id, ...rest })
      if (error) console.error('INCIDENT INSERT ERROR:', error.message)
    }
    for (const inc of removed) {
      const { error } = await supabase.from('incidents').delete().eq('id', inc.id)
      if (error) console.error('INCIDENT DELETE ERROR:', error.message)
    }
    reloadI()
  }

  async function setStaffList(updater) {
    const next = typeof updater === 'function' ? updater(staffList) : updater
    const added = next.filter(s => !staffList.find(x => x.id === s.id))
    const removed = staffList.filter(s => !next.find(x => x.id === s.id))
    const changed = next.filter(s => {
      const old = staffList.find(x => x.id === s.id)
      return old && JSON.stringify(old) !== JSON.stringify(s)
    })
    for (const s of added) {
      const { id, ...rest } = toSnake(s)
      const { error } = await supabase.from('staff').insert({ id: s.id, ...rest })
      if (error) console.error('STAFF INSERT ERROR:', error.message)
    }
    for (const s of removed) {
      await supabase.from('staff').delete().eq('id', s.id)
    }
    for (const s of changed) {
      const { id, ...rest } = toSnake(s)
      await supabase.from('staff').update(rest).eq('id', s.id)
    }
    reloadS()
  }

  const logoutTimer = useRef(null)

  useEffect(() => {
    function resetTimer() {
      if (logoutTimer.current) clearTimeout(logoutTimer.current)
      logoutTimer.current = setTimeout(() => {
        sessionStorage.removeItem('camp_authed')
        setAuthed(false)
      }, 10 * 60 * 1000) // 10 minutes
    }

    function handleActivity() {
      resetTimer()
    }

    // Set initial timer
    resetTimer()

    // Add event listeners
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('click', handleActivity)
    window.addEventListener('scroll', handleActivity)

    return () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current)
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('scroll', handleActivity)
    }
  }, [])

  if (!authed) {
    return <Login onSuccess={() => {
      sessionStorage.setItem('camp_authed', 'true')
      setAuthed(true)
    }} />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-display font-medium">Loading database...</p>
        </div>
      </div>
    )
  }

  function navigate(p, id = null) {
    setPage(p)
    if (id !== null) setSelectedParticipantId(id)
  }

  function renderPage() {
    switch (page) {
      case 'dashboard': return <Dashboard participants={participants} attendance={attendance} incidents={incidents} onNavigate={navigate} />
      case 'signin': return <SignInOut participants={participants} attendance={attendance} setAttendance={setAttendance} />
      case 'attendance': return <AttendanceOverview participants={participants} attendance={attendance} />
      case 'participants': return <Participants participants={participants} setParticipants={setParticipants} onView={(id) => navigate('participant', id)} />
      case 'parents': return <Parents participants={participants} />
      case 'participant': return (
        <ParticipantDetail
          participant={participants.find(p => p.id === selectedParticipantId)}
          participants={participants}
          setParticipants={setParticipants}
          attendance={attendance}
          incidents={incidents}
          setIncidents={setIncidents}
          staffList={staffList}
          onBack={() => navigate('participants')}
        />
      )
      case 'medical': return <Medical participants={participants} onView={(id) => navigate('participant', id)} />
      case 'incidents': return <Incidents incidents={incidents} setIncidents={setIncidents} participants={participants} staffList={staffList} onView={(id) => navigate('participant', id)} />
      case 'staff': return <Staff staffList={staffList} setStaffList={setStaffList} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      <Nav page={page} onNavigate={navigate} onLogout={() => {
        sessionStorage.removeItem('camp_authed')
        setAuthed(false)
      }} />
      <main className="max-w-5xl mx-auto px-4 py-6">{renderPage()}</main>
    </div>
  )
}