import { useEffect, useRef, useState } from 'react'
import { LogIn, LogOut, Clock, CheckCircle, Search, RotateCcw, User, X, Calendar, CameraOff, Camera, FileText, Edit2, Trash2, Check } from 'lucide-react'
import ParticipantNameText, { participantDisplayName } from './ParticipantNameText'
import SafeguardingFlagIcon from './SafeguardingFlagIcon'
import ViewportOverlay from './ViewportOverlay'
import { getPendingFollowUpsForParticipant } from '../utils/workflow'
import { buildDailyFamilyPickupCode, getParticipantFamilyKey, getParticipantPickupCode, isValidParticipantPickupCode, normalizePickupCodeInput } from '../utils/pickupCode'
import { daysUntilBirthday, todayKey } from '../utils/birthday'
import { hasRecordedEpiPen } from '../utils/medical'
import { supabase } from '../supabase'

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatMultilineHistoryText(value) {
  return String(value || '').replace(/\r\n/g, '\n')
}

function formatRegisterInlineText(value) {
  return formatMultilineHistoryText(value).replace(/\n+/g, ' | ').trim()
}

function parseApprovedAdults(str) {
  if (!str) return []
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

function approvedAdultBaseName(entry) {
  const text = String(entry || '').trim()
  if (!text) return ''
  const phoneStripped = text.replace(/\s*-\s*\+?[0-9][0-9\s()\-]{5,}\s*$/i, '').trim()
  const relationshipMatch = phoneStripped.match(/^(.*?)\s*\((.*?)\)\s*$/)
  return String((relationshipMatch ? relationshipMatch[1] : phoneStripped) || '').trim().toLowerCase()
}

function formatParentLabel(parentName) {
  return `${parentName} (Parent)`
}

function hasSameAdult(adults, parentName) {
  const parentKey = approvedAdultBaseName(formatParentLabel(parentName))
  if (!parentKey) return false
  return adults.some(a => approvedAdultBaseName(a) === parentKey)
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canLeaveAlone(participant) {
  return Boolean(participant?.canLeaveAlone ?? participant?.can_leave_alone) && Number(participant?.age) >= 11
}

function getSiblingLeaveOptions(participant, participants) {
  const parentNameKey = normalizeText(participant?.parentName)
  const parentEmailKey = normalizeText(participant?.parentEmail)
  const parentPhoneKey = normalizePhone(participant?.parentPhone)

  return (participants || [])
    .filter(candidate => {
      if (!candidate || candidate.id === participant?.id) return false
      if (!canLeaveAlone(candidate)) return false
      const sameName = parentNameKey && normalizeText(candidate.parentName) === parentNameKey
      const sameEmail = parentEmailKey && normalizeText(candidate.parentEmail) === parentEmailKey
      const samePhone = parentPhoneKey && normalizePhone(candidate.parentPhone) === parentPhoneKey
      return sameName || sameEmail || samePhone
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(candidate => ({
      id: candidate.id,
      label: `Leave with sibling, ${candidate.name}`,
    }))
}

function isSameFamily(participant, candidate) {
  return getParticipantFamilyKey(participant) === getParticipantFamilyKey(candidate)
}

function getFamilyParticipants(participant, participants) {
  return (participants || []).filter(candidate => candidate?.id && isSameFamily(participant, candidate))
}

function collectorDisplayLabel(collectedBy) {
  if (!collectedBy) return null

  const masterCodeMatch = collectedBy.match(/^Master code used by\s+(.+?)\s*\|\s*(.+)$/i)
  if (masterCodeMatch) {
    const actor = masterCodeMatch[1].trim()
    const inner = masterCodeMatch[2].trim()
    const innerDisplay = collectorDisplayLabel(inner)
    const innerLabel = innerDisplay?.label || inner
    return { label: `Master code used by ${actor}. Collected by ${innerLabel}`, withPrefix: false }
  }

  if (/^left by themselves$/i.test(collectedBy)) {
    return { label: 'Left by themselves', withPrefix: false }
  }

  const siblingMatch = collectedBy.match(/^leave with sibling,\s*(.+)$/i)
  if (siblingMatch) {
    return { label: `Left with sibling, ${siblingMatch[1].trim()}`, withPrefix: false }
  }

  const otherMatch = collectedBy.match(/^Other \(not approved\):\s*(.+?)\s*-\s*Reason:\s*(.+)$/i)
  if (otherMatch) {
    return { label: `Other: ${otherMatch[1].trim()}`, withPrefix: true }
  }

  return { label: collectedBy, withPrefix: true }
}

function isLikelyFullName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2 && parts.every(part => part.length >= 2)
}

const ATTENDANCE_REASON_OPTIONS = [
  { value: 'illness', label: 'Illness' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'no_show', label: 'No-show' },
  { value: 'late_arrival', label: 'Late arrival' },
  { value: 'early_leave', label: 'Early leave' },
  { value: 'other', label: 'Other' },
]
const PICKUP_MASTER_BYPASS_CODE = '137'
const PICKUP_PREVERIFY_WINDOW_MINUTES = 15

function getPickupCodeVerificationEntry(participant, dateKey) {
  const raw = participant?.pickupCodeVerifications ?? participant?.pickup_code_verifications
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const entry = raw?.[dateKey]
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  return entry
}

function pickupCodePreverifyStatus(participant, dateKey, nowTs = Date.now()) {
  const entry = getPickupCodeVerificationEntry(participant, dateKey)
  if (!entry?.verifiedAt) return { valid: false, entry: null, minutesRemaining: 0 }

  const verifiedAtTs = Date.parse(entry.verifiedAt)
  if (Number.isNaN(verifiedAtTs)) return { valid: false, entry: null, minutesRemaining: 0 }

  const expiresAtTs = verifiedAtTs + (PICKUP_PREVERIFY_WINDOW_MINUTES * 60 * 1000)
  const remainingMs = expiresAtTs - nowTs
  if (remainingMs <= 0) return { valid: false, entry, minutesRemaining: 0 }

  return {
    valid: true,
    entry,
    minutesRemaining: Math.ceil(remainingMs / 60000),
  }
}

function formatPreverifyTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function CodeVerifyModal({ participant, selectedDate, actorInitials = 'ST', onVerify, onCancel }) {
  const [codeInput, setCodeInput] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  function submitVerify() {
    if (!isValidParticipantPickupCode(codeInput, participant, selectedDate) && normalizePickupCodeInput(codeInput) !== PICKUP_MASTER_BYPASS_CODE) {
      setError('Code is not valid for this family.')
      return
    }
    onVerify({
      verifiedAt: new Date().toISOString(),
      verifiedBy: actorInitials,
      method: normalizePickupCodeInput(codeInput) === PICKUP_MASTER_BYPASS_CODE ? 'master' : 'family',
    })
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        submitVerify()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <ViewportOverlay className="bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-in">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <h3 className="font-display font-bold text-forest-950">Pre-verify Pickup Code</h3>
            <ParticipantNameText participant={participant} className="text-sm text-stone-500 mt-0.5" showDiagnosedHighlight={false} />
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-stone-600">Valid for {PICKUP_PREVERIFY_WINDOW_MINUTES} minutes for this family.</p>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            className="input"
            value={codeInput}
            onChange={e => {
              setCodeInput(normalizePickupCodeInput(e.target.value))
              if (error) setError('')
            }}
            placeholder="Enter 3-digit code"
          />
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={submitVerify} className="btn-primary flex-1">Verify</button>
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </ViewportOverlay>
  )
}

function attendanceReasonLabel(value) {
  return ATTENDANCE_REASON_OPTIONS.find(option => option.value === value)?.label || null
}

function photoConsentMode(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'no') return 'no'
  if (normalized === 'internal') return 'internal'
  return 'ok'
}

function CollectionModal({ participant, participants, selectedDate, signedInSiblingOptions = [], preverifiedStatus = null, enableKeyboardShortcuts = true, actorInitials = 'ST', onConfirm, onCancel }) {
  const adults = parseApprovedAdults(participant.approvedAdults)
  const [selected, setSelected] = useState(null)
  const [otherFullName, setOtherFullName] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [pickupCodeInput, setPickupCodeInput] = useState('')
  const [pickupCodeConfirmed, setPickupCodeConfirmed] = useState(false)
  const [pickupCodeFieldArmed, setPickupCodeFieldArmed] = useState(false)
  const [signOutSiblingsTogether, setSignOutSiblingsTogether] = useState(signedInSiblingOptions.length > 0)
  const [validationError, setValidationError] = useState('')
  const pickupCodeInputRef = useRef(null)
  const siblingLeaveOptions = getSiblingLeaveOptions(participant, participants)
  const numberedCollectors = [...adults]

  const can_leave_alone = canLeaveAlone(participant)
  const hasSelectableOptions = can_leave_alone || siblingLeaveOptions.length > 0 || adults.length > 0
  const hasValidPickupCode = isValidParticipantPickupCode(pickupCodeInput, participant, selectedDate)
  const hasMasterBypassCode = normalizePickupCodeInput(pickupCodeInput) === PICKUP_MASTER_BYPASS_CODE
  const hasActivePreverify = Boolean(preverifiedStatus?.valid)
  const isAdultStepUnlocked = hasActivePreverify || (pickupCodeConfirmed && (hasValidPickupCode || hasMasterBypassCode))

  useEffect(() => {
    setSignOutSiblingsTogether(signedInSiblingOptions.length > 0)
  }, [participant?.id, signedInSiblingOptions.length])

  function isCodeExemptCollector(value) {
    if (value === 'LeaveAlone') return true
    if (typeof value !== 'string') return false
    return /^leave with sibling,/i.test(value)
  }

  function canSelectCollector(value) {
    return isCodeExemptCollector(value) || isAdultStepUnlocked
  }

  function withBypassAudit(baseValue, selectedValue) {
    if (hasActivePreverify && !isCodeExemptCollector(selectedValue)) {
      const by = preverifiedStatus?.entry?.verifiedBy || 'ST'
      const at = formatPreverifyTime(preverifiedStatus?.entry?.verifiedAt)
      return `Code pre-verified by ${by} at ${at} | ${baseValue}`
    }
    if (!hasMasterBypassCode || isCodeExemptCollector(selectedValue)) return baseValue
    return `Master code used by ${actorInitials} | ${baseValue}`
  }

  useEffect(() => {
    if (!enableKeyboardShortcuts) return

    function isTypingField(target) {
      if (!target) return false
      const tag = String(target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
      return Boolean(target.isContentEditable)
    }

    function allowsShortcutWhileTyping(target) {
      return Boolean(target?.dataset?.allowCollectorHotkeys === 'true')
    }

    function handleKeyDown(event) {
      const typing = isTypingField(event.target)
      if (typing && !allowsShortcutWhileTyping(event.target)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (/^[1-9]$/.test(event.key)) {
        const optionIndex = Number(event.key) - 1
        const option = numberedCollectors[optionIndex]
        if (option && canSelectCollector(option)) {
          event.preventDefault()
          selectCollector(option)
        }
        return
      }

      if (event.shiftKey && /^Digit[1-9]$/.test(event.code)) {
        const siblingIndex = Number(event.code.replace('Digit', '')) - 1
        const siblingOption = siblingLeaveOptions[siblingIndex]
        if (siblingOption && canSelectCollector(siblingOption.label)) {
          event.preventDefault()
          selectCollector(siblingOption.label)
        }
        return
      }

      if (/^s$/i.test(event.key) && signedInSiblingOptions.length > 0) {
        event.preventDefault()
        setSignOutSiblingsTogether(prev => !prev)
        return
      }

      if (/^o$/i.test(event.key)) {
        if (canSelectCollector('Other / not on approved list')) {
          event.preventDefault()
          selectCollector('Other / not on approved list')
        }
        return
      }

      if (event.key === '0' && can_leave_alone) {
        event.preventDefault()
        selectCollector('LeaveAlone')
        return
      }

      if (event.key === 'Enter') {
        if (typing && allowsShortcutWhileTyping(event.target)) {
          event.preventDefault()

          if (selected && canSelectCollector(selected)) {
            handleConfirm()
            return
          }

          if (hasValidPickupCode || hasMasterBypassCode || hasActivePreverify) {
            setPickupCodeConfirmed(true)
            setValidationError('')
          } else {
            setPickupCodeConfirmed(false)
            setValidationError('Enter a valid family pickup code (or master code), then press Enter.')
          }
          return
        }

        if (hasSelectableOptions && !selected) return
        if (selected && !canSelectCollector(selected)) return
        event.preventDefault()
        handleConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [numberedCollectors, siblingLeaveOptions, signedInSiblingOptions.length, can_leave_alone, hasSelectableOptions, selected, onCancel, hasValidPickupCode, hasMasterBypassCode, hasActivePreverify, isAdultStepUnlocked, enableKeyboardShortcuts])

  useEffect(() => {
    setPickupCodeFieldArmed(true)
    const frame = requestAnimationFrame(() => {
      pickupCodeInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  function handleConfirm() {
    function buildSiblingIdsForSubmission(selectedValue) {
      const idsFromCheckbox = signOutSiblingsTogether ? signedInSiblingOptions.map(item => item.id) : []
      if (typeof selectedValue !== 'string') return idsFromCheckbox

      const selectedSibling = siblingLeaveOptions.find(option => option.label === selectedValue)
      if (!selectedSibling) return idsFromCheckbox

      return [...new Set([...idsFromCheckbox, selectedSibling.id])]
    }

    if (!selected) {
      setValidationError('Choose who is collecting to complete sign out.')
      return
    }

    if (can_leave_alone && selected === 'LeaveAlone') {
      onConfirm({
        collectedBy: withBypassAudit('Left by themselves', selected),
        siblingIds: buildSiblingIdsForSubmission(selected),
      })
      return
    }

    if (!canSelectCollector(selected)) {
      setValidationError('Enter the pickup code first, then choose the sign-out adult.')
      return
    }

    if (selected !== 'Other / not on approved list') {
      onConfirm({
        collectedBy: withBypassAudit(selected || 'Not recorded', selected),
        siblingIds: buildSiblingIdsForSubmission(selected),
      })
      return
    }

    const fullName = otherFullName.trim()
    const reason = otherReason.trim()

    if (!isLikelyFullName(fullName)) {
      setValidationError('Please enter the collector\'s full name (first and last name).')
      return
    }
    if (!reason) {
      setValidationError('Please enter a reason for using someone not on the approved list.')
      return
    }

    onConfirm({
      collectedBy: withBypassAudit(`Other (not approved): ${fullName} - Reason: ${reason}`, selected),
      siblingIds: buildSiblingIdsForSubmission(selected),
    })
  }

  function selectCollector(value) {
    setSelected(value)
    setValidationError('')
  }

  return (
    <ViewportOverlay className="bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-in">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <h3 className="font-display font-bold text-forest-950">Sign Out</h3>
            <ParticipantNameText participant={participant} className="text-sm text-stone-500 mt-0.5" showDiagnosedHighlight={false} />
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          {!isAdultStepUnlocked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-900">Step 1: Enter Pickup Security Code</p>
              <p className="text-xs text-amber-800">Ask the parent/carer for this family's 3-digit code before sign out.</p>
              {hasActivePreverify && (
                <p className="text-xs text-emerald-700 font-medium">
                  Code pre-verified by {preverifiedStatus?.entry?.verifiedBy || 'ST'} at {formatPreverifyTime(preverifiedStatus?.entry?.verifiedAt)}
                  {' '}({preverifiedStatus?.minutesRemaining} min left)
                </p>
              )}
              <div className="sr-only" aria-hidden="true">
                <input type="text" name="cc-name" autoComplete="cc-name" tabIndex={-1} />
                <input type="text" name="cc-number" autoComplete="cc-number" inputMode="numeric" tabIndex={-1} />
              </div>
              <input
                ref={pickupCodeInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                autoComplete="new-password"
                name={`camp-pickup-security-${participant?.id || 'unknown'}-${selectedDate}`}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                data-allow-collector-hotkeys="true"
                readOnly={!pickupCodeFieldArmed}
                onFocus={() => setPickupCodeFieldArmed(true)}
                onMouseDown={() => setPickupCodeFieldArmed(true)}
                className="input"
                value={pickupCodeInput}
                onChange={e => {
                  setPickupCodeInput(normalizePickupCodeInput(e.target.value))
                  setPickupCodeConfirmed(false)
                  if (validationError) setValidationError('')
                }}
                placeholder="Enter 3-digit code"
              />
              <p className="text-[11px] text-stone-500">Press Enter to unlock adult collection options.</p>
            </div>
          )}
          {!isAdultStepUnlocked && (adults.length > 0) && (
            <p className="text-xs text-stone-500">Step 2 unlocks once a valid code is entered.</p>
          )}
          {(can_leave_alone || siblingLeaveOptions.length > 0) && (
            <>
              <p className="text-sm font-medium text-stone-700">No-code independent leave options</p>
              <div className="space-y-2">
                {siblingLeaveOptions.map((option) => (
                  <button key={option.id} onClick={() => selectCollector(option.label)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      selected === option.label ? 'border-indigo-600 bg-indigo-50' : 'border-stone-200 hover:border-stone-300'
                    }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold font-display flex-shrink-0 ${
                      selected === option.label ? 'bg-indigo-900 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>{enableKeyboardShortcuts ? `S${siblingLeaveOptions.findIndex(item => item.id === option.id) + 1}` : '↗'}</div>
                    <span className="text-sm font-medium text-stone-800">{option.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {can_leave_alone && (
            <button
              onClick={() => selectCollector('LeaveAlone')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                selected === 'LeaveAlone' ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200 hover:border-stone-300'
              }`}
              title="This participant is permitted to leave the premises on their own (parental permission, age 11+)."
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display flex-shrink-0 ${
                selected === 'LeaveAlone' ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-stone-600'
              }`}>✓</div>
              <span className="text-sm font-medium text-emerald-800">
                Leave Site Unaccompanied
                <span className="block text-xs text-stone-500 font-normal">(parental permission, age 11+)</span>
              </span>
            </button>
          )}
          {signedInSiblingOptions.length > 0 && (
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
              <input
                type="checkbox"
                checked={signOutSiblingsTogether}
                onChange={e => setSignOutSiblingsTogether(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-forest-900 cursor-pointer"
              />
              <div>
                <span className="text-sm font-medium text-stone-800">Auto sign out siblings together</span>
                <p className="text-xs text-stone-500 mt-0.5">
                  {signOutSiblingsTogether
                    ? `Also signing out: ${signedInSiblingOptions.map(item => item.name).join(', ')}`
                    : 'Only this child will be signed out.'}
                </p>
                {enableKeyboardShortcuts && (
                  <p className="text-[11px] text-stone-500 mt-1">Press <span className="font-mono">S</span> to toggle this quickly.</p>
                )}
              </div>
            </label>
          )}
          {isAdultStepUnlocked && adults.length > 0 ? (
            <>
              <p className="text-sm font-medium text-stone-700">Step 2: Who is collecting?</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {adults.map((adult, i) => (
                  <button key={i} onClick={() => selectCollector(adult)} disabled={!canSelectCollector(adult)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      selected === adult ? 'border-forest-600 bg-forest-50' : 'border-stone-200 hover:border-stone-300'
                    } ${!canSelectCollector(adult) ? 'opacity-45 cursor-not-allowed hover:border-stone-200' : ''}`}
                    title={!canSelectCollector(adult) ? 'Enter valid pickup code first' : undefined}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display flex-shrink-0 ${
                      selected === adult ? 'bg-forest-900 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>{i + 1}</div>
                    <span className="text-sm font-medium text-stone-800">{adult}</span>
                  </button>
                ))}
                <button onClick={() => selectCollector('Other / not on approved list')} disabled={!canSelectCollector('Other / not on approved list')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    selected === 'Other / not on approved list' ? 'border-amber-500 bg-amber-50' : 'border-dashed border-stone-200 hover:border-stone-300'
                  } ${!canSelectCollector('Other / not on approved list') ? 'opacity-45 cursor-not-allowed hover:border-stone-200' : ''}`}
                  title={!canSelectCollector('Other / not on approved list') ? 'Enter valid pickup code first' : undefined}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selected === 'Other / not on approved list' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-400'
                  }`}><User size={13} /></div>
                  <span className="text-sm text-stone-500 italic">Other / not on approved list</span>
                </button>
                {selected === 'Other / not on approved list' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                    <div>
                      <label className="label">Collector full name</label>
                      <input
                        type="text"
                        className="input"
                        value={otherFullName}
                        onChange={e => {
                          setOtherFullName(e.target.value)
                          if (validationError) setValidationError('')
                        }}
                        placeholder="First and last name"
                      />
                    </div>
                    <div>
                      <label className="label">Reason for change</label>
                      <textarea
                        className="input min-h-[84px]"
                        value={otherReason}
                        onChange={e => {
                          setOtherReason(e.target.value)
                          if (validationError) setValidationError('')
                        }}
                        placeholder="Why is this person collecting instead of an approved adult?"
                      />
                    </div>
                    {validationError && (
                      <p className="text-xs font-medium text-red-600">{validationError}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (isAdultStepUnlocked && !can_leave_alone && siblingLeaveOptions.length === 0) ? (
            <div className="text-center py-2">
              <p className="text-sm text-stone-500">No approved adults recorded for this participant.</p>
              <p className="text-xs text-stone-400 mt-1">Add them via the Participants page.</p>
            </div>
          ) : null}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={handleConfirm}
            disabled={(hasSelectableOptions && !selected) || (selected && !canSelectCollector(selected))}
            className={`flex-1 btn-primary py-3 ${(hasSelectableOptions && !selected) || (selected && !canSelectCollector(selected)) ? 'opacity-40 cursor-not-allowed' : ''}`}>
            Confirm Sign Out
          </button>
          <button onClick={onCancel} className="btn-secondary px-4">Cancel</button>
        </div>
      </div>
    </ViewportOverlay>
  )
}

function FamilySignInModal({ participant, familyTargets = [], selectedIds = [], enableKeyboardShortcuts = true, onToggleParticipant, onConfirm, onCancel, error = '' }) {
  useEffect(() => {
    if (!enableKeyboardShortcuts) return

    function isTypingField(target) {
      if (!target) return false
      const tag = String(target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
      return Boolean(target.isContentEditable)
    }

    function handleKeyDown(event) {
      if (isTypingField(event.target)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        onConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableKeyboardShortcuts, onCancel, onConfirm])

  const selectedCount = familyTargets.filter(item => selectedIds.includes(item.id)).length

  return (
    <ViewportOverlay className="bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <h3 className="font-display font-bold text-forest-950">Sign In Family</h3>
            <ParticipantNameText participant={participant} className="text-sm text-stone-500 mt-0.5" showDiagnosedHighlight={false} />
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-stone-700">Select which siblings to sign in together.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {familyTargets.map((item) => {
              const isSelected = selectedIds.includes(item.id)
              return (
                <label key={item.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer ${isSelected ? 'border-forest-300 bg-forest-50' : 'border-stone-200 bg-white'}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleParticipant(item.id)}
                    className="h-4 w-4 rounded border-stone-300 text-forest-900 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <ParticipantNameText participant={item} className="text-sm font-semibold text-forest-950" showDiagnosedHighlight={false} />
                    <p className="text-xs text-stone-500">{item.id === participant?.id ? 'Selected child' : 'Sibling'}</p>
                  </div>
                </label>
              )
            })}
          </div>
          <p className="text-xs text-stone-500">{selectedCount} selected.</p>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onConfirm} className="btn-primary flex-1">Confirm Sign In</button>
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </ViewportOverlay>
  )
}

export default function SignInOut({ participants, setParticipants, attendance, setAttendance, actorInitials = 'ST', incidents, setIncidents, medicationAdministration = [], setMedicationAdministration, canViewAdminFollowUps = false, canViewSafeguarding = false, currentUserId = '', onView = null }) {
  const searchInputRef = useRef(null)
  const dateInputRef = useRef(null)
  const noteInputRef = useRef(null)
  const reasonNotesRef = useRef(null)
  const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | in | not-in | follow-up
  const [flash, setFlash] = useState(null)
  const [activeParticipantId, setActiveParticipantId] = useState(null)
  const [signingInFor, setSigningInFor] = useState(null)
  const [familySignInSelection, setFamilySignInSelection] = useState([])
  const [familySignInError, setFamilySignInError] = useState('')
  const [collectingFor, setCollectingFor] = useState(null)
  const [verifyingFor, setVerifyingFor] = useState(null)
  const [noteEditor, setNoteEditor] = useState(null)
  const [noteInput, setNoteInput] = useState('')
  const [keepOnRecord, setKeepOnRecord] = useState(false)
  const [editingHistoryEntry, setEditingHistoryEntry] = useState(null)
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [editingTime, setEditingTime] = useState(null) // { participantId, type: 'signIn' | 'signOut', currentTime }
  const [timeInput, setTimeInput] = useState('')
  const [reasonEditor, setReasonEditor] = useState(null)
  const [reasonInput, setReasonInput] = useState('')
  const [reasonNotesInput, setReasonNotesInput] = useState('')
  const [editingCodeParticipant, setEditingCodeParticipant] = useState(null)
  const [codeEditInput, setCodeEditInput] = useState('')
  const [codeEditFieldArmed, setCodeEditFieldArmed] = useState(false)
  const [codeEditMessage, setCodeEditMessage] = useState('')
  const [showKeyboardKey, setShowKeyboardKey] = useState(false)
  const [sharedBadgeDetails, setSharedBadgeDetails] = useState({})
  const today = todayKey()
  const seasonParticipants = participants.filter(p => {
    const seasonFlag = p.isActiveThisSeason ?? p.is_active_this_season
    if (typeof seasonFlag === 'string') return seasonFlag.toLowerCase() !== 'false'
    return seasonFlag !== false
  })
  const selectedRecords = attendance.filter(a => a.date === selectedDate)
  const liveNoteEditorParticipant = noteEditor
    ? participants.find(item => item.id === noteEditor.id) || noteEditor
    : null

  useEffect(() => {
    let cancelled = false

    async function loadSharedBadgeDetails() {
      if (canViewSafeguarding || !currentUserId) {
        if (!cancelled) setSharedBadgeDetails({})
        return
      }

      try {
        const { data, error } = await supabase
          .from('participant_staff_shares')
          .select('participant_id, category, summary, created_at, updated_at')
          .eq('target_user_id', currentUserId)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .order('created_at', { ascending: false })

        if (error) throw error

        const next = {}
        for (const row of Array.isArray(data) ? data : []) {
          const participantId = row?.participant_id
          const category = String(row?.category || '').trim().toLowerCase()
          const summary = String(row?.summary || '').trim()
          if (!participantId || !category) continue

          if (!next[participantId]) next[participantId] = {}
          if (!next[participantId][category]) next[participantId][category] = []

          if (summary && !next[participantId][category].includes(summary)) {
            next[participantId][category].push(summary)
          }
        }

        if (!cancelled) setSharedBadgeDetails(next)
      } catch (_) {
        if (!cancelled) setSharedBadgeDetails({})
      }
    }

    loadSharedBadgeDetails()
    return () => {
      cancelled = true
    }
  }, [canViewSafeguarding, currentUserId])

  function sharedTooltipFor(participantId, categories, fallback) {
    if (canViewSafeguarding) return fallback

    const participantDetails = sharedBadgeDetails[participantId] || {}
    const categoryList = Array.isArray(categories) ? categories : [categories]
    const summaries = []
    let hasSharedCategory = false

    for (const category of categoryList) {
      const entries = participantDetails[String(category || '').toLowerCase()]
      if (!entries) continue
      hasSharedCategory = true
      for (const summary of entries) {
        if (summary && !summaries.includes(summary)) summaries.push(summary)
      }
    }

    if (summaries.length > 0) return summaries.join(' | ')
    if (hasSharedCategory) return 'Shared information available (no summary provided).'
    return 'Not shared with your account.'
  }

  function getPendingFollowUps(participantId) {
    return getPendingFollowUpsForParticipant(incidents, participantId, selectedDate)
  }

  function completeFollowUp(incidentId) {
    setIncidents(prev => prev.map(incident => (
      incident.id === incidentId
        ? {
            ...incident,
            followUpCompletedAt: new Date().toISOString(),
            followUpCompletedBy: 'Register follow-up',
          }
        : incident
    )))
  }

  function getPendingMarFollowUps(participantId) {
    return medicationAdministration.filter(row =>
      row.participant_id === participantId &&
      row.follow_up_required &&
      !row.follow_up_completed_at
    )
  }

  async function completeMarFollowUp(marId) {
    const completedAt = new Date().toISOString()
    // Optimistic update locally
    if (typeof setMedicationAdministration === 'function') {
      setMedicationAdministration(prev => prev.map(row =>
        row.id === marId
          ? { ...row, follow_up_completed_at: completedAt, follow_up_completed_by: actorInitials }
          : row
      ))
    }
    // Also persist to Supabase if available
    try {
      const { supabase } = await import('../supabase')
      await supabase
        .from('medication_administration')
        .update({ follow_up_completed_at: completedAt, follow_up_completed_by: actorInitials })
        .eq('id', marId)
    } catch (_) {
      // Supabase update is best-effort; local state already updated
    }
  }

  function getRecord(participantId) {
    return selectedRecords.find(r => r.participantId === participantId) || null
  }

  function signInParticipants(participantIds, flashParticipantId = null) {
    const uniqueIds = [...new Set((participantIds || []).filter(Boolean))]
    if (!uniqueIds.length) return

    const now = new Date()
    // For non-today dates, use a predictable default sign-in time on that selected day.
    const signInTime = selectedDate === today ? now : new Date(`${selectedDate}T10:00:00`)

    setAttendance(prev => [
      ...prev.filter(r => !(r.date === selectedDate && uniqueIds.includes(r.participantId))),
      ...uniqueIds.map(participantId => ({
        participantId,
        date: selectedDate,
        signIn: signInTime.toISOString(),
        signOut: null,
        signInBy: actorInitials,
        signOutBy: null,
        collectedBy: null,
        id: `${participantId}-${selectedDate}`,
      })),
    ])
    setFlash({ id: flashParticipantId || uniqueIds[0], type: 'in' })
    setTimeout(() => setFlash(null), 2000)
  }

  function getFamilySignInTargets(participant) {
    return getFamilyParticipants(participant, seasonParticipants)
      .filter(candidate => {
        const record = getRecord(candidate.id)
        return !record?.signIn
      })
      .sort((a, b) => {
        if (a.id === participant.id) return -1
        if (b.id === participant.id) return 1
        return a.name.localeCompare(b.name)
      })
  }

  function openFamilySignIn(participant) {
    const targets = getFamilySignInTargets(participant)
    const defaultSelection = targets.map(item => item.id)
    if (defaultSelection.length <= 1) {
      signInParticipants([participant.id], participant.id)
      return
    }
    setSigningInFor(participant)
    setFamilySignInSelection(defaultSelection)
    setFamilySignInError('')
  }

  function toggleFamilySignInParticipant(participantId) {
    setFamilySignInSelection(prev => (
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    ))
    if (familySignInError) setFamilySignInError('')
  }

  function confirmFamilySignIn() {
    if (!signingInFor) return
    if (!familySignInSelection.length) {
      setFamilySignInError('Select at least one child to sign in.')
      return
    }

    signInParticipants(familySignInSelection, signingInFor.id)
    setSigningInFor(null)
    setFamilySignInSelection([])
    setFamilySignInError('')
  }

  function cancelFamilySignIn() {
    setSigningInFor(null)
    setFamilySignInSelection([])
    setFamilySignInError('')
  }

  function undoSignIn(participant) {
    if (!window.confirm(`Undo sign-in for ${participantDisplayName(participant)}?`)) return
    setAttendance(prev => prev.filter(r => !(r.date === selectedDate && r.participantId === participant.id)))
  }

  function undoSignOut(participant) {
    if (!window.confirm(`Undo sign-out for ${participantDisplayName(participant)}? They will show as still on site.`)) return
    const existing = getRecord(participant.id)
    setAttendance(prev => prev.map(r => r.id === existing.id ? { ...r, signOut: null, signOutBy: null, collectedBy: null } : r))
  }

  function getSignedInSiblingOptions(participant) {
    return getFamilyParticipants(participant, seasonParticipants)
      .filter(candidate => candidate.id !== participant.id)
      .filter(candidate => {
        const record = getRecord(candidate.id)
        return Boolean(record?.signIn && !record?.signOut)
      })
      .map(candidate => ({ id: candidate.id, name: candidate.name }))
  }

  function confirmSignOut(payload) {
    const participant = collectingFor
    setCollectingFor(null)
    const existing = getRecord(participant.id)
    if (!existing) return
    const collectedBy = typeof payload === 'string' ? payload : payload?.collectedBy
    const siblingIds = Array.isArray(payload?.siblingIds) ? payload.siblingIds : []
    
    const now = new Date()
    // For non-today dates, use a predictable default sign-out time on that selected day.
    const signOutTime = selectedDate === today ? now : new Date(`${selectedDate}T16:00:00`)
    const targetIds = [participant.id, ...siblingIds.filter(id => id !== participant.id)]
    
    setAttendance(prev => prev.map(r => (
      r.date === selectedDate && targetIds.includes(r.participantId) && r.signIn && !r.signOut
        ? { ...r, signOut: signOutTime.toISOString(), signOutBy: actorInitials, collectedBy }
        : r
    )))
    setFlash({ id: participant.id, type: 'out' })
    setTimeout(() => setFlash(null), 2000)
  }

  function openNoteEditor(participant) {
    const existing = getRecord(participant.id)
    const existingNote = existing?.exceptionNotes || existing?.exception_notes || ''
    setNoteEditor(participant)
    setNoteInput(existingNote)
    setKeepOnRecord(Boolean(participant.register_note) && participant.register_note === existingNote)
  }

  function cancelNoteEditor() {
    setNoteEditor(null)
    setNoteInput('')
    setKeepOnRecord(false)
    setEditingHistoryEntry(null)
  }

  function saveNoteEditor() {
    if (!noteEditor) return
    const existing = getRecord(noteEditor.id)
    const nextNote = noteInput.trim() || null

    // Save to today's attendance record as before
    if (existing) {
      setAttendance(prev => prev.map(r => (
        r.id === existing.id
          ? { ...r, exceptionNotes: nextNote }
          : r
      )))
    } else {
      setAttendance(prev => [
        ...prev,
        {
          id: `${noteEditor.id}-${selectedDate}`,
          participantId: noteEditor.id,
          date: selectedDate,
          signIn: null,
          signOut: null,
          signInBy: null,
          signOutBy: null,
          collectedBy: null,
          exceptionReason: null,
          exceptionNotes: nextNote,
        },
      ])
    }

    // Persist note history and optional register follow-up to participant
    if (nextNote && typeof setParticipants === 'function') {
      setParticipants(prev => prev.map(p => {
        if (p.id !== noteEditor.id) return p
        const existingHistory = Array.isArray(p.note_history) ? p.note_history : []
        const newEntry = {
          id: crypto.randomUUID(),
          note: nextNote,
          date: selectedDate,
          addedBy: actorInitials,
          savedAt: new Date().toISOString(),
        }
        return {
          ...p,
          note_history: [...existingHistory, newEntry],
          register_note: keepOnRecord ? nextNote : null,
        }
      }))
    } else if (!nextNote && typeof setParticipants === 'function') {
      setParticipants(prev => prev.map(p => {
        if (p.id !== noteEditor.id) return p
        return { ...p, register_note: null }
      }))
    }

    cancelNoteEditor()
  }

  function clearNoteEditor() {
    setNoteInput('')
    setKeepOnRecord(false)
  }

  function beginEditHistoryEntry(entry, historyIndex) {
    const participant = participants.find(item => item.id === noteEditor?.id)
    const activeFollowUp = String(participant?.register_note || participant?.registerNote || '').trim()
    setEditingHistoryEntry({
      historyIndex,
      originalNote: String(entry.note || ''),
      note: String(entry.note || ''),
      keepOnRecord: activeFollowUp === String(entry.note || '').trim(),
    })
  }

  function cancelEditHistoryEntry() {
    setEditingHistoryEntry(null)
  }

  function saveHistoryEntryEdit() {
    if (!noteEditor || !editingHistoryEntry || typeof setParticipants !== 'function') return
    const nextNote = String(editingHistoryEntry.note || '').trim()
    if (!nextNote) return
    const participantId = noteEditor.id

    setParticipants(prev => prev.map(p => {
      if (p.id !== participantId) return p
      const existingHistory = Array.isArray(p.note_history) ? p.note_history : []
      const previousEntry = existingHistory[editingHistoryEntry.historyIndex]
      const previousNote = String(previousEntry?.note || editingHistoryEntry.originalNote || '').trim()
      return {
        ...p,
        note_history: existingHistory.map((entry, index) => (
          index === editingHistoryEntry.historyIndex
            ? {
                ...entry,
                note: nextNote,
                updatedAt: new Date().toISOString(),
                updatedBy: actorInitials,
              }
            : entry
        )),
        register_note: editingHistoryEntry.keepOnRecord
          ? nextNote
          : String(p.register_note || '').trim() === previousNote
            ? null
            : p.register_note,
      }
    }))

    setAttendance(prev => prev.map(record => (
      record.participantId === participantId
      && record.date === liveNoteEditorParticipant?.note_history?.[editingHistoryEntry.historyIndex]?.date
      && String(record.exceptionNotes || record.exception_notes || '').trim() === String(editingHistoryEntry.originalNote || '').trim()
        ? { ...record, exceptionNotes: nextNote }
        : record
    )))

    setEditingHistoryEntry(null)
  }

  function deleteHistoryEntry(historyIndex) {
    if (!noteEditor || typeof setParticipants !== 'function') return
    if (!window.confirm('Delete this saved note from history?')) return
    const participantId = noteEditor.id
    const removedEntry = liveNoteEditorParticipant?.note_history?.[historyIndex]
    const removedNote = String(removedEntry?.note || '').trim()

    setParticipants(prev => prev.map(p => {
      if (p.id !== participantId) return p
      const existingHistory = Array.isArray(p.note_history) ? p.note_history : []
      return {
        ...p,
        note_history: existingHistory.filter((_, index) => index !== historyIndex),
        register_note: String(p.register_note || '').trim() === removedNote ? null : p.register_note,
      }
    }))

    setAttendance(prev => prev.map(record => (
      record.participantId === participantId
      && record.date === removedEntry?.date
      && String(record.exceptionNotes || record.exception_notes || '').trim() === removedNote
        ? { ...record, exceptionNotes: null }
        : record
    )))

    if (editingHistoryEntry?.historyIndex === historyIndex) {
      setEditingHistoryEntry(null)
    }
  }

  function clearRegisterFollowUp(participantId) {
    if (!window.confirm('Mark this note follow-up as done? It will remain in note history.')) return
    if (typeof setParticipants === 'function') {
      setParticipants(prev => prev.map(p =>
        p.id === participantId ? { ...p, register_note: null } : p
      ))
    }
  }

  function hasParticipantNoteFollowUp(participantId) {
    const participant = participants.find(item => item.id === participantId)
    return Boolean(String(participant?.register_note || participant?.registerNote || '').trim())
  }

  function clearParticipantNoteFollowUp(participantId) {
    clearRegisterFollowUp(participantId)
  }

  function startEditTime(participantId, type, currentTime) {
    const record = getRecord(participantId)
    if (!record) return

    const date = new Date(currentTime)
    const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    setEditingTime({ participantId, type, currentTime })
    setTimeInput(timeString)
  }

  function saveTime() {
    if (!editingTime) return

    const [hours, minutes] = timeInput.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      alert('Please enter a valid time in HH:MM format')
      return
    }

    const record = getRecord(editingTime.participantId)
    if (!record) return

    const dateTime = new Date(`${selectedDate}T${timeInput}:00`)
    const updatedRecord = {
      ...record,
      [editingTime.type]: dateTime.toISOString(),
      ...(editingTime.type === 'signIn' ? { signInBy: actorInitials } : { signOutBy: actorInitials }),
    }

    setAttendance(prev => prev.map(r => r.id === record.id ? updatedRecord : r))
    setEditingTime(null)
    setTimeInput('')
  }

  function cancelEditTime() {
    setEditingTime(null)
    setTimeInput('')
  }

  function openReasonEditor(participant) {
    const existing = getRecord(participant.id)
    if (existing?.signIn || existing?.signOut) {
      return
    }
    setReasonEditor(participant)
    setReasonInput(existing?.exceptionReason || '')
    setReasonNotesInput(existing?.exceptionNotes || '')
  }

  function selectReasonAndFocusNotes(value) {
    setReasonInput(value)
    requestAnimationFrame(() => {
      reasonNotesRef.current?.focus()
    })
  }

  function cancelReasonEditor() {
    setReasonEditor(null)
    setReasonInput('')
    setReasonNotesInput('')
  }

  function saveReasonEditor() {
    if (!reasonEditor) return
    if (!reasonInput) {
      alert('Please select a reason, or use Clear.')
      return
    }

    const existing = getRecord(reasonEditor.id)
    if (existing) {
      setAttendance(prev => prev.map(r => (
        r.id === existing.id
          ? { ...r, exceptionReason: reasonInput, exceptionNotes: reasonNotesInput.trim() || null }
          : r
      )))
    } else {
      setAttendance(prev => [
        ...prev,
        {
          id: `${reasonEditor.id}-${selectedDate}`,
          participantId: reasonEditor.id,
          date: selectedDate,
          signIn: null,
          signOut: null,
          signInBy: null,
          signOutBy: null,
          collectedBy: null,
          exceptionReason: reasonInput,
          exceptionNotes: reasonNotesInput.trim() || null,
        },
      ])
    }

    cancelReasonEditor()
  }

  function clearReasonEditor() {
    if (!reasonEditor) return
    const existing = getRecord(reasonEditor.id)
    if (existing) {
      setAttendance(prev => prev.map(r => (
        r.id === existing.id
          ? { ...r, exceptionReason: null, exceptionNotes: null }
          : r
      )))
    }
    cancelReasonEditor()
  }

  useEffect(() => {
    if (!noteEditor) return

    requestAnimationFrame(() => {
      noteInputRef.current?.focus()
    })

    function handleNoteModalKeys(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelNoteEditor()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        saveNoteEditor()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && /^p$/i.test(event.key)) {
        event.preventDefault()
        setKeepOnRecord(prev => !prev)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && /^x$/i.test(event.key)) {
        event.preventDefault()
        clearNoteEditor()
        return
      }

      if (event.key !== 'Enter') return

      const target = event.target
      const tag = String(target?.tagName || '').toLowerCase()
      // Allow Shift+Enter for newline in notes textarea.
      if (tag === 'textarea' && event.shiftKey) return

      event.preventDefault()
      saveNoteEditor()
    }

    window.addEventListener('keydown', handleNoteModalKeys)
    return () => window.removeEventListener('keydown', handleNoteModalKeys)
  }, [noteEditor, noteInput, keepOnRecord])

  useEffect(() => {
    if (!reasonEditor) return

    function handleReasonModalKeys(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelReasonEditor()
        return
      }

      if (event.key === 'Enter') {
        const target = event.target
        const tag = String(target?.tagName || '').toLowerCase()
        // Allow Shift+Enter for newline in reason notes textarea.
        if (tag === 'textarea' && event.shiftKey) return

        event.preventDefault()
        saveReasonEditor()
        return
      }

      if (/^[1-6]$/.test(event.key)) {
        const option = ATTENDANCE_REASON_OPTIONS[Number(event.key) - 1]
        if (!option) return
        event.preventDefault()
        selectReasonAndFocusNotes(option.value)
      }
    }

    window.addEventListener('keydown', handleReasonModalKeys)
    return () => window.removeEventListener('keydown', handleReasonModalKeys)
  }, [reasonEditor, reasonInput, reasonNotesInput])

  function getPickupCodeForParticipant(participant) {
    return getParticipantPickupCode(participant, selectedDate)
  }

  function getPreverifyStatusForParticipant(participant) {
    return pickupCodePreverifyStatus(participant, selectedDate)
  }

  function savePreverifyForFamily(participant, verificationPayload) {
    if (typeof setParticipants !== 'function') return
    const familyIds = getFamilyParticipants(participant, participants).map(item => item.id)
    setParticipants(prev => prev.map(person => {
      if (!familyIds.includes(person.id)) return person
      const raw = person.pickupCodeVerifications ?? person.pickup_code_verifications
      const existing = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {}
      return {
        ...person,
        pickupCodeVerifications: {
          ...existing,
          [selectedDate]: verificationPayload,
        },
      }
    }))
  }

  function openPickupCodeEditor(participant) {
    setEditingCodeParticipant(participant)
    setCodeEditInput(getPickupCodeForParticipant(participant))
    setCodeEditFieldArmed(false)
    setCodeEditMessage('')
  }

  function cancelPickupCodeEditor() {
    setEditingCodeParticipant(null)
    setCodeEditInput('')
    setCodeEditFieldArmed(false)
  }

  function savePickupCodeOverride() {
    if (!editingCodeParticipant || typeof setParticipants !== 'function') return
    const nextCode = normalizePickupCodeInput(codeEditInput)
    if (nextCode.length !== 3) {
      alert('Enter a valid 3-digit pickup code.')
      return
    }

    const familyIds = getFamilyParticipants(editingCodeParticipant, participants).map(item => item.id)
    setParticipants(prev => prev.map(person => {
      if (!familyIds.includes(person.id)) return person
      const existing = person.pickupCodeOverrides ?? person.pickup_code_overrides
      const existingMap = (existing && typeof existing === 'object' && !Array.isArray(existing)) ? existing : {}
      return {
        ...person,
        pickupCodeOverrides: {
          ...existingMap,
          [selectedDate]: nextCode,
        },
      }
    }))

    setCodeEditMessage(`Pickup code updated for ${familyIds.length} family record(s).`)
    cancelPickupCodeEditor()
  }

  function resetPickupCodeOverride() {
    if (!editingCodeParticipant || typeof setParticipants !== 'function') return
    const familyIds = getFamilyParticipants(editingCodeParticipant, participants).map(item => item.id)
    setParticipants(prev => prev.map(person => {
      if (!familyIds.includes(person.id)) return person
      const existing = person.pickupCodeOverrides ?? person.pickup_code_overrides
      const existingMap = (existing && typeof existing === 'object' && !Array.isArray(existing)) ? existing : {}
      const { [selectedDate]: _removed, ...rest } = existingMap
      return {
        ...person,
        pickupCodeOverrides: rest,
      }
    }))

    setCodeEditMessage(`Pickup code reset to automatic for ${familyIds.length} family record(s).`)
    cancelPickupCodeEditor()
  }

  // Alphabetical by first name
  const sorted = [...seasonParticipants].sort((a, b) => a.name.localeCompare(b.name))
  const filtered = sorted.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  function participantMatchesStatusFilter(participant) {
    if (statusFilter === 'all') return true
    if (statusFilter === 'follow-up') {
      const hasIncidentFollowUp = getPendingFollowUps(participant.id).length > 0
      const hasNoteFollowUp = canViewAdminFollowUps && hasParticipantNoteFollowUp(participant.id)
      const hasMarFollowUp = getPendingMarFollowUps(participant.id).length > 0
      return hasIncidentFollowUp || hasNoteFollowUp || hasMarFollowUp
    }
    const rec = getRecord(participant.id)
    const isInNow = !!(rec?.signIn && !rec?.signOut)
    return statusFilter === 'in' ? isInNow : !isInNow
  }

  const visibleParticipants = filtered.filter(participantMatchesStatusFilter)
  const activeParticipant = visibleParticipants.find(p => p.id === activeParticipantId) || visibleParticipants[0] || null

  const onSite = seasonParticipants.filter(p => { const r = getRecord(p.id); return r?.signIn && !r?.signOut })
  const notIn = seasonParticipants.filter(p => {
    const r = getRecord(p.id)
    return !(r?.signIn && !r?.signOut)
  })
  const participantsWithFollowUps = seasonParticipants.filter(p => {
    const hasIncidentFollowUp = getPendingFollowUps(p.id).length > 0
    const hasNoteFollowUp = canViewAdminFollowUps && hasParticipantNoteFollowUp(p.id)
    const hasMarFollowUp = getPendingMarFollowUps(p.id).length > 0
    return hasIncidentFollowUp || hasNoteFollowUp || hasMarFollowUp
  }).length

  function shiftSelectedDate(days) {
    const base = new Date(`${selectedDate}T12:00:00`)
    base.setDate(base.getDate() + days)
    setSelectedDate(base.toISOString().slice(0, 10))
  }

  useEffect(() => {
    function updateKeyboardMode() {
      setEnableKeyboardShortcuts(window.innerWidth >= 1024)
    }

    updateKeyboardMode()
    window.addEventListener('resize', updateKeyboardMode)
    return () => window.removeEventListener('resize', updateKeyboardMode)
  }, [])

  useEffect(() => {
    if (!visibleParticipants.length) {
      setActiveParticipantId(null)
      return
    }
    if (!activeParticipantId || !visibleParticipants.some(item => item.id === activeParticipantId)) {
      setActiveParticipantId(visibleParticipants[0].id)
    }
  }, [visibleParticipants, activeParticipantId])

  useEffect(() => {
    if (!enableKeyboardShortcuts) return

    const modalOpen = Boolean(signingInFor || collectingFor || noteEditor || editingTime || reasonEditor || editingCodeParticipant)

    function isTypingField(target) {
      if (!target) return false
      const tag = String(target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
      return Boolean(target.isContentEditable)
    }

    function moveActive(delta) {
      if (!visibleParticipants.length) return
      const currentIndex = visibleParticipants.findIndex(item => item.id === (activeParticipant?.id || ''))
      const safeIndex = currentIndex >= 0 ? currentIndex : 0
      const nextIndex = (safeIndex + delta + visibleParticipants.length) % visibleParticipants.length
      const next = visibleParticipants[nextIndex]
      setActiveParticipantId(next.id)
      requestAnimationFrame(() => {
        document.getElementById(`participant-row-${next.id}`)?.scrollIntoView({ block: 'nearest' })
      })
    }

    function handleKeyDown(event) {
      if (modalOpen) return

      if (event.key === 'Escape' && event.target === searchInputRef.current) {
        event.preventDefault()
        searchInputRef.current?.blur()
        return
      }

      if (event.key === 'Escape' && event.target === dateInputRef.current) {
        event.preventDefault()
        dateInputRef.current?.blur()
        return
      }

      if (event.key === '/') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (isTypingField(event.target)) return

      if (/^d$/i.test(event.key)) {
        event.preventDefault()
        dateInputRef.current?.focus()
        return
      }

      if (/^t$/i.test(event.key)) {
        event.preventDefault()
        setSelectedDate(today)
        return
      }

      if (event.key === '[') {
        event.preventDefault()
        shiftSelectedDate(-1)
        return
      }

      if (event.key === ']') {
        event.preventDefault()
        shiftSelectedDate(1)
        return
      }

      if (event.key === '1') {
        event.preventDefault()
        setStatusFilter('all')
        return
      }

      if (event.key === '2') {
        event.preventDefault()
        setStatusFilter('in')
        return
      }

      if (event.key === '3') {
        event.preventDefault()
        setStatusFilter('not-in')
        return
      }

      if (event.key === '4') {
        event.preventDefault()
        setStatusFilter('follow-up')
        return
      }

      if (!activeParticipant) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveActive(1)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveActive(-1)
        return
      }

      if (/^i$/i.test(event.key)) {
        const rec = getRecord(activeParticipant.id)
        if (!rec?.signIn) {
          event.preventDefault()
          openFamilySignIn(activeParticipant)
        }
        return
      }

      if (/^o$/i.test(event.key)) {
        const rec = getRecord(activeParticipant.id)
        if (rec?.signIn && !rec?.signOut) {
          event.preventDefault()
          setCollectingFor(activeParticipant)
        }
        return
      }

      if (/^v$/i.test(event.key)) {
        const rec = getRecord(activeParticipant.id)
        if (rec?.signIn && !rec?.signOut) {
          event.preventDefault()
          setVerifyingFor(activeParticipant)
        }
        return
      }

      if (/^n$/i.test(event.key)) {
        event.preventDefault()
        openNoteEditor(activeParticipant)
        return
      }

      if (/^a$/i.test(event.key)) {
        const rec = getRecord(activeParticipant.id)
        if (!(rec?.signIn || rec?.signOut)) {
          event.preventDefault()
          openReasonEditor(activeParticipant)
        }
        return
      }

      if (/^u$/i.test(event.key)) {
        const rec = getRecord(activeParticipant.id)
        if (rec?.signOut) {
          event.preventDefault()
          undoSignOut(activeParticipant)
          return
        }
        if (rec?.signIn && !rec?.signOut) {
          event.preventDefault()
          undoSignIn(activeParticipant)
        }
        return
      }

      if (event.key === 'Enter') {
        const rec = getRecord(activeParticipant.id)
        event.preventDefault()
        if (!rec?.signIn) {
          openFamilySignIn(activeParticipant)
          return
        }
        if (rec?.signIn && !rec?.signOut) {
          setCollectingFor(activeParticipant)
          return
        }
        openNoteEditor(activeParticipant)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    enableKeyboardShortcuts,
    collectingFor,
    signingInFor,
    verifyingFor,
    noteEditor,
    editingTime,
    reasonEditor,
    editingCodeParticipant,
    visibleParticipants,
    activeParticipant,
    statusFilter,
    selectedDate,
    attendance,
    search,
  ])

  function printFireRecord() {
    const onSiteList = [...seasonParticipants]
      .filter(p => {
        const r = getRecord(p.id)
        return r?.signIn && !r?.signOut
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    const rows = onSiteList.map(p => {
      const rec = getRecord(p.id)
      return `
        <tr>
          <td class="check-cell"><span class="checkbox"></span></td>
          <td>${participantDisplayName(p)}</td>
          <td>${p.pronouns || '—'}</td>
          <td>${p.age ? `Age ${p.age}` : '—'}</td>
          <td>${fmt(rec?.signIn)}</td>
        </tr>
      `
    }).join('')

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Fire Register</title>
          <style>
            body { font-family: Georgia, serif; margin: 24px; color: #1f2937; }
            h1 { margin: 0 0 4px; font-size: 22px; }
            .meta { margin-bottom: 6px; color: #6b7280; font-size: 12px; }
            .instruction { margin-bottom: 14px; font-size: 11px; color: #9ca3af; font-style: italic; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
            .check-cell { width: 36px; text-align: center; }
            .checkbox {
              display: inline-block;
              width: 18px;
              height: 18px;
              border: 2px solid #374151;
              border-radius: 3px;
              vertical-align: middle;
            }
            @media print {
              body { margin: 12px; }
            }
          </style>
        </head>
        <body>
          <h1>🔥 Fire Record — On Site Register</h1>
          <div class="meta">Date: ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB')} · Generated: ${new Date().toLocaleString('en-GB')} · Total on site: ${onSiteList.length}</div>
          <div class="instruction">Tick each box as you account for each person at the assembly point.</div>
          <table>
            <thead>
              <tr><th class="check-cell">✓</th><th>Participant</th><th>Pronouns</th><th>Age</th><th>Signed In</th></tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="5">No participants currently signed in.</td></tr>'}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) {
      alert('Allow pop-ups to print the fire register.')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  function handleRowDoubleClick(participant, event) {
    if (typeof onView !== 'function') return
    const interactiveTarget = event.target?.closest?.('button, input, textarea, select, a, label')
    if (interactiveTarget) return
    onView(participant.id)
  }

  return (
    <div className="fade-in space-y-4">
      {signingInFor && (
        <FamilySignInModal
          participant={signingInFor}
          familyTargets={getFamilySignInTargets(signingInFor)}
          selectedIds={familySignInSelection}
          enableKeyboardShortcuts={enableKeyboardShortcuts}
          onToggleParticipant={toggleFamilySignInParticipant}
          onConfirm={confirmFamilySignIn}
          onCancel={cancelFamilySignIn}
          error={familySignInError}
        />
      )}
      {verifyingFor && (
        <CodeVerifyModal
          participant={verifyingFor}
          selectedDate={selectedDate}
          actorInitials={actorInitials}
          onVerify={(payload) => {
            savePreverifyForFamily(verifyingFor, payload)
            setVerifyingFor(null)
          }}
          onCancel={() => setVerifyingFor(null)}
        />
      )}
      {collectingFor && (
        <CollectionModal
          participant={collectingFor}
          participants={participants}
          selectedDate={selectedDate}
          signedInSiblingOptions={getSignedInSiblingOptions(collectingFor)}
          preverifiedStatus={getPreverifyStatusForParticipant(collectingFor)}
          enableKeyboardShortcuts={enableKeyboardShortcuts}
          actorInitials={actorInitials}
          onConfirm={confirmSignOut}
          onCancel={() => setCollectingFor(null)}
        />
      )}
      {editingCodeParticipant && (
        <ViewportOverlay className="bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-in">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h3 className="font-display font-bold text-forest-950">Edit Family Pickup Code</h3>
                <ParticipantNameText participant={editingCodeParticipant} className="text-sm text-stone-500 mt-0.5" showDiagnosedHighlight={false} />
              </div>
              <button onClick={cancelPickupCodeEditor} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-stone-600">Date: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
              <div>
                <label className="label">3-digit code</label>
                <div className="sr-only" aria-hidden="true">
                  <input type="text" name="cc-exp" autoComplete="cc-exp" tabIndex={-1} />
                  <input type="text" name="cc-csc" autoComplete="cc-csc" inputMode="numeric" tabIndex={-1} />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={3}
                  autoComplete="new-password"
                  name={`camp-pickup-security-edit-${editingCodeParticipant?.id || 'unknown'}-${selectedDate}`}
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  readOnly={!codeEditFieldArmed}
                  onFocus={() => setCodeEditFieldArmed(true)}
                  onMouseDown={() => setCodeEditFieldArmed(true)}
                  className="input"
                  value={codeEditInput}
                  onChange={e => setCodeEditInput(normalizePickupCodeInput(e.target.value))}
                  placeholder="Enter 3 digits"
                />
              </div>
              <p className="text-xs text-stone-500">Auto-generated default: <span className="font-mono font-semibold">{buildDailyFamilyPickupCode(selectedDate, getParticipantFamilyKey(editingCodeParticipant))}</span></p>
              <p className="text-xs text-stone-500">Saving applies this date's code to all siblings in the same family.</p>
            </div>
            <div className="p-5 pt-0 flex flex-wrap gap-2">
              <button onClick={savePickupCodeOverride} className="btn-primary flex-1 min-w-[120px]">Save Code</button>
              <button onClick={resetPickupCodeOverride} className="btn-secondary min-w-[120px]">Reset Auto</button>
              <button onClick={cancelPickupCodeEditor} className="btn-secondary min-w-[120px]">Cancel</button>
            </div>
          </div>
        </ViewportOverlay>
      )}
      {noteEditor && (
        <ViewportOverlay className="bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h3 className="font-display font-bold text-forest-950">Participant Notes</h3>
                <p className="text-sm text-stone-500 mt-0.5">{noteEditor.name}</p>
              </div>
              <button onClick={cancelNoteEditor} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Today's Note</label>
                <textarea
                  ref={noteInputRef}
                  className="input min-h-[100px]"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="Add handover notes, follow-up reminders, or important context for this participant."
                />
                <p className="text-xs text-stone-500 mt-1">Keyboard: Ctrl/Cmd+Enter save, Ctrl/Cmd+Shift+P toggle pin, Ctrl/Cmd+Shift+X clear, Esc cancel.</p>
              </div>
              {/* Register follow-up checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={keepOnRecord}
                  onChange={e => setKeepOnRecord(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-forest-900 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-medium text-stone-800 group-hover:text-forest-900">Pin for follow up</span>
                  <p className="text-xs text-stone-500 mt-0.5">Show this note as a follow-up on the Sign In / Out register until it is marked done.</p>
                </div>
              </label>
              {/* Note history */}
              {Array.isArray(liveNoteEditorParticipant?.note_history) && liveNoteEditorParticipant.note_history.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Note History</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {[...liveNoteEditorParticipant.note_history].reverse().map((entry, i) => {
                      const historyIndex = liveNoteEditorParticipant.note_history.length - 1 - i
                      const isEditingEntry = editingHistoryEntry?.historyIndex === historyIndex
                      return (
                        <div key={entry.id || `${entry.savedAt || entry.date || 'note'}-${historyIndex}`} className="rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
                          {isEditingEntry ? (
                            <div className="space-y-2">
                              <textarea
                                className="input min-h-[88px]"
                                value={editingHistoryEntry.note}
                                onChange={e => setEditingHistoryEntry(prev => ({ ...prev, note: e.target.value }))}
                              />
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editingHistoryEntry.keepOnRecord}
                                  onChange={e => setEditingHistoryEntry(prev => ({ ...prev, keepOnRecord: e.target.checked }))}
                                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-forest-900 cursor-pointer"
                                />
                                <span className="text-xs text-stone-600">Pin for follow up</span>
                              </label>
                              <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={saveHistoryEntryEdit} className="text-xs font-semibold text-forest-800 hover:text-forest-950 inline-flex items-center gap-1">
                                  <Check size={13} /> Save
                                </button>
                                <button type="button" onClick={cancelEditHistoryEntry} className="text-xs font-semibold text-stone-500 hover:text-stone-800 inline-flex items-center gap-1">
                                  <X size={13} /> Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs text-stone-700 whitespace-pre-wrap flex-1">{formatMultilineHistoryText(entry.note)}</p>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button type="button" onClick={() => beginEditHistoryEntry(entry, historyIndex)} className="text-stone-400 hover:text-forest-700" title="Edit saved note">
                                    <Edit2 size={13} />
                                  </button>
                                  <button type="button" onClick={() => deleteHistoryEntry(historyIndex)} className="text-stone-400 hover:text-red-600" title="Delete saved note">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-stone-400 mt-1">
                                {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB')}
                                {entry.addedBy ? ` · ${entry.addedBy}` : ''}
                              </p>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 pt-0 flex gap-2">
              <button onClick={saveNoteEditor} className="btn-primary flex-1">Save Note</button>
              <button onClick={clearNoteEditor} className="btn-secondary">Clear</button>
              <button onClick={cancelNoteEditor} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </ViewportOverlay>
      )}
      {editingTime && (
        <ViewportOverlay className="bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-in">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h3 className="font-display font-bold text-forest-950">
                  Edit {editingTime.type === 'signIn' ? 'Sign In' : 'Sign Out'} Time
                </h3>
                <ParticipantNameText
                  participant={participants.find(p => p.id === editingTime.participantId)}
                  className="text-sm text-stone-500 mt-0.5"
                  showDiagnosedHighlight={false}
                />
              </div>
              <button onClick={cancelEditTime} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Time (HH:MM)</label>
                <input
                  type="text"
                  value={timeInput}
                  onChange={e => setTimeInput(e.target.value)}
                  className="input w-full"
                  placeholder="HH:MM"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-5 pt-0 flex gap-2">
              <button onClick={saveTime} className="btn-primary flex-1">Save Time</button>
              <button onClick={cancelEditTime} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </ViewportOverlay>
      )}
      {reasonEditor && (
        <ViewportOverlay className="bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h3 className="font-display font-bold text-forest-950">Absence Reason</h3>
                <ParticipantNameText participant={reasonEditor} className="text-sm text-stone-500 mt-0.5" showDiagnosedHighlight={false} />
              </div>
              <button onClick={cancelReasonEditor} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Reason</label>
                <select className="input" value={reasonInput} onChange={e => selectReasonAndFocusNotes(e.target.value)}>
                  <option value="">Select reason...</option>
                  {ATTENDANCE_REASON_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="text-xs text-stone-500 mt-1">
                  Number keys: 1 Illness, 2 Holiday, 3 No-show, 4 Late arrival, 5 Early leave, 6 Other
                </p>
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  ref={reasonNotesRef}
                  className="input min-h-[92px]"
                  value={reasonNotesInput}
                  onChange={e => setReasonNotesInput(e.target.value)}
                  placeholder="Add context, e.g. parent called at 08:30"
                />
              </div>
            </div>
            <div className="p-5 pt-0 flex flex-wrap gap-2">
              <button onClick={saveReasonEditor} className="btn-primary flex-1 min-w-[120px]">Save Reason</button>
              <button onClick={clearReasonEditor} className="btn-secondary min-w-[120px]">Clear</button>
              <button onClick={cancelReasonEditor} className="btn-secondary min-w-[120px]">Cancel</button>
            </div>
          </div>
        </ViewportOverlay>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Sign In / Out</h2>
          <p className="text-stone-500 text-sm">
            {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {selectedDate === today && ' (Today)'}
          </p>
          {codeEditMessage && <p className="text-xs text-emerald-700 mt-1">{codeEditMessage}</p>}
        </div>
        <div className="flex gap-2 text-center">
          <div className="card px-3 py-2">
            <p className="text-xl font-display font-bold text-amber-500">{onSite.length}</p>
            <p className="text-xs text-stone-500">On site</p>
          </div>
          <div className="card px-3 py-2">
            <p className="text-xl font-display font-bold text-stone-400">{notIn.length}</p>
            <p className="text-xs text-stone-500">Not in</p>
          </div>
        </div>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-stone-700">Select Date:</label>
        <input
          ref={dateInputRef}
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="input"
        />
        <button
          onClick={() => setSelectedDate(today)}
          className="btn-secondary text-sm"
        >
          Today
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input ref={searchInputRef} type="text" placeholder={enableKeyboardShortcuts ? 'Search participants... (Press / to focus)' : 'Search participants...'} value={search}
          onChange={e => setSearch(e.target.value)} className="input pl-9" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${statusFilter === 'all' ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200'}`}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter('in')}
          className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${statusFilter === 'in' ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200'}`}
        >
          In
        </button>
        <button
          onClick={() => setStatusFilter('not-in')}
          className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${statusFilter === 'not-in' ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200'}`}
        >
          Not in
        </button>
        <button
          onClick={() => setStatusFilter('follow-up')}
          className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${statusFilter === 'follow-up' ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200'}`}
        >
          Follow Up ({participantsWithFollowUps})
        </button>
        <button onClick={printFireRecord} className="btn-secondary text-xs py-1.5">
          Print/PDF Fire Record (In only)
        </button>
      </div>

      {seasonParticipants.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-stone-400 text-sm">No participants are assigned to Sign In / Out this season.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {/* Header row */}
          <div className="hidden md:grid md:grid-cols-[minmax(260px,1fr)_96px_96px_220px] gap-3 px-4 py-3 bg-stone-50 border-b border-stone-100 text-xs font-semibold text-stone-500 uppercase tracking-wide">
            <span>Participant</span>
            <span className="text-right">Sign In</span>
            <span className="text-right">Sign Out</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-stone-50 pb-2">
            {visibleParticipants.map(p => {
              const rec = getRecord(p.id)
              const isIn = rec?.signIn && !rec?.signOut
              const isOut = !!rec?.signOut
              const isFlashing = flash?.id === p.id
              const isActiveRow = activeParticipant?.id === p.id
              const statusLabel = isIn ? 'Present' : isOut ? 'Signed out' : 'Absent'
              const statusClass = isIn
                ? 'text-emerald-700'
                : isOut
                  ? 'text-stone-500'
                  : 'text-red-700'

              // Check if sign-in was late (after 10:15am) - only for today
              const signInTime = rec?.signIn ? new Date(rec.signIn) : null
              const isLate = selectedDate === today && signInTime && (signInTime.getHours() > 10 || (signInTime.getHours() === 10 && signInTime.getMinutes() > 15))
              const signOutTime = rec?.signOut ? new Date(rec.signOut) : null
              const isLatePickup = selectedDate === today && signOutTime && (signOutTime.getHours() > 16 || (signOutTime.getHours() === 16 && signOutTime.getMinutes() > 15))

              const hasAllergy = p.medicalType?.includes('Allergy') || Boolean(String(p.allergyDetails || '').trim())
              const hasEpiPen = hasRecordedEpiPen(p)
              const hasDietary = p.medicalType?.includes('Dietary') || Boolean(String(p.dietaryType || '').trim()) || Boolean(String(p.mealAdjustments || '').trim())
              const hasMedical = p.medicalType?.includes('Medical') || Boolean(String(p.medicalCondition || '').trim())
              const hasSendDiagnosis = Boolean(String(p.sendDiagnosis || '').trim())
              const hasDiagnosedSend = Boolean(p.sendDiagnosed) || hasSendDiagnosis
              const hasSend = Boolean(String(p.sendNeeds || '').trim()) || hasDiagnosedSend
              const hasSafeguarding = !!p.safeguardingFlag
              const pendingFollowUps = getPendingFollowUps(p.id)
              const pendingMarFollowUps = getPendingMarFollowUps(p.id)
              const allergyTooltip = sharedTooltipFor(
                p.id,
                'allergy',
                String(p.allergyDetails || '').trim() || 'No details recorded'
              )
              const epiPenTooltip = hasEpiPen
                ? sharedTooltipFor(p.id, ['allergy', 'medical'], 'EpiPen recorded for this participant')
                : ''
              const dietaryTooltip = sharedTooltipFor(
                p.id,
                'dietary',
                String(p.dietaryType || '').trim() || 'No dietary type recorded'
              )
              const medicalTooltip = sharedTooltipFor(
                p.id,
                'medical',
                String(p.medicalCondition || '').trim() || 'No medical condition recorded'
              )
              const sendTooltip = sharedTooltipFor(
                p.id,
                'send',
                String(p.sendDiagnosis || '').trim() || 'No diagnosis recorded'
              )
              const collectedByLabel = collectorDisplayLabel(rec?.collectedBy)
              const signInBy = rec?.signInBy || rec?.sign_in_by || null
              const signOutBy = rec?.signOutBy || rec?.sign_out_by || null
              const reasonLabel = attendanceReasonLabel(rec?.exceptionReason || rec?.exception_reason)
              const reasonNotes = rec?.exceptionNotes || rec?.exception_notes || ''
              const participantPickupCode = getPickupCodeForParticipant(p)
              const preverifyStatus = getPreverifyStatusForParticipant(p)
              const noteFollowUp = String(p.register_note || p.registerNote || '').trim()
              const absenceReasonLocked = Boolean(rec?.signIn || rec?.signOut)
              const birthdayValue = p.birthday || p.dob
              const birthdayInDays = daysUntilBirthday(birthdayValue, selectedDate)
              const hasUpcomingBirthday = birthdayInDays !== null && birthdayInDays >= 0 && birthdayInDays <= 5
              const birthdayTitle = birthdayInDays === 0
                ? 'Birthday today'
                : `Birthday in ${birthdayInDays} day${birthdayInDays === 1 ? '' : 's'}`

              return (
                <div key={p.id} id={`participant-row-${p.id}`}
                  onClick={() => setActiveParticipantId(p.id)}
                  onDoubleClick={(event) => handleRowDoubleClick(p, event)}
                  onFocus={() => setActiveParticipantId(p.id)}
                  tabIndex={0}
                  className={`md:grid md:grid-cols-[minmax(260px,1fr)_96px_96px_220px] md:gap-3 md:items-center px-3 md:px-4 py-3 transition-colors hover:bg-stone-50/70 ${
                    isFlashing ? 'bg-amber-50' : isIn ? 'bg-amber-50/40' : isOut ? 'bg-stone-50/60 opacity-75' : ''
                  } ${enableKeyboardShortcuts && isActiveRow ? 'ring-2 ring-forest-400 ring-inset bg-forest-50/40' : ''
                  } ${enableKeyboardShortcuts ? 'cursor-pointer focus:outline-none' : ''}`}>

                  {/* Name + flags */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ParticipantNameText participant={p} className="font-display font-semibold text-forest-950 text-sm" showDiagnosedHighlight={false} />
                      {hasUpcomingBirthday && (
                        <span
                          role="img"
                          aria-label={birthdayTitle}
                          title={birthdayTitle}
                          className="text-sm"
                        >
                          🎂
                        </span>
                      )}
                      {photoConsentMode(p.photoConsent) === 'no' && (
                        <CameraOff size={12} className="text-rose-700" title="No photo consent" />
                      )}
                      {photoConsentMode(p.photoConsent) === 'internal' && (
                        <span className="relative inline-flex" title="Photo consent: internal use only">
                          <Camera size={12} className="text-amber-700" />
                          <span className="absolute -top-1 -right-1 text-[8px] font-bold leading-none text-amber-900">!</span>
                        </span>
                      )}
                      {hasAllergy && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 cursor-help"
                          title={allergyTooltip}
                        >
                          A
                        </span>
                      )}
                      {hasEpiPen && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 cursor-help"
                          title={epiPenTooltip}
                        >
                          EP
                        </span>
                      )}
                      {hasDietary && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-200 cursor-help"
                          title={dietaryTooltip}
                        >
                          D
                        </span>
                      )}
                      {hasMedical && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 cursor-help"
                          title={medicalTooltip}
                        >
                          M
                        </span>
                      )}
                      {hasSend && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-help ${hasDiagnosedSend ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}
                          title={sendTooltip}
                        >
                          S
                        </span>
                      )}
                      {hasSafeguarding && <SafeguardingFlagIcon size={11} />}
                      {isIn && <CheckCircle size={13} className="text-amber-500" />}
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {p.pronouns}{p.age ? ` · Age ${p.age}` : ''}
                      {isOut && collectedByLabel && (
                        <span className="ml-2 text-stone-500">· {collectedByLabel.withPrefix ? `Collected by ${collectedByLabel.label}` : collectedByLabel.label}</span>
                      )}
                    </p>
                    <p className={`text-xs mt-1 font-semibold ${statusClass}`}>{statusLabel}</p>
                    <p className="text-[11px] mt-1 text-amber-800">
                      Family pickup code:{' '}
                      <button
                        type="button"
                        onClick={() => openPickupCodeEditor(p)}
                        title="Edit family pickup code"
                        className="font-mono font-semibold underline decoration-dotted underline-offset-2 hover:text-amber-900"
                      >
                        {participantPickupCode}
                      </button>
                    </p>
                    {reasonLabel && !isIn && (
                      <p className="text-xs mt-1 text-amber-700">
                        Absence Reason: <span className="font-medium">{reasonLabel}</span>{reasonNotes ? ` - ${reasonNotes}` : ''}
                      </p>
                    )}
                    {pendingFollowUps.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {pendingFollowUps.map(incident => {
                          const isToday = incident.followUpTiming === 'today'
                          const isOverdue = incident.followUpDueDate < selectedDate
                          return (
                            <div
                              key={incident.id}
                              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                                isToday
                                  ? 'border-orange-200 bg-orange-50 text-orange-800'
                                  : isOverdue
                                  ? 'border-red-200 bg-red-50 text-red-800'
                                  : 'border-amber-200 bg-amber-50 text-amber-800'
                              }`}
                            >
                              <span>
                                {isToday
                                  ? `⚠️ ${incident.type} — inform parent/carer at pickup today`
                                  : `Follow Up: ${incident.type}${isOverdue
                                      ? ` (overdue since ${new Date(incident.followUpDueDate + 'T12:00:00').toLocaleDateString('en-GB')})`
                                      : ` (due ${new Date(incident.followUpDueDate + 'T12:00:00').toLocaleDateString('en-GB')})`}`
                                }
                              </span>
                              <button
                                type="button"
                                onClick={() => completeFollowUp(incident.id)}
                                className="ml-auto rounded bg-white/80 px-2 py-0.5 text-[11px] font-semibold hover:bg-white"
                              >
                                Mark done
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {pendingMarFollowUps.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {pendingMarFollowUps.map(row => {
                          const when = row.administered_at ? new Date(row.administered_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
                          const medLabel = row.medication_name || 'Ad-hoc medication'
                          return (
                            <div
                              key={row.id}
                              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
                            >
                              <span>
                                Medication Follow Up: {medLabel} given {when} — inform parent at pickup
                              </span>
                              <button
                                type="button"
                                onClick={() => completeMarFollowUp(row.id)}
                                className="ml-auto rounded bg-white/80 px-2 py-0.5 text-[11px] font-semibold hover:bg-white"
                              >
                                Mark done
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {canViewAdminFollowUps && noteFollowUp && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-900">
                          <span>
                            Follow Up Note: {formatRegisterInlineText(noteFollowUp)}
                          </span>
                          <button
                            type="button"
                            onClick={() => clearParticipantNoteFollowUp(p.id)}
                            className="ml-auto rounded bg-white/80 px-2 py-0.5 text-[11px] font-semibold hover:bg-white"
                          >
                            Mark done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sign in/out times — inline on mobile, columns on desktop */}
                  <div className="md:hidden flex items-center gap-3 mt-1 mb-1">
                    {rec?.signIn && (
                      <button onClick={() => startEditTime(p.id, 'signIn', rec.signIn)}
                        className="text-xs font-mono text-green-700 font-semibold hover:bg-green-50 px-1.5 py-0.5 rounded">
                        ↓ {fmt(rec?.signIn)}{isLate ? ' · Late' : ''}
                      </button>
                    )}
                    {rec?.signOut && (
                      <button onClick={() => startEditTime(p.id, 'signOut', rec.signOut)}
                        className="text-xs font-mono text-blue-700 font-semibold hover:bg-blue-50 px-1.5 py-0.5 rounded">
                        ↑ {fmt(rec?.signOut)}{isLatePickup ? ' · Late pickup' : ''}
                      </button>
                    )}
                  </div>

                  {/* Sign in time — desktop only */}
                  <div className="hidden md:block text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      {rec?.signIn ? (
                        <button
                          className="text-xs font-mono text-green-700 font-semibold cursor-pointer hover:bg-green-50 px-2 py-1 rounded transition-colors"
                          onClick={() => startEditTime(p.id, 'signIn', rec.signIn)}
                        >
                          {fmt(rec?.signIn)}
                        </button>
                      ) : (
                        <span className="text-xs font-mono text-stone-300">{fmt(rec?.signIn)}</span>
                      )}
                      {isLate && <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Late</span>}
                      {signInBy && <span className="text-[10px] text-stone-500">by {signInBy}</span>}
                    </div>
                  </div>

                  {/* Sign out time — desktop only */}
                  <div className="hidden md:block text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      {rec?.signOut ? (
                        <button
                          className="text-xs font-mono text-blue-700 font-semibold cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                          onClick={() => startEditTime(p.id, 'signOut', rec.signOut)}
                        >
                          {fmt(rec?.signOut)}
                        </button>
                      ) : (
                        <span className="text-xs font-mono text-stone-300">{fmt(rec?.signOut)}</span>
                      )}
                      {signOutBy && <span className="text-[10px] text-stone-500">by {signOutBy}</span>}
                      {isLatePickup && <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Late pickup</span>}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-1 justify-start md:justify-end md:mt-0 mt-2 flex-wrap md:flex-nowrap">
                    {!rec?.signIn && (
                      <button onClick={() => openFamilySignIn(p)}
                        className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-display font-semibold bg-amber-500 hover:bg-amber-600 text-white active:scale-95 transition-all whitespace-nowrap">
                        <LogIn size={12} /> In
                      </button>
                    )}
                    {rec?.signIn && !rec?.signOut && (
                      <>
                        <button onClick={() => setCollectingFor(p)}
                          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-display font-semibold bg-forest-900 hover:bg-forest-800 text-white active:scale-95 transition-all whitespace-nowrap">
                          <LogOut size={12} /> Out
                        </button>
                        <button onClick={() => undoSignIn(p)} title="Undo sign-in"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-all">
                          <RotateCcw size={13} />
                        </button>
                      </>
                    )}
                    <button onClick={() => openNoteEditor(p)} title="Edit participant notes"
                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-display font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 active:scale-95 transition-all whitespace-nowrap">
                      <FileText size={12} /> Notes
                    </button>
                    {isIn && (
                      <button onClick={() => setVerifyingFor(p)} title={preverifyStatus.valid ? 'Pickup code already pre-verified (click to re-verify)' : 'Pre-verify pickup code'}
                        className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-display font-semibold active:scale-95 transition-all whitespace-nowrap ${
                          preverifyStatus.valid
                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                        }`}>
                        <Check size={12} /> {preverifyStatus.valid ? 'Verified' : 'Verify Code'}
                      </button>
                    )}
                    {!absenceReasonLocked && (
                      <button
                        onClick={() => openReasonEditor(p)}
                        title="Add absence reason"
                        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-display font-semibold active:scale-95 transition-all bg-amber-50 hover:bg-amber-100 text-amber-800 whitespace-nowrap"
                      >
                        <Calendar size={12} /> <span className="md:inline hidden">Absence Reason</span><span className="md:hidden">Absent</span>
                      </button>
                    )}
                    {rec?.signOut && (
                      <button onClick={() => undoSignOut(p)} title="Undo sign-out"
                        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-display font-medium bg-stone-100 hover:bg-red-100 hover:text-red-700 text-stone-500 active:scale-95 transition-all whitespace-nowrap">
                        <RotateCcw size={12} /> Undo
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Key */}
      <div className="flex gap-3 flex-wrap text-xs text-stone-500">
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-red-100 text-red-700 border border-red-200">A</span> Allergy</span>
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-amber-100 text-amber-800 border border-amber-200">EP</span> EpiPen</span>
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-green-100 text-green-800 border border-green-200">D</span> Dietary</span>
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-blue-100 text-blue-700 border border-blue-200">M</span> Medical</span>
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-purple-100 text-purple-700 border border-purple-200">S</span> Support Needs</span>
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-orange-100 text-orange-700 border border-orange-200">S</span> Formally Diagnosed SEND</span>
        <span className="flex items-center gap-1"><SafeguardingFlagIcon size={11} /> Safeguarding flag</span>
      </div>

      <div className={`${enableKeyboardShortcuts ? '' : 'hidden'}`}>
        <button
          type="button"
          onClick={() => setShowKeyboardKey(prev => !prev)}
          className="w-full card border border-forest-200 bg-forest-50/40 px-4 py-2 text-left flex items-center justify-between"
        >
          <span className="text-sm font-display font-bold text-forest-900">Keyboard Key (No Mouse Workflow)</span>
          <span className="text-xs text-forest-800 font-semibold">{showKeyboardKey ? 'Hide' : 'Show'}</span>
        </button>
        {showKeyboardKey && (
          <div className="card border border-forest-200 bg-forest-50/40 mt-2">
            <div className="text-xs text-stone-700 grid grid-cols-1 md:grid-cols-2 gap-2">
              <p><span className="font-semibold">General:</span> <span className="font-mono">/</span> focus search, <span className="font-mono">Esc</span> leave search, <span className="font-mono">D</span> focus date, <span className="font-mono">[</span>/<span className="font-mono">]</span> previous/next day, <span className="font-mono">T</span> today, <span className="font-mono">1</span>/<span className="font-mono">2</span>/<span className="font-mono">3</span>/<span className="font-mono">4</span> filter tabs.</p>
              <p><span className="font-semibold">Move rows:</span> <span className="font-mono">↑</span>/<span className="font-mono">↓</span> change active participant.</p>
              <p><span className="font-semibold">Row actions:</span> <span className="font-mono">Enter</span> primary action, <span className="font-mono">I</span> sign in, <span className="font-mono">O</span> open sign out, <span className="font-mono">V</span> pre-verify code, <span className="font-mono">N</span> notes, <span className="font-mono">A</span> absence reason, <span className="font-mono">U</span> undo.</p>
              <p><span className="font-semibold">Out modal:</span> type 3-digit code then <span className="font-mono">Enter</span> to unlock adults; <span className="font-mono">1-9</span> choose adult; <span className="font-mono">0</span> leave unaccompanied; <span className="font-mono">O</span> choose Other; <span className="font-mono">Enter</span> confirm; <span className="font-mono">Esc</span> cancel.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
