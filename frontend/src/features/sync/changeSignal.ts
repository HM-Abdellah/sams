import { env } from '../../lib/env.ts'

const CHANNEL_NAME = 'sams:data-changed'
const STORAGE_KEY = 'sams:data-change'
const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null
let eventSource: EventSource | null = null

interface ChangeMessage {
  type: 'data-changed'
  nonce: string
}

function isChangeMessage(value: unknown): value is ChangeMessage {
  return Boolean(
    value
    && typeof value === 'object'
    && 'type' in value
    && (value as { type?: unknown }).type === 'data-changed',
  )
}

function notifyListeners(value: unknown) {
  if (!isChangeMessage(value)) return
  for (const listener of listeners) listener()
}

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (channel !== null) return channel

  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      notifyListeners(event.data)
    })
    return channel
  } catch {
    channel = null
    return null
  }
}

function startServerEventStream(): void {
  if (
    typeof window === 'undefined'
    || typeof EventSource === 'undefined'
    || eventSource !== null
    || listeners.size === 0
  ) return

  let streamUrl: URL
  try {
    streamUrl = new URL(`${env.apiBaseUrl.replace(/\/+$/, '')}/events`, window.location.href)
  } catch {
    return
  }

  // The current backend uses same-origin session cookies and does not enable
  // cross-origin credentialed SSE. Remote API configurations use polling fallback.
  if (streamUrl.origin !== window.location.origin) return

  try {
    const source = new EventSource(streamUrl.toString(), { withCredentials: true })
    eventSource = source
    source.addEventListener('open', () => {
      // Refresh after both the initial connection and each automatic reconnect,
      // closing the race if writes occurred while the stream was disconnected.
      notifyListeners({ type: 'data-changed', nonce: `sse-open-${Date.now()}` })
    })
    source.addEventListener('data-changed', (event: Event) => {
      const messageEvent = event as MessageEvent<string>
      notifyListeners({ type: 'data-changed', nonce: messageEvent.lastEventId || String(Date.now()) })
    })
    source.addEventListener('error', () => {
      // HTTP 204 means the session expired; the browser closes EventSource instead
      // of retrying. Clear the handle so a newly authenticated view can reconnect.
      if (source.readyState === EventSource.CLOSED && eventSource === source) {
        eventSource = null
      }
    })
    // EventSource handles reconnects and sends Last-Event-ID automatically.
    // If the stream is unavailable, useLiveRefresh's polling remains active.
  } catch {
    eventSource?.close()
    eventSource = null
  }
}

function stopServerEventStreamWhenUnused(): void {
  if (listeners.size !== 0 || eventSource === null) return
  eventSource.close()
  eventSource = null
}

/** Notify current and other open tabs after a successful write; no school data is sent. */
export function publishDataChanged(): void {
  const message: ChangeMessage = {
    type: 'data-changed',
    nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }

  // Update other mounted views in this tab immediately.
  notifyListeners(message)

  const activeChannel = getChannel()
  if (activeChannel !== null) {
    try {
      activeChannel.postMessage(message)
      return
    } catch {
      // Fall through to the storage event for browsers where channel posting fails.
    }
  }

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message))
    }
  } catch {
    // Cross-tab signaling is an optimization; the server stream/polling is the fallback.
  }
}

/** Subscribe to same-tab, cross-tab, and server-originated change notifications. */
export function subscribeToDataChanges(listener: () => void): () => void {
  listeners.add(listener)

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || event.newValue === null) return
    try {
      notifyListeners(JSON.parse(event.newValue) as unknown)
    } catch {
      // Ignore malformed or stale storage values.
    }
  }

  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  getChannel()
  startServerEventStream()

  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
    stopServerEventStreamWhenUnused()
  }
}
