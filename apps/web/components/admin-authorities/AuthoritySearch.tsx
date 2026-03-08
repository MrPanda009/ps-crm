type AuthoritySearchProps = {
  value: string
  onChange: (value: string) => void
}

export default function AuthoritySearch({ value, onChange }: AuthoritySearchProps) {
  return (
    <label className="relative block w-full">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#7a7168]">Search</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search authority name, email, department"
        className="h-11 w-full rounded-xl border border-[#d7cebf] bg-white pl-20 pr-3 text-sm text-[#2d2722] outline-none transition focus:border-[#8e7b68]"
      />
    </label>
  )
}
