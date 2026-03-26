type AuthorityFiltersProps = {
  value: string
  options: string[]
  onChange: (value: string) => void
}

export default function AuthorityFilters({ value, options, onChange }: AuthorityFiltersProps) {
  return (
    <label className="flex w-full items-center gap-2 rounded-xl border border-[#d7cebf] bg-white px-3 dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
      <span className="text-sm font-medium text-[#4a433c] dark:text-gray-300">Department</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full bg-transparent text-sm text-[#2d2722] outline-none dark:text-gray-100"
      >
        <option value="all">All Departments</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
