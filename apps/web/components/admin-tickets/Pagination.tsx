type PaginationProps = {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, totalCount, pageSize, onPageChange }: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  const pages = [
    1,
    Math.max(1, page - 1),
    page,
    Math.min(safeTotalPages, page + 1),
    safeTotalPages,
  ].filter((value, index, arr) => arr.indexOf(value) === index)

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="inline-flex items-center overflow-hidden rounded-lg border border-[#d7cfc3] bg-white text-[#2f2a25] dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:text-gray-200">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="border-r border-[#dfd6ca] px-3 py-2 text-sm transition hover:bg-[#f5f1ea] disabled:opacity-50 dark:border-[#2a2a2a] dark:hover:bg-[#2a2a2a]"
        >
          ← Previous
        </button>

        <span className="px-3 py-2 text-sm">Page</span>

        {pages.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => onPageChange(entry)}
            className={`min-w-9 border-l border-[#dfd6ca] px-3 py-2 text-sm transition dark:border-[#2a2a2a] ${entry === page ? "bg-[#5a4437] text-white dark:bg-[#C9A84C] dark:text-[#1a1a1a]" : "bg-white hover:bg-[#f5f1ea] dark:bg-[#1e1e1e] dark:hover:bg-[#2a2a2a]"}`}
          >
            {entry}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
          disabled={page >= safeTotalPages}
          className="border-l border-[#dfd6ca] px-3 py-2 text-sm transition hover:bg-[#f5f1ea] disabled:opacity-50 dark:border-[#2a2a2a] dark:hover:bg-[#2a2a2a]"
        >
          Next →
        </button>
      </div>

      <p className="text-sm font-medium text-[#3a332d] dark:text-gray-300">
        Showing {start}-{end} of {new Intl.NumberFormat("en-IN").format(totalCount)} tickets
      </p>
    </div>
  )
}
