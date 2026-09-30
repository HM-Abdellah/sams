type AttendancePendingWorkDetail = { busy: boolean }

const EVENT_NAME = 'sams:attendance-pending-work'

export function publishAttendancePendingWork(busy: boolean): void {
  window.dispatchEvent(new CustomEvent<AttendancePendingWorkDetail>(EVENT_NAME, {
    detail: { busy },
  }))
}

export function onAttendancePendingWork(
  listener: (busy: boolean) => void,
): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<AttendancePendingWorkDetail>
    listener(customEvent.detail.busy)
  }
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
