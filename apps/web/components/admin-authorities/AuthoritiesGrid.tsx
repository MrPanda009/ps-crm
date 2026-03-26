import AuthorityCard from "@/components/admin-authorities/AuthorityCard"
import type { AuthorityRecord } from "@/components/admin-authorities/types"

type AuthoritiesGridProps = {
  authorities: AuthorityRecord[]
  onView: (authority: AuthorityRecord) => void
  onAssignDepartment: (authority: AuthorityRecord) => void
}

export default function AuthoritiesGrid({ authorities, onView, onAssignDepartment }: AuthoritiesGridProps) {
  if (authorities.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d6cdbf] bg-white p-8 text-center text-sm text-[#6a6056] dark:border-[#3a3a3a] dark:bg-[#1e1e1e] dark:text-gray-400">
        No authority profiles match the selected filters.
      </div>
    )
  }

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {authorities.map((authority) => (
        <AuthorityCard
          key={authority.id}
          authority={authority}
          onView={onView}
          onAssignDepartment={onAssignDepartment}
        />
      ))}
    </section>
  )
}
