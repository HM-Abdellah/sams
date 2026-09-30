import { Button } from './Button.tsx'

interface PaginationProps {
  page: number
  pageCount: number
  previousLabel?: string
  nextLabel?: string
  ariaLabel?: string
  siblingCount?: number
  onPageChange: (page: number) => void
}

type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end'

function getPageItems(page: number, pageCount: number, siblingCount: number): PaginationItem[] {
  if (pageCount <= 1) return []

  const normalizedPage = Math.min(Math.max(page, 1), pageCount)
  const numericWindow = siblingCount * 2 + 3
  if (pageCount <= numericWindow + 2) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const start = Math.max(2, normalizedPage - siblingCount)
  const end = Math.min(pageCount - 1, normalizedPage + siblingCount)
  const items: PaginationItem[] = [1]

  if (start > 2) items.push('ellipsis-start')
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) items.push(pageNumber)
  if (end < pageCount - 1) items.push('ellipsis-end')

  items.push(pageCount)
  return items
}

export function Pagination({
  page,
  pageCount,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  ariaLabel = 'Pagination',
  siblingCount = 1,
  onPageChange,
}: PaginationProps) {
  if (pageCount <= 1) return null

  const currentPage = Math.min(Math.max(page, 1), pageCount)
  const pageItems = getPageItems(currentPage, pageCount, Math.max(0, siblingCount))

  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        {previousLabel}
      </Button>
      {pageItems.map((item) => {
        if (typeof item !== 'number') {
          return (
            <span key={item} aria-hidden="true" className="flex min-h-9 items-center px-2 text-sm text-[var(--sams-muted)]">
              …
            </span>
          )
        }

        return (
          <Button
            key={item}
            type="button"
            variant={item === currentPage ? 'primary' : 'ghost'}
            size="sm"
            aria-current={item === currentPage ? 'page' : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        )
      })}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={currentPage >= pageCount}
        onClick={() => onPageChange(currentPage + 1)}
      >
        {nextLabel}
      </Button>
    </nav>
  )
}
