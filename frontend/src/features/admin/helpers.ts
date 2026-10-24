import type { AdminClass } from './types.ts'

export type StudyLevelCode = 'TC' | '1BAC' | '2BAC' | 'other'

/**
 * Workbooks can store a long Arabic stream description in class.level. Prefer
 * the standardized class-name prefix, with the label as a compatibility fallback.
 */
export const studyLevelCode = (item: Pick<AdminClass, 'name' | 'level'>): StudyLevelCode => {
  const name = item.name.trim().toLocaleUpperCase()
  if (name.startsWith('TC')) return 'TC'
  if (name.startsWith('1BAC')) return '1BAC'
  if (name.startsWith('2BAC')) return '2BAC'

  const level = (item.level ?? '').trim().toLocaleUpperCase()
  if (level === 'TC' || /الجذع\s*المشترك/.test(level)) return 'TC'
  if (level === '1BAC' || /الأولى\s*باكالوريا|الاولى\s*باكالوريا/.test(level)) return '1BAC'
  if (level === '2BAC' || /الثانية\s*باكالوريا|الثانيه\s*باكالوريا/.test(level)) return '2BAC'
  return 'other'
}

export const compareClassNames = (a: Pick<AdminClass, 'name'>, b: Pick<AdminClass, 'name'>): number =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

export const compareRosterNumbers = (
  a: { roster_number?: string | number | null; last_name: string; first_name: string; id: number },
  b: { roster_number?: string | number | null; last_name: string; first_name: string; id: number },
): number => {
  const left = String(a.roster_number ?? '').trim()
  const right = String(b.roster_number ?? '').trim()
  const leftNumeric = /^\d+$/.test(left)
  const rightNumeric = /^\d+$/.test(right)

  if (leftNumeric && rightNumeric) {
    const difference = Number(left) - Number(right)
    if (difference !== 0) return difference
  } else if (leftNumeric !== rightNumeric) {
    return leftNumeric ? -1 : 1
  } else if (left !== right) {
    if (left === '') return 1
    if (right === '') return -1
    const difference = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    if (difference !== 0) return difference
  }

  return (a.last_name + ' ' + a.first_name).localeCompare(
    b.last_name + ' ' + b.first_name,
    undefined,
    { numeric: true, sensitivity: 'base' },
  ) || a.id - b.id
}

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
