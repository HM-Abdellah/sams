import { Button } from './Button.tsx'

interface PaginationProps {
  page: number
  pageCount: number
  previousLabel?: string
  nextLabel?: string
  onPageChange: (page: number) => void
}

export function Pagination({
  page,
  pageCount,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  onPageChange,
}: PaginationProps) {
  if (pageCount <= 1) return null

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
      <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {previousLabel}
      </Button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
        <Button
          key={pageNumber}
          type="button"
          variant={pageNumber === page ? 'primary' : 'ghost'}
          size="sm"
          aria-current={pageNumber === page ? 'page' : undefined}
          onClick={() => onPageChange(pageNumber)}
        >
          {pageNumber}
        </Button>
      ))}
      <Button type="button" variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        {nextLabel}
      </Button>
    </nav>
  )
}
