import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { AdminWorkspaceToolbar } from './AdminWorkspaceToolbar.tsx'

describe('AdminWorkspaceToolbar', () => {
  test('renders search and filter content as one accessible workspace control', () => {
    render(
      <AdminWorkspaceToolbar
        searchLabel="Search"
        searchPlaceholder="Search teachers"
        searchValue=""
        onSearchChange={() => undefined}
      >
        <label htmlFor="filter">Status</label>
        <select id="filter" aria-label="Status">
          <option>All</option>
        </select>
      </AdminWorkspaceToolbar>,
    )

    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search teachers')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument()
  })
})
