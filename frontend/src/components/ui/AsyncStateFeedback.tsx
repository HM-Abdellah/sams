import type { AsyncResourceState } from '../../types/ui-state.ts'
import { Button } from './Button.tsx'
import { ErrorState, StatusMessage } from './Feedback.tsx'
import { Loading } from './Loading.tsx'

interface AsyncStateFeedbackProps<T> {
  state: AsyncResourceState<T>
  loadingLabel: string
  errorTitle: string
  genericError: string
  reloadLabel: string
  refreshingLabel: string
  staleErrorLabel: string
  onRetry: () => void
}

export function AsyncStateFeedback<T>({
  state,
  loadingLabel,
  errorTitle,
  genericError,
  reloadLabel,
  refreshingLabel,
  staleErrorLabel,
  onRetry,
}: AsyncStateFeedbackProps<T>) {
  const hasData = state.data !== null

  if (state.status === 'idle' || (state.status === 'loading' && !hasData)) {
    return <Loading label={loadingLabel} />
  }

  if (state.status === 'error' && !hasData) {
    return (
      <ErrorState
        title={errorTitle}
        description={state.error ?? genericError}
        action={
          <Button type="button" variant="secondary" onClick={onRetry}>
            {reloadLabel}
          </Button>
        }
      />
    )
  }

  if (state.status === 'loading') {
    return <StatusMessage variant="info">{refreshingLabel}</StatusMessage>
  }

  if (state.status === 'error') {
    return (
      <StatusMessage
        variant="danger"
        title={errorTitle}
        action={
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            {reloadLabel}
          </Button>
        }
      >
        <p>{state.error ?? staleErrorLabel}</p>
      </StatusMessage>
    )
  }

  return null
}
