import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { FormField } from './FormField.tsx'

describe('FormField', () => {
  test('associates the label with the child control', () => {
    render(<FormField label="Name">{props => <input {...props} />}</FormField>)
    expect(screen.getByLabelText('Name')).toBeVisible()
  })

  test('associates description and error through aria-describedby', () => {
    render(<FormField label="Name" description="Use the legal name" error="Name is required">
      {props => <input {...props} />}
    </FormField>)
    const input = screen.getByLabelText('Name')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    for (const id of describedBy?.split(' ') ?? []) expect(document.getElementById(id)).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required')
  })

  test('does not mark a valid field invalid', () => {
    render(<FormField label="Name">{props => <input {...props} />}</FormField>)
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'false')
  })
})
