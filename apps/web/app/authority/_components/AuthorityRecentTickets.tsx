// apps/web/app/authority/_components/AuthorityRecentTickets.tsx
"use client"

import { useState } from "react"
import { Eye } from "lucide-react"
import {
  getSeverityConfig,
  isBreached,
  STATUS_META,
  timeAgo,
  type AuthorityComplaintRow,
  type WorkerOption,
} from "./dashboard-types"
import { AssignDropdown, ComplaintDetailPanel } from "./ComplaintDetailPanel"

function stageInfo(c: AuthorityComplaintRow, workers: WorkerOption[]): { label: string; color: string } {
  // Only show worker name if that worker is actually in our loaded workers array
  const workerName = c.assigned_worker_id
    ? workers.find(w => w.id === c.assigned_worker_id)?.full_name ?? null
    : null

  // A worker is "valid" only if their profile exists in DB
  const workerExistsInDb = !!workers.find(w => w.id === c.assigned_worker_id)

  switch (c.status) {
    case "submitted":
      return { label: "Awaiting Review", color: "text-slate-500 bg-slate-50 dark:bg-slate-800/50" }
    case "under_review":
      return { label: "Admin Reviewing", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" }
    case "assigned":
      return {
        label: workerExistsInDb
          ? (workerName ? `→ ${workerName}` : "Worker Assigned")
          : "Needs Assignment",
        color: workerExistsInDb
          ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
          : "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
      }
    case "in_progress":
      return {
        label: workerExistsInDb
          ? (workerName ? `${workerName} working` : "Work Underway")
          : "Work Underway",
        color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
      }
    case "resolved":
      return { label: "Resolved ✓", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" }
    case "escalated":
      return { label: "Escalated ⚠", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" }
    default:
      return { label: c.status, color: "text-gray-500 bg-gray-50" }
  }
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50 dark:border-gray-800/60 animate-pulse">
      {[200, 60, 80, 50, 120, 90].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 rounded bg-gray-100 dark:bg-gray-800" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

type Props = {
  complaints: AuthorityComplaintRow[]
  workers: WorkerOption[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export default function AuthorityRecentTickets({ complaints, workers, loading, error, onRefresh }: Props) {
  const [selected, setSelected] = useState<AuthorityComplaintRow | null>(null)

  const rows = complaints
    .filter(c => c.status !== "resolved" && c.status !== "rejected")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  const hasWorkers = workers.length > 0

  return (
    <>
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Recent Tickets</h2>
            {!loading && !hasWorkers && (
              <p className="mt-0.5 text-[10px] text-amber-500">
                No workers in DB for this department — assign buttons hidden
              </p>
            )}
          </div>
          <a href="/authority/track" className="text-xs font-semibold text-[#b4725a] hover:underline">
            View all →
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 dark:border-gray-800/60">
                {["Title / Location", "Severity", "Status", "Age", "Stage", "Actions"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : error ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-red-500">{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No active tickets</td></tr>
              ) : rows.map(c => {
                const sev         = getSeverityConfig(c.effective_severity)
                const st          = STATUS_META[c.status]
                const stage       = stageInfo(c, workers)
                const slaBreached = isBreached(c.sla_deadline, c.status)

                // ── Worker validity: must exist in loaded workers array ─────────
                // If assigned_worker_id has a stale/orphaned value (no matching
                // worker_profile in DB), treat as unassigned.
                const assignedWorkerProfile = c.assigned_worker_id
                  ? workers.find(w => w.id === c.assigned_worker_id) ?? null
                  : null
                const workerIsValid = !!assignedWorkerProfile

                // Show assign button: workers exist in DB + no valid worker + early status
                const canAssign =
                  hasWorkers &&
                  !workerIsValid &&
                  (c.status === "submitted" || c.status === "under_review")

                return (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/60 dark:hover:bg-gray-900/40 transition-colors">
                    {/* Title + category */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 shrink-0 rounded-full ${slaBreached ? "animate-pulse" : ""}`}
                          style={{ background: slaBreached ? "#ef4444" : sev.color }}
                        />
                        <div>
                          <p className="max-w-[190px] truncate font-medium text-gray-800 dark:text-gray-200">{c.title}</p>
                          <p className="max-w-[190px] truncate text-xs text-gray-400">
                            {c.categories?.name ?? "—"}{c.address_text ? ` · ${c.address_text}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Severity — inline style, exact match to citizen page */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: sev.color + "22", color: sev.color }}
                      >
                        {sev.shortLabel}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.badge}`}>
                        {st.label}
                      </span>
                    </td>

                    {/* Age */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">
                      {timeAgo(c.created_at)}
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex max-w-[140px] truncate rounded-lg px-2 py-1 text-[10px] font-semibold ${stage.color}`}>
                        {stage.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelected(c)}
                          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 transition-colors"
                        >
                          <Eye size={11} /> View
                        </button>

                        {/* Assign: only when workers in DB AND no valid worker assigned */}
                        {canAssign && (
                          <AssignDropdown complaintId={c.id} workers={workers} onAssigned={onRefresh} />
                        )}

                        {/* Green badge: only when worker profile is confirmed in DB */}
                        {workerIsValid && (
                          <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                            ✓ {assignedWorkerProfile!.full_name ?? "Assigned"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ComplaintDetailPanel
          complaint={selected}
          workers={workers}
          onClose={() => setSelected(null)}
          onAssigned={() => { onRefresh(); setSelected(null) }}
        />
      )}
    </>
  )
}
