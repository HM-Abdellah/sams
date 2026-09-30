import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { Button } from './Button.tsx'

describe('Button', () => {
  test('disables itself and exposes busy state while loading', () => {
    render(<Button loading>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  test('keeps normal buttons enabled when not loading', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  test('forwards native button attributes and click events', () => {
    const onClick = vi.fn()
    render(<Button type="submit" aria-label="Submit form" onClick={onClick}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Submit form' })
    expect(button).toHaveAttribute('type', 'submit')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
