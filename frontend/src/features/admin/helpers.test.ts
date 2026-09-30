import { describe, expect, test } from 'vitest'
import { asNumber, dateTime, isActive, jsonMeta } from './helpers.ts'

describe('admin helpers', () => {
  test('normalizes numeric values safely', () => {
    expect(asNumber('12')).toBe(12)
    expect(asNumber(3)).toBe(3)
    expect(asNumber('not-a-number')).toBe(0)
    expect(asNumber(null)).toBe(0)
  })

  test('recognizes supported active flags', () => {
    expect(isActive(true)).toBe(true)
    expect(isActive(1)).toBe(true)
    expect(isActive(false)).toBe(false)
    expect(isActive(0)).toBe(false)
  })

  test('formats API timestamps without inventing timezone conversion', () => {
    expect(dateTime('2026-09-30T12:34:56Z')).toBe('2026-09-30 12:34:56')
    expect(dateTime(null)).toBe('—')
  })

  test('serializes audit metadata or uses a stable empty marker', () => {
    expect(jsonMeta({ source: 'e2e', count: 2 })).toBe('{"source":"e2e","count":2}')
    expect(jsonMeta(null)).toBe('—')
  })
})
