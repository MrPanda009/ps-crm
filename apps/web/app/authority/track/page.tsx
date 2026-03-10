// apps/web/app/authority/track/page.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { supabase } from "@/src/lib/supabase"
import { AssignDropdown, ComplaintDetailPanel } from "../_components/ComplaintDetailPanel"
import { getSeverityConfig } from "../_components/dashboard-types"

const MapComponent = dynamic(() => import("@/app/MapComponent"), { ssr: false })

type Status = "submitted" | "under_review" | "assigned" | "in_progress" | "resolved" | "rejected" | "escalated"
type Sev = string  // accept any string — getSeverityConfig handles normalisation

type Complaint = {
  id: string; ticket_id: string; title: string; status: Status
  effective_severity: Sev; sla_deadline: string | null
  escalation_level: number; created_at: string; resolved_at: string | null
  address_text: string | null; assigned_worker_id: string | null; upvote_count: number
  categories: { name: string } | null
}
type Worker = { id: string; full_name: string; availability: string; department: string }

const SEV_RANK: Record<string, number> = {
  L4: 4, L3: 3, L2: 2, L1: 1,
  critical: 4, high: 3, medium: 2, low: 1,
}

const STATUS_META: Record<Status, { label: string; badge: string }> = {
  submitted: { label: "Submitted", badge: "bg-gray-100 text-gray-600 ring-1 ring-gray-200" },
  under_review: { label: "Under Review", badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  assigned: { label: "Assigned", badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
  in_progress: { label: "In Progress", badge: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" },
  resolved: { label: "Resolved", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  rejected: { label: "Rejected", badge: "bg-red-50 text-red-600 ring-1 ring-red-200" },
  escalated: { label: "Escalated", badge: "bg-purple-50 text-purple-700 ring-1 ring-purple-200" },
}

const TERMINAL_STATUSES: Status[] = ["resolved", "rejected"]
const ALL_STATUSES: Status[] = ["submitted", "under_review", "assigned", "in_progress", "resolved", "escalated"]
// Severity options shown in filter dropdown
const SEV_FILTER_OPTIONS = [
  { key: "L4", label: "Critical" },
  { key: "L3", label: "High" },
  { key: "L2", label: "Medium" },
  { key: "L1", label: "Low" },
]

const COMPLAINT_SELECT =
  "id,ticket_id,title,status,effective_severity,sla_breached,sla_deadline," +
  "escalation_level,created_at,resolved_at,address_text,assigned_worker_id,upvote_count,photo_urls,photo_count,categories(name)"

function slaStatus(deadline: string | null, status: Status): { breached: boolean; text: string; pill: string } {
  if (!deadline) return { breached: false, text: "—", pill: "text-gray-300" }
  if (status === "resolved" || status === "rejected") {
    return { breached: false, text: "Met", pill: "bg-emerald-50 text-emerald-600" }
  }
  const diff = new Date(deadline).getTime() - Date.now()
  const hours = diff / 3_600_000
  const days = Math.ceil(diff / 86_400_000)
  if (diff < 0) {
    const overH = Math.round(Math.abs(hours))
    return { breached: true, text: overH < 24 ? `${overH}h overdue` : `${Math.ceil(Math.abs(hours) / 24)}d overdue`, pill: "bg-red-100 text-red-600 font-bold" }
  }
  if (hours < 4) return { breached: false, text: `${Math.ceil(hours)}h left`, pill: "bg-orange-100 text-orange-600 font-bold" }
  if (days === 0) return { breached: false, text: "Due today", pill: "bg-orange-100 text-orange-600 font-bold" }
  if (days <= 2) return { breached: false, text: `${days}d left`, pill: "bg-amber-50 text-amber-600" }
  return { breached: false, text: `${days}d left`, pill: "bg-gray-100 text-gray-500" }
}

/** Normalise DB severity to L-code for filter matching */
function normaliseSev(v: string): string {
  if (!v) return ""
  const map: Record<string, string> = {
    low: "L1", medium: "L2", med: "L2", high: "L3", critical: "L4", crit: "L4",
    l1: "L1", l2: "L2", l3: "L3", l4: "L4",
  }
  return map[v.toLowerCase().trim()] ?? v
}

export default function TrackPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sevFilter, setSevFilter] = useState("all")
  const [sortBy, setSortBy] = useState("latest")
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [isStatOpen, setIsStatOpen] = useState(false)
  const [isSevOpen, setIsSevOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  async function fetchData() {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) { setError("Not logged in"); setLoading(false); return }

    const { data: profile } = await supabase
      .from("profiles").select("department").eq("id", uid).maybeSingle()
    const department = profile?.department ?? ""

    let rows: Complaint[] = []
    const { data: d1 } = await supabase
      .from("complaints").select(COMPLAINT_SELECT)
      .eq("assigned_officer_id", uid).neq("status", "rejected")
      .order("created_at", { ascending: false })
    rows = (d1 ?? []) as unknown as Complaint[]

    if (rows.length === 0 && department) {
      const { data: d2, error: e2 } = await supabase
        .from("complaints").select(COMPLAINT_SELECT)
        .eq("assigned_department", department).neq("status", "rejected")
        .order("created_at", { ascending: false })
      if (e2) { setError(e2.message); setLoading(false); return }
      rows = (d2 ?? []) as unknown as Complaint[]
    }

    // Load workers for this department — these are the ONLY valid workers
    let workerRows: Worker[] = []
    if (department) {
      const { data: wRows } = await supabase
        .from("worker_profiles")
        .select("worker_id,availability,department,profiles(full_name)")
        .eq("department", department)
      workerRows = (wRows ?? []).map((w: any) => ({
        id: w.worker_id,
        full_name: (Array.isArray(w.profiles) ? w.profiles[0] : w.profiles)?.full_name ?? "Unknown",
        availability: w.availability ?? "inactive",
        department: w.department ?? department,
      }))
    }

    setComplaints(rows)
    setWorkers(workerRows)
    setError(null)
    setLoading(false)
  }

  useEffect(() => { void fetchData() }, [])
  useEffect(() => {
    const ch = supabase.channel("track-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => void fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "upvotes" }, () => void fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_profiles" }, () => void fetchData())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    if (expandedId && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
    }
  }, [expandedId])

  const hasWorkers = workers.length > 0

  const filtered = complaints
    .filter(c => {
      const q = search.toLowerCase()
      const matchSearch =
        c.title.toLowerCase().includes(q) ||
        c.ticket_id.toLowerCase().includes(q) ||
        (c.address_text ?? "").toLowerCase().includes(q) ||
        (c.categories?.name ?? "").toLowerCase().includes(q)
      const matchStatus = statusFilter === "all" || c.status === statusFilter
      // Severity filter: normalise DB value before comparing
      const matchSev = sevFilter === "all" || normaliseSev(c.effective_severity) === sevFilter
      return matchSearch && matchStatus && matchSev
    })
    .sort((a, b) => {
      if (sortBy === "latest") return +new Date(b.created_at) - +new Date(a.created_at)
      if (sortBy === "oldest") return +new Date(a.created_at) - +new Date(b.created_at)
      if (sortBy === "severity") {
        const ra = SEV_RANK[a.effective_severity] ?? SEV_RANK[(a.effective_severity ?? "").toLowerCase()] ?? 0
        const rb = SEV_RANK[b.effective_severity] ?? SEV_RANK[(b.effective_severity ?? "").toLowerCase()] ?? 0
        return rb - ra
      }
      if (sortBy === "upvotes") return (b.upvote_count ?? 0) - (a.upvote_count ?? 0)
      if (sortBy === "sla") {
        const aLeft = a.sla_deadline ? new Date(a.sla_deadline).getTime() - Date.now() : Infinity
        const bLeft = b.sla_deadline ? new Date(b.sla_deadline).getTime() - Date.now() : Infinity
        return aLeft - bLeft
      }
      return 0
    })

  const expandedComplaint = expandedId ? complaints.find(c => c.id === expandedId) ?? null : null
  const breachedCount = complaints.filter(c =>
    c.sla_deadline && new Date(c.sla_deadline) < new Date() &&
    c.status !== "resolved" && c.status !== "rejected"
  ).length
  const openCount = complaints.filter(c => !TERMINAL_STATUSES.includes(c.status)).length

  function exportCSV() {
    const rows = [
      ["Ticket", "Title", "Category", "Severity", "Status", "Upvotes", "SLA", "Created"],
      ...filtered.map(c => {
        const sev = getSeverityConfig(c.effective_severity)
        const sla = slaStatus(c.sla_deadline, c.status)
        return [
          c.ticket_id, c.title, c.categories?.name ?? "",
          sev.label,
          STATUS_META[c.status]?.label ?? c.status,
          c.upvote_count ?? 0,
          sla.breached ? `BREACHED (${sla.text})` : sla.text,
          new Date(c.created_at).toLocaleDateString("en-IN"),
        ]
      })
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = "complaints.csv"; a.click()
  }

  return (
    <div className="space-y-5">

      {/* MAP */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/80 px-5 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex gap-5 text-sm font-medium text-gray-600">
            {(["L1", "L2", "L3", "L4"] as const).map(key => {
              const s = getSeverityConfig(key)
              return (
                <span key={key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
              )
            })}
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <>
                <span className="text-xs text-gray-400">{openCount} open</span>
                {breachedCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">
                    {breachedCount} SLA breached
                  </span>
                )}
              </>
            )}
            <button className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
              Full Map
            </button>
          </div>
        </div>
        <div className="h-[400px] w-full">
          <MapComponent selectedComplaintId={selectedId} />
        </div>
      </div>

      {/* TABLE */}
      <div className="rounded-2xl bg-[#eef3f4] p-5 dark:bg-gray-900/50">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Complaints Overview</h2>
            <p className="text-xs text-gray-500">
              {loading ? "Loading…" : error ? error : `Showing ${filtered.length} of ${complaints.length}`}
              {!loading && !hasWorkers && (
                <span className="ml-2 text-amber-500">· No workers in this department</span>
              )}
            </p>
          </div>
          <button onClick={exportCSV}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search ticket, title, address…"
            className="flex-1 min-w-48 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b4725a] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />

          {/* Sort */}
          <div className="relative">
            <button onClick={() => { setIsSortOpen(o => !o); setIsStatOpen(false); setIsSevOpen(false) }}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {{ latest: "Latest", oldest: "Oldest", severity: "Severity", upvotes: "Most Upvoted", sla: "Urgent SLA" }[sortBy] ?? "Sort"}
              <span className="text-xs opacity-60">▼</span>
            </button>
            <div className={`absolute left-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 transition-all duration-200 ${isSortOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
              {[["latest", "Latest first"], ["oldest", "Oldest first"], ["severity", "By severity"], ["upvotes", "Most upvoted"], ["sla", "Urgent SLA first"]].map(([v, l]) => (
                <button key={v} onClick={() => { setSortBy(v); setIsSortOpen(false) }}
                  className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${sortBy === v ? "font-semibold text-[#b4725a]" : "text-gray-700 dark:text-gray-300"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Severity filter */}
          <div className="relative">
            <button onClick={() => { setIsSevOpen(o => !o); setIsStatOpen(false); setIsSortOpen(false) }}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {sevFilter === "all" ? "All severity" : getSeverityConfig(sevFilter).label}
              <span className="text-xs opacity-60">▼</span>
            </button>
            <div className={`absolute left-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 transition-all duration-200 ${isSevOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
              <button onClick={() => { setSevFilter("all"); setIsSevOpen(false) }}
                className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${sevFilter === "all" ? "font-semibold text-[#b4725a]" : "text-gray-700 dark:text-gray-300"}`}>
                All severity
              </button>
              {SEV_FILTER_OPTIONS.map(({ key }) => {
                const sc = getSeverityConfig(key)
                return (
                  <button key={key} onClick={() => { setSevFilter(key); setIsSevOpen(false) }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: sc.color }} />
                    <span style={{ color: sevFilter === key ? sc.color : undefined, fontWeight: sevFilter === key ? 600 : undefined }}>
                      {sc.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Status */}
          <div className="relative">
            <button onClick={() => { setIsStatOpen(o => !o); setIsSortOpen(false); setIsSevOpen(false) }}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {statusFilter === "all" ? "All statuses" : STATUS_META[statusFilter as Status].label}
              <span className="text-xs opacity-60">▼</span>
            </button>
            <div className={`absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 transition-all duration-200 ${isStatOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
              {[["all", "All statuses"], ...ALL_STATUSES.map(s => [s, STATUS_META[s].label])].map(([v, l]) => (
                <button key={v} onClick={() => { setStatusFilter(v); setIsStatOpen(false) }}
                  className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${statusFilter === v ? "font-semibold text-[#b4725a]" : "text-gray-700 dark:text-gray-300"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-900">
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#5b3a2e] to-[#8b5e49] text-white">
                <tr>
                  {["Ticket", "Title", "Severity", "Status", "Upvotes", "SLA", "Worker", "View"].map(h => (
                    <th key={h} className="p-3 text-left text-xs font-semibold tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[80, 180, 70, 90, 45, 90, 100, 70].map((w, j) => (
                        <td key={j} className="p-3"><div className="h-3 rounded-md bg-gray-100 dark:bg-gray-800" style={{ width: w }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-sm text-gray-400">
                    {complaints.length === 0 ? "No complaints assigned to your department yet." : "No complaints match your filters."}
                  </td></tr>
                ) : filtered.map(c => {
                  const sev = getSeverityConfig(c.effective_severity)
                  const st = STATUS_META[c.status]
                  const sla = slaStatus(c.sla_deadline, c.status)
                  const isExpanded = expandedId === c.id
                  const isSelected = selectedId === c.id

                  const assignedWorkerProfile = c.assigned_worker_id
                    ? workers.find(w => w.id === c.assigned_worker_id) ?? null
                    : null
                  const workerIsValid = !!assignedWorkerProfile
                  const isTerminal = TERMINAL_STATUSES.includes(c.status)

                  return (
                    <tr key={c.id}
                      onClick={() => setSelectedId(prev => prev === c.id ? null : c.id)}
                      className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 ${isSelected ? "bg-amber-50/70 dark:bg-amber-900/10" : ""}`}>

                      <td className="p-3 font-mono text-xs text-gray-400 whitespace-nowrap">{c.ticket_id}</td>

                      <td className="p-3 max-w-[200px]">
                        <p className="truncate font-medium text-gray-800 dark:text-gray-200">{c.title}</p>
                        {c.categories?.name && <p className="text-[10px] text-gray-400">{c.categories.name}</p>}
                      </td>

                      {/* Severity — inline style, reads actual DB value */}
                      <td className="p-3">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className="w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                            style={{ background: sev.color + "22", color: sev.color }}
                          >
                            {sev.label}
                          </span>
                          {c.escalation_level > 0 && c.status !== "escalated" && (
                            <span className="w-fit rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-bold text-purple-600 ring-1 ring-purple-200">
                              Esc.
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${st.badge}`}>
                          {st.label}
                        </span>
                      </td>

                      <td className="p-3 text-xs">
                        {(c.upvote_count ?? 0) > 0
                          ? <span className="font-semibold text-[#b4725a]">▲ {c.upvote_count}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>

                      <td className="p-3">
                        {!c.sla_deadline
                          ? <span className="text-[10px] text-gray-300">—</span>
                          : <span className={`rounded-full px-2 py-0.5 text-[10px] ${sla.pill}`}>{sla.text}</span>}
                      </td>

                      {/* Worker column — always show dropdown for active tickets */}
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        {isTerminal ? (
                          workerIsValid
                            ? <span className="text-[11px] text-gray-500">{assignedWorkerProfile!.full_name}</span>
                            : <span className="text-[11px] text-gray-300">—</span>
                        ) : (
                          <AssignDropdown
                            complaintId={c.id}
                            workers={workers}
                            currentWorkerId={workerIsValid ? c.assigned_worker_id : null}
                            compact
                            onAssigned={fetchData}
                          />
                        )}
                      </td>

                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setExpandedId(prev => prev === c.id ? null : c.id)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${isExpanded ? "bg-[#b4725a] text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-[#b4725a] hover:text-[#b4725a] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"}`}>
                          {isExpanded ? "Close" : "View"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {expandedComplaint && (
          <div ref={detailRef} className="mt-4">
            <ComplaintDetailPanel
              complaint={expandedComplaint as any}
              workers={workers}
              onClose={() => setExpandedId(null)}
              onAssigned={() => { void fetchData(); setExpandedId(null) }}
              inline
            />
          </div>
        )}
      </div>
    </div>
  )
}
