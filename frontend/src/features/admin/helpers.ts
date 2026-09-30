export const asNumber = (value: number | string | null | undefined): number => {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

export const isActive = (value: boolean | number): boolean =>
  value === true || value === 1

export const dateTime = (value: string | null | undefined): string =>
  value ? value.replace('T', ' ').replace('Z', '') : '—'

export const jsonMeta = (value: Record<string, unknown> | null): string =>
  value === null ? '—' : JSON.stringify(value)
