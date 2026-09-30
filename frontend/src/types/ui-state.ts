export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export type MutationStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'retrying' | 'blocked'

export type BasicMutationStatus = 'idle' | 'saving' | 'success' | 'error'

export interface AsyncResourceState<T> {
  status: AsyncStatus
  data: T | null
  error: string | null
}

export function isInitialLoading<T>(state: AsyncResourceState<T>): boolean {
  return state.status === 'idle' || (state.status === 'loading' && state.data === null)
}

export function isRefreshing<T>(state: AsyncResourceState<T>): boolean {
  return state.status === 'loading' && state.data !== null
}

export function hasStaleData<T>(state: AsyncResourceState<T>): boolean {
  return state.status === 'error' && state.data !== null
}

export function isInitialError<T>(state: AsyncResourceState<T>): boolean {
  return state.status === 'error' && state.data === null
}
