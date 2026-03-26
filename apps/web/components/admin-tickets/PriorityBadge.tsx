import { formatPriorityLabel, severityToPriority } from "@/components/admin-tickets/formatters"
import type { SeverityLevel } from "@/components/admin-tickets/types"

type PriorityBadgeProps = {
  severity: SeverityLevel
}

const priorityStyles = {
  low: "bg-gray-100 text-gray-700 border-gray-200 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 border-orange-200 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-300",
  emergency: "bg-red-100 text-red-800 border-red-200 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300",
}

export default function PriorityBadge({ severity }: PriorityBadgeProps) {
  const priority = severityToPriority(severity)

  return (
    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-sm font-medium ${priorityStyles[priority]}`}>
      {formatPriorityLabel(priority)}
    </span>
  )
}
