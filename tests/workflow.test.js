import { describe, it, expect } from 'vitest'
import {
  getIncidentDueDateKey,
  getFollowUpStatus,
  getPendingFollowUpsForParticipant,
  getFollowUpsDue,
  toCsv,
} from '../src/utils/workflow'

describe('workflow helpers', () => {
  it('resolves due date key from followUpDueDate first', () => {
    const incident = { followUpDueDate: '2026-04-10', createdAt: '2026-04-08T11:00:00.000Z' }
    expect(getIncidentDueDateKey(incident)).toBe('2026-04-10')
  })

  it('falls back to created date when due date is missing', () => {
    const incident = { createdAt: '2026-04-08T11:00:00.000Z' }
    expect(getIncidentDueDateKey(incident)).toBe('2026-04-08')
  })

  it('classifies follow-up status as overdue or due', () => {
    const overdue = { followUpRequired: true, followUpDueDate: '2026-04-09' }
    const due = { followUpRequired: true, followUpDueDate: '2026-04-10' }
    const future = { followUpRequired: true, followUpDueDate: '2026-04-11' }
    const complete = { followUpRequired: true, followUpDueDate: '2026-04-09', followUpCompletedAt: '2026-04-10T08:00:00.000Z' }

    expect(getFollowUpStatus(overdue, '2026-04-10')).toBe('overdue')
    expect(getFollowUpStatus(due, '2026-04-10')).toBe('due')
    expect(getFollowUpStatus(future, '2026-04-10')).toBeNull()
    expect(getFollowUpStatus(complete, '2026-04-10')).toBeNull()
  })

  it('returns only pending follow-ups for selected participant and day', () => {
    const incidents = [
      { id: '1', participantId: 'p1', followUpRequired: true, followUpDueDate: '2026-04-09', createdAt: '2026-04-08T10:00:00.000Z' },
      { id: '2', participantId: 'p1', followUpRequired: true, followUpDueDate: '2026-04-10', createdAt: '2026-04-08T11:00:00.000Z' },
      { id: '3', participantId: 'p1', followUpRequired: true, followUpDueDate: '2026-04-11', createdAt: '2026-04-08T12:00:00.000Z' },
      { id: '4', participantId: 'p2', followUpRequired: true, followUpDueDate: '2026-04-09', createdAt: '2026-04-08T13:00:00.000Z' },
      { id: '5', participantId: 'p1', followUpRequired: true, followUpDueDate: '2026-04-08', followUpCompletedAt: '2026-04-09T09:00:00.000Z', createdAt: '2026-04-08T09:00:00.000Z' },
    ]

    const result = getPendingFollowUpsForParticipant(incidents, 'p1', '2026-04-10')
    expect(result.map((i) => i.id)).toEqual(['1', '2'])
  })

  it('sorts dashboard due follow-ups with overdue first', () => {
    const participants = [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }]
    const incidents = [
      { id: '1', participantId: 'p1', followUpRequired: true, followUpDueDate: '2026-04-10', createdAt: '2026-04-09T08:00:00.000Z' },
      { id: '2', participantId: 'p2', followUpRequired: true, followUpDueDate: '2026-04-09', createdAt: '2026-04-09T09:00:00.000Z' },
    ]

    const result = getFollowUpsDue(incidents, participants, '2026-04-10')
    expect(result.map((i) => i.id)).toEqual(['2', '1'])
    expect(result[0].status).toBe('overdue')
    expect(result[1].status).toBe('due')
  })

  it('converts rows to escaped CSV', () => {
    const csv = toCsv([
      { name: 'Sam', notes: 'Line1\nLine2' },
      { name: 'Alex, Jr', notes: 'Quote "test"' },
    ])

    expect(csv).toContain('name,notes')
    expect(csv).toContain('"Line1\nLine2"')
    expect(csv).toContain('"Alex, Jr"')
    expect(csv).toContain('"Quote ""test"""')
  })
})
