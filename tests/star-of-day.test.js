import { describe, expect, it } from 'vitest'
import {
  buildDatesFromRanges,
  buildStarRangeDates,
  getStarTotalTone,
  isParticipantInSeason,
  weekStart,
} from '../src/utils/starOfDay'

describe('star of the day helpers', () => {
  it('treats participants as in season by default', () => {
    expect(isParticipantInSeason({})).toBe(true)
    expect(isParticipantInSeason({ isActiveThisSeason: true })).toBe(true)
    expect(isParticipantInSeason({ isActiveThisSeason: false })).toBe(false)
    expect(isParticipantInSeason({ is_active_this_season: 'false' })).toBe(false)
  })

  it('returns the correct total tone', () => {
    expect(getStarTotalTone(0)).toBe('neutral')
    expect(getStarTotalTone(1)).toBe('positive')
    expect(getStarTotalTone(2)).toBe('high')
    expect(getStarTotalTone(5)).toBe('high')
  })

  it('builds a current week range ending today', () => {
    expect(weekStart('2026-04-16')).toBe('2026-04-13')
    expect(buildStarRangeDates('week', '2026-04-16')).toEqual([
      '2026-04-13',
      '2026-04-14',
      '2026-04-15',
      '2026-04-16',
    ])
  })

  it('uses the earliest award when all time is selected', () => {
    expect(buildStarRangeDates('all', '2026-04-16', [
      { awardDate: '2026-04-10' },
      { award_date: '2026-04-12' },
    ])).toEqual([
      '2026-04-10',
      '2026-04-11',
      '2026-04-12',
      '2026-04-13',
      '2026-04-14',
      '2026-04-15',
      '2026-04-16',
    ])
  })

  it('builds non-contiguous date keys from multiple ranges', () => {
    expect(buildDatesFromRanges([
      { startKey: '2026-04-01', endKey: '2026-04-03' },
      { startKey: '2026-04-05', endKey: '2026-04-08' },
    ])).toEqual([
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
      '2026-04-05',
      '2026-04-06',
      '2026-04-07',
      '2026-04-08',
    ])
  })
})
