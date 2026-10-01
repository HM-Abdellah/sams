import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { Pagination } from './Pagination.tsx'

describe('Pagination', () => {
  test('renders a bounded page window with ellipses for large result sets', () => {
    render(<Pagination page={5} pageCount={20} onPageChange={() => undefined} />)

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByText('…')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument()
  })

  test('keeps previous and next navigation bounded at the edges', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} previousLabel="Previous" nextLabel="Next" />)

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  test('does not render when there is only one page', () => {
    render(<Pagination page={1} pageCount={1} onPageChange={() => undefined} />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
