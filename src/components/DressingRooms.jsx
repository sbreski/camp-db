import { useState } from 'react'
import { X, Plus } from 'lucide-react'

export default function DressingRooms({ participants }) {
  const [rooms, setRooms] = useState(() => {
    const initialRooms = []
    for (let i = 1; i <= 5; i++) {
      initialRooms.push({ id: `room-${i}`, name: `Room ${i}`, participants: [] })
    }
    return initialRooms
  })
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [searchParticipant, setSearchParticipant] = useState('')

  function addParticipantToRoom(roomId, participant) {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        if (!r.participants.find(p => p.id === participant.id)) {
          return { ...r, participants: [...r.participants, participant] }
        }
      }
      return r
    }))
    setSearchParticipant('')
  }

  function removeParticipantFromRoom(roomId, participantId) {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        return { ...r, participants: r.participants.filter(p => p.id !== participantId) }
      }
      return r
    }))
  }

  function updateRoomName(roomId, newName) {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, name: newName } : r))
  }

  function getParticipantsNotInRoom(roomId) {
    const inRoom = rooms.find(r => r.id === roomId)?.participants || []
    const inRoomIds = new Set(inRoom.map(p => p.id))
    return participants.filter(p => !inRoomIds.has(p.id))
  }

  const currentRoom = rooms.find(r => r.id === selectedRoom)

  return (
    <div className="fade-in space-y-4">
      <div>
        <h2 className="text-2xl font-display font-bold text-forest-950">Dressing Rooms</h2>
        <p className="text-stone-500 text-sm mt-1">Organize participants into dressing rooms</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              selectedRoom === room.id
                ? 'border-forest-600 bg-forest-50'
                : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <h3 className="font-display font-semibold text-forest-950 text-sm">{room.name}</h3>
            <p className="text-xs text-stone-500 mt-1">{room.participants.length} participant{room.participants.length !== 1 ? 's' : ''}</p>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {room.participants.map(p => (
                <div key={p.id} className="text-xs bg-forest-100 text-forest-900 rounded px-2 py-1 truncate">
                  {p.name}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      {currentRoom && (
        <div className="card border-2 border-forest-200 fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <label className="label text-xs mb-1">Room Name</label>
              <input
                className="input font-display font-semibold text-lg"
                value={currentRoom.name}
                onChange={e => updateRoomName(currentRoom.id, e.target.value)}
              />
            </div>
            <button onClick={() => setSelectedRoom(null)} className="p-1 text-stone-400 hover:text-stone-600 ml-2">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Add Participant</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Search participants..."
                  value={searchParticipant}
                  onChange={e => setSearchParticipant(e.target.value)}
                />
              </div>
              {searchParticipant && (
                <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
                  {getParticipantsNotInRoom(currentRoom.id)
                    .filter(p => p.name.toLowerCase().includes(searchParticipant.toLowerCase()))
                    .map(p => (
                      <button
                        key={p.id}
                        onClick={() => addParticipantToRoom(currentRoom.id, p)}
                        className="w-full text-left px-4 py-2 hover:bg-amber-50 border-b border-stone-100 last:border-b-0 transition-all flex items-center gap-2"
                      >
                        <Plus size={14} className="text-amber-500" />
                        <span className="text-sm font-medium text-stone-700">{p.name}</span>
                        {p.pronouns && <span className="text-xs text-stone-500">({p.pronouns})</span>}
                      </button>
                    ))}
                  {getParticipantsNotInRoom(currentRoom.id).filter(p => p.name.toLowerCase().includes(searchParticipant.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-sm text-stone-500 text-center">No available participants</div>
                  )}
                </div>
              )}
            </div>

            <div>
              <h4 className="label mb-3">Participants in {currentRoom.name}</h4>
              {currentRoom.participants.length === 0 ? (
                <p className="text-sm text-stone-500 text-center py-4">No participants assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {currentRoom.participants.map(p => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-all"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-stone-900">{p.name}</p>
                        {p.pronouns && <p className="text-xs text-stone-500">{p.pronouns}</p>}
                      </div>
                      <button
                        onClick={() => removeParticipantFromRoom(currentRoom.id, p.id)}
                        className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-all flex-shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
