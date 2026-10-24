import { afterEach, describe, expect, test, vi } from 'vitest'
import { publishDataChanged, subscribeToDataChanges } from './changeSignal.ts'

const originalEventSource = Object.getOwnPropertyDescriptor(globalThis, 'EventSource')

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = []
  readonly url: string
  readonly withCredentials: boolean
  close = vi.fn()

  constructor(url: string | URL, options?: EventSourceInit) {
    super()
    this.url = String(url)
    this.withCredentials = options?.withCredentials ?? false
    FakeEventSource.instances.push(this)
  }
}

function installFakeEventSource() {
  FakeEventSource.instances = []
  Object.defineProperty(globalThis, 'EventSource', {
    configurable: true,
    writable: true,
    value: FakeEventSource,
  })
}

afterEach(() => {
  for (const source of FakeEventSource.instances) source.close()
  if (originalEventSource) {
    Object.defineProperty(globalThis, 'EventSource', originalEventSource)
  } else {
    Reflect.deleteProperty(globalThis, 'EventSource')
  }
})

describe('real-time change signals', () => {
  test('shares one authenticated SSE stream across subscribers and fans out server events', () => {
    installFakeEventSource()
    const first = vi.fn()
    const second = vi.fn()
    const unsubscribeFirst = subscribeToDataChanges(first)
    const unsubscribeSecond = subscribeToDataChanges(second)

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]?.url).toContain('/api/v1/events')
    expect(FakeEventSource.instances[0]?.withCredentials).toBe(true)

    FakeEventSource.instances[0]?.dispatchEvent(new Event('open'))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)

    // Reconnecting SSE must prompt a fresh API read to close any gap.
    FakeEventSource.instances[0]?.dispatchEvent(new Event('open'))
    expect(first).toHaveBeenCalledTimes(2)
    expect(second).toHaveBeenCalledTimes(2)

    FakeEventSource.instances[0]?.dispatchEvent(new MessageEvent('data-changed', {
      data: '{"type":"data-changed"}',
      lastEventId: '42',
    }))
    expect(first).toHaveBeenCalledTimes(3)
    expect(second).toHaveBeenCalledTimes(3)

    unsubscribeFirst()
    expect(FakeEventSource.instances[0]?.close).not.toHaveBeenCalled()
    unsubscribeSecond()
    expect(FakeEventSource.instances[0]?.close).toHaveBeenCalledTimes(1)
  })

  test('notifies mounted views immediately after a local successful write', () => {
    installFakeEventSource()
    const listener = vi.fn()
    const unsubscribe = subscribeToDataChanges(listener)
    try {
      publishDataChanged()
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      unsubscribe()
    }
  })
})
