export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  status: AsyncStatus
  data: T | null
  error: string | null
}

export type MutationStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'failed'
  | 'retrying'
  | 'blocked'

export interface MutationState {
  status: MutationStatus
  error: string | null
}

export function isLoaded<T>(state: AsyncState<T>): state is AsyncState<T> & { status: 'success'; data: T } {
  return state.status === 'success' && state.data !== null
}
