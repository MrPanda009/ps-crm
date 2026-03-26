type TicketsHeaderProps = {
  now: Date
}

export default function TicketsHeader({ now }: TicketsHeaderProps) {
  const dateText = now.toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <h1 className="text-2xl font-semibold tracking-tight text-[#1e1a17] dark:text-gray-100">
        JanSamadhan Tickets | Central Workspace
      </h1>
      <div className="text-right text-base font-medium leading-tight text-[#2d2925] dark:text-gray-300">
        <p>{dateText}</p>
        <p>Jaipur, India</p>
      </div>
    </header>
  )
}
