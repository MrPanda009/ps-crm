import { Check, Clock3, Tag, Users } from "lucide-react"
import type { AuthorityRecord } from "@/components/admin-authorities/types"

type AuthorityCardProps = {
  authority: AuthorityRecord
  onView: (authority: AuthorityRecord) => void
  onAssignDepartment: (authority: AuthorityRecord) => void
}

function getWorkloadMeta(level: AuthorityRecord["workload"]) {
  if (level === "overloaded") {
    return { dot: "bg-red-500", label: "Overloaded" }
  }
  if (level === "busy") {
    return { dot: "bg-amber-400", label: "Busy" }
  }
  return { dot: "bg-emerald-500", label: "Normal" }
}

function getInitials(name: string): string {
  const chunks = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
  return chunks.join("") || "AU"
}

export default function AuthorityCard({ authority, onView, onAssignDepartment }: AuthorityCardProps) {
  const workload = getWorkloadMeta(authority.workload)

  return (
    <article className="flex min-h-[360px] flex-col rounded-2xl border border-[#d4cabb] bg-white p-4 shadow-sm transition hover:shadow-md dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:shadow-none dark:hover:border-[#3a3a3a]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#d8cebf] bg-[#f4efe5] text-sm font-semibold text-[#3b332c] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-gray-200">
            {getInitials(authority.fullName)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-[#211c17] dark:text-gray-100">{authority.fullName}</h3>
            <p className="truncate text-xs text-[#6a6056] dark:text-gray-400">{authority.email}</p>
            <p className="truncate text-xs text-[#6a6056] dark:text-gray-400">ID: {authority.id.slice(0, 8)}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ded6ca] px-2.5 py-1 text-xs font-medium text-[#3f372f] dark:border-[#3a3a3a] dark:text-gray-300">
          <span className={`h-2 w-2 rounded-full ${workload.dot}`} />
          {workload.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#ded5c7] bg-[#f8f4ec] p-3 text-[#2c261f] dark:border-[#2a2a2a] dark:bg-[#161616] dark:text-gray-200">
        <div>
          <p className="text-xs text-[#756b61] dark:text-gray-400">People</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-semibold">
            <Users size={14} />
            {authority.workersCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#756b61] dark:text-gray-400">Ticket</p>
          <p className="mt-1 text-xl font-semibold">{authority.activeTickets}</p>
        </div>
        <div>
          <p className="text-xs text-[#756b61] dark:text-gray-400">Checkmark</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-semibold">
            <Check size={14} />
            {authority.resolvedToday}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#756b61] dark:text-gray-400">Resolution</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-semibold">
            <Clock3 size={14} />
            {authority.avgResolutionDays.toFixed(1)}d
          </p>
        </div>
      </div>

      <div className="mt-4 min-h-[76px]">
        <p className="mb-2 text-sm font-semibold text-[#2f2821] dark:text-gray-200">Category</p>
        <div className="flex flex-wrap gap-2">
          {(authority.categories.length > 0 ? authority.categories : ["Unmapped"]).slice(0, 4).map((category) => (
            <span
              key={`${authority.id}-${category}`}
              className="inline-flex items-center gap-1 rounded-full bg-[#1f3157] px-2.5 py-1 text-xs font-medium text-white dark:bg-[#C9A84C] dark:text-[#1a1a1a]"
            >
              <Tag size={12} />
              {category}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <button
          type="button"
          onClick={() => onView(authority)}
          className="rounded-lg border border-[#352e26] bg-[#f5f1ea] px-3 py-2 text-sm font-medium text-[#2a241e] transition hover:bg-white dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-gray-100 dark:hover:bg-[#3a3a3a]"
        >
          View Person
        </button>
        <button
          type="button"
          onClick={() => onAssignDepartment(authority)}
          className="rounded-lg border border-[#352e26] bg-[#f5f1ea] px-3 py-2 text-sm font-medium text-[#2a241e] transition hover:bg-white dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-gray-100 dark:hover:bg-[#3a3a3a]"
        >
          Assign Department
        </button>
      </div>
    </article>
  )
}
