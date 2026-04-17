import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ClipboardList, RefreshCw } from 'lucide-react'
import { supabase } from '../supabase'

const CATEGORY_STYLES = {
  send: 'bg-purple-100 text-purple-800 border-purple-200',
  allergy: 'bg-red-100 text-red-700 border-red-200',
  medical: 'bg-blue-100 text-blue-700 border-blue-200',
  dietary: 'bg-green-100 text-green-800 border-green-200',
  notes: 'bg-stone-100 text-stone-700 border-stone-200',
}

const CATEGORY_LABELS = {
  send: 'SEND',
  allergy: 'Allergy',
  medical: 'Medical',
  dietary: 'Dietary',
  notes: 'Additional Notes',
}

export default function SharedInfo({ currentUser, participants }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const participantMap = useMemo(() => {
    const map = new Map()
    for (const participant of participants || []) {
      map.set(participant.id, participant)
    }
    return map
  }, [participants])

  async function loadSharedItems() {
    if (!currentUser?.id) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error: loadError } = await supabase
        .from('participant_staff_shares')
        .select('id, participant_id, category, summary, created_at, updated_at')
        .eq('target_user_id', currentUser.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })

      if (loadError) throw loadError

      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Unable to load shared info')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSharedItems()
  }, [currentUser?.id])

  return (
    <div className="fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950 flex items-center gap-2">
            <ClipboardList size={22} /> Shared Info
          </h2>
          <p className="text-sm text-stone-500">Only admin-shared support and safety information for your role.</p>
        </div>
        <button className="btn-secondary text-sm flex items-center gap-2" onClick={loadSharedItems} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="card text-center py-10">
          <p className="text-stone-500">Loading shared info...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-stone-500">No shared items yet.</p>
          <p className="text-xs text-stone-400 mt-1">Admins can share SEND, allergy, medical, and dietary notes from participant profiles.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const participant = participantMap.get(item.participant_id)
            const categoryKey = String(item.category || '').toLowerCase()
            const categoryLabel = CATEGORY_LABELS[categoryKey] || 'Shared'
            const badgeClass = CATEGORY_STYLES[categoryKey] || 'bg-stone-100 text-stone-700 border-stone-200'

            return (
              <div key={item.id} className="card">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-display font-semibold text-forest-950">{participant?.name || 'Participant not found'}</p>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
                    {categoryLabel}
                  </span>
                </div>
                <p className="text-sm text-stone-700 whitespace-pre-wrap">{item.summary}</p>
                <p className="text-[11px] text-stone-400 mt-2">
                  Updated {new Date(item.updated_at || item.created_at).toLocaleString('en-GB')}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
