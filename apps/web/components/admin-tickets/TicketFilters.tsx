import type { PriorityFilter, TicketFiltersState, TicketStatusFilter } from "@/components/admin-tickets/types"

type Option = {
  label: string
  value: string
}

type TicketFiltersProps = {
  filters: TicketFiltersState
  categoryOptions: Option[]
  authorityOptions: Option[]
  onChange: (next: TicketFiltersState) => void
}

const statusOptions: { label: string; value: TicketStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Escalated", value: "escalated" },
]

const priorityOptions: { label: string; value: PriorityFilter }[] = [
  { label: "All", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Emergency", value: "emergency" },
]

function FilterSelect({
  label,
  value,
  options,
  onSelect,
}: {
  label: string
  value: string
  options: Option[]
  onSelect: (value: string) => void
}) {
  return (
    <label className="rounded-xl border border-[#d4cdc2] bg-white px-3 py-2 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:shadow-none">
      <span className="mb-1 block text-sm font-semibold text-[#2d2824] dark:text-gray-100">{label}</span>
      <select
        value={value}
        onChange={(event) => onSelect(event.target.value)}
        className="w-full bg-transparent text-sm text-[#38322d] outline-none dark:text-gray-300"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function TicketFilters({ filters, categoryOptions, authorityOptions, onChange }: TicketFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <FilterSelect
        label="Status"
        value={filters.status}
        options={statusOptions}
        onSelect={(value) => onChange({ ...filters, status: value as TicketStatusFilter })}
      />
      <FilterSelect
        label="Category"
        value={filters.category}
        options={categoryOptions}
        onSelect={(value) => onChange({ ...filters, category: value })}
      />
      <FilterSelect
        label="Authority"
        value={filters.authority}
        options={authorityOptions}
        onSelect={(value) => onChange({ ...filters, authority: value })}
      />
      <FilterSelect
        label="Priority"
        value={filters.priority}
        options={priorityOptions}
        onSelect={(value) => onChange({ ...filters, priority: value as PriorityFilter })}
      />
    </div>
  )
}
