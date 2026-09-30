import { beforeEach, describe, expect, test } from 'vitest'
import { safeReturnTo } from './safeReturnTo.ts'

describe('safeReturnTo', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))

  test('returns internal path, query and hash unchanged', () => {
    expect(safeReturnTo('/app/attendance?day=2#period-1')).toBe('/app/attendance?day=2#period-1')
  })

  test('uses fallback for non-string or empty values', () => {
    expect(safeReturnTo(null)).toBe('/app')
    expect(safeReturnTo('')).toBe('/app')
  })

  test('rejects protocol-relative destinations', () => {
    expect(safeReturnTo('//evil.example/login')).toBe('/app')
    expect(safeReturnTo('/\\\\evil.example/login')).toBe('/app')
  })

  test('rejects external absolute URLs and javascript schemes', () => {
    expect(safeReturnTo('https://evil.example/')).toBe('/app')
    expect(safeReturnTo('javascript:alert(1)')).toBe('/app')
  })
})
