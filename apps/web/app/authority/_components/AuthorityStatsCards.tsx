// apps/web/app/authority/_components/AuthorityStatsCards.tsx
"use client"

import {
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  TrendingUp,
} from "lucide-react"
import type { DashboardStats } from "./dashboard-types"

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-950 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 w-14 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-2 w-20 rounded bg-gray-100 dark:bg-gray-900" />
        </div>
        <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  )
}

type StatCardProps = {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  iconClass: string
}

function StatCard({ icon: Icon, label, value, sub, iconClass }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

type Props = { stats: DashboardStats; loading: boolean; error: string | null }

export default function AuthorityStatsCards({ stats, loading, error }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard
        icon={FileText}
        label="Total Assigned"
        value={stats.total}
        sub="All time"
        iconClass="bg-[#4f392e]/10 text-[#4f392e] dark:bg-[#b4725a]/20 dark:text-[#b4725a]"
      />
      <StatCard
        icon={Clock}
        label="Pending Action"
        value={stats.pendingAction}
        sub="Needs review"
        iconClass="bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400"
      />
      <StatCard
        icon={TrendingUp}
        label="In Progress"
        value={stats.inProgress}
        sub="Assigned / Active"
        iconClass="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
      />
      <StatCard
        icon={CheckCircle2}
        label="Resolved (Month)"
        value={stats.resolvedThisMonth}
        sub="This month"
        iconClass="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
      />
      <StatCard
        icon={ShieldAlert}
        label="SLA Breached"
        value={stats.slaBreached}
        sub="Open & overdue"
        iconClass={
          stats.slaBreached > 0
            ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            : "bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
        }
      />
    </div>
  )
}
