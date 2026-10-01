import type { ReactNode } from 'react'
import { FormField, Input } from '../ui/index.ts'

interface Props {
  searchLabel: string
  searchValue: string
  searchPlaceholder?: string
  onSearchChange: (value: string) => void
  children?: ReactNode
}

export function AdminWorkspaceToolbar({
  searchLabel,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  children,
}: Props) {
  return (
    <section className="sams-admin-toolbar grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
      <FormField label={searchLabel}>
        {({ id, ...aria }) => (
          <Input
            id={id}
            {...aria}
            type="search"
            value={searchValue}
            placeholder={searchPlaceholder}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        )}
      </FormField>
      {children}
    </section>
  )
}
