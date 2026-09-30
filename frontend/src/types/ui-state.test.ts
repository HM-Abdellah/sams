import { describe, expect, test } from 'vitest'
import { hasStaleData, isInitialError, isInitialLoading, isRefreshing } from './ui-state.ts'

describe('UI async state helpers', () => {
  const data = { id: 1 }
  test('classifies initial loading without data', () => {
    expect(isInitialLoading({ status: 'idle', data: null, error: null })).toBe(true)
    expect(isInitialLoading({ status: 'loading', data: null, error: null })).toBe(true)
  })
  test('distinguishes refresh from initial loading', () => {
    expect(isRefreshing({ status: 'loading', data, error: null })).toBe(true)
    expect(isInitialLoading({ status: 'loading', data, error: null })).toBe(false)
  })
  test('preserves stale-data semantics after an error', () => {
    expect(hasStaleData({ status: 'error', data, error: 'refresh failed' })).toBe(true)
    expect(isInitialError({ status: 'error', data: null, error: 'failed' })).toBe(true)
  })
})
