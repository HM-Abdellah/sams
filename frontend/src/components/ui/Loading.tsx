export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm text-[var(--sams-muted)]">
      <span aria-hidden="true" className="size-4 animate-pulse rounded-full border-2 border-current border-e-transparent" />
      <span>{label}</span>
    </div>
  )
}
