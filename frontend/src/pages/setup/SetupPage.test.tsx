import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import { setupApi } from '../../features/setup/api.ts'
import { SetupPage } from './SetupPage.tsx'

describe('SetupPage', () => {
  beforeEach(() => {
    vi.spyOn(setupApi, 'status').mockResolvedValue({
      available: false,
      configured: true,
      initialized: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('does not expose the setup form after initialization', async () => {
    render(
      <MemoryRouter initialEntries={['/setup']}>
        <I18nProvider>
          <SetupPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('First-time setup is unavailable')).toBeInTheDocument()
    })

    expect(screen.queryByLabelText('Setup key')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create administrator' })).not.toBeInTheDocument()
  })

  test('renders the guarded setup form when the installation is ready', async () => {
    vi.spyOn(setupApi, 'status').mockResolvedValue({
      available: true,
      configured: true,
      initialized: false,
    })

    render(
      <MemoryRouter initialEntries={['/setup']}>
        <I18nProvider>
          <SetupPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Setup key')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('School code')).toBeInTheDocument()
    expect(screen.getByLabelText('Administrator username')).toBeInTheDocument()
  })
})

