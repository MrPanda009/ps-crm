type TicketSearchProps = {
  value: string
  onChange: (value: string) => void
}

export default function TicketSearch({ value, onChange }: TicketSearchProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search for specific tickets..."
      className="w-full rounded-xl border border-[#d4cdc2] bg-white px-4 py-3 text-base text-[#2f2a26] shadow-sm outline-none ring-[#b98b75] transition focus:ring-2 dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:text-gray-100 dark:placeholder:text-gray-500 dark:shadow-none"
    />
  )
}
