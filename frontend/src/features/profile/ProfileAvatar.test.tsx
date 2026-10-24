import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ProfileAvatar } from './ProfileAvatar.tsx'

describe('ProfileAvatar', () => {
  test('shows initials when the stored image cannot be loaded', () => {
    render(
      <ProfileAvatar
        name="Abdellah Hamdan"
        src="/api/v1/profile/avatar?v=old-file"
        imageClassName="avatar-image"
        fallbackClassName="avatar-fallback"
      />,
    )

    fireEvent.error(screen.getByRole('presentation'))

    expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
    expect(screen.getByText('AH')).toBeInTheDocument()
  })

  test('retries when a newly saved avatar has a new versioned URL', () => {
    const { rerender } = render(
      <ProfileAvatar name="Abdellah Hamdan" src="/api/v1/profile/avatar?v=old-file" />,
    )

    fireEvent.error(screen.getByRole('presentation'))
    expect(screen.getByText('AH')).toBeInTheDocument()

    rerender(
      <ProfileAvatar name="Abdellah Hamdan" src="/api/v1/profile/avatar?v=new-file" />,
    )

    expect(screen.getByRole('presentation')).toHaveAttribute('src', '/api/v1/profile/avatar?v=new-file')
  })
})
