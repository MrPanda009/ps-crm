// apps/web/app/authority/track/page.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { supabase } from "@/src/lib/supabase"
import { AssignDropdown, ComplaintDetailPanel } from "../_components/ComplaintDetailPanel"

const MapComponent = dynamic(() => import("@/app/MapComponent"), { ssr: false })

type Status = "submitted" | "under_review" | "assigned" | "in_progress" | "resolved" | "rejected" | "escalated"
type Sev = "L1" | "L2" | "L3" | "L4"

type Complaint = {
  id: string; ticket_id: string; title: string; status: Status
  effective_severity: Sev; sla_breached: boolean; sla_deadline: string | null
  escalation_level: number; created_at: string; resolved_at: string | null
  address_text: string | null; assigned_worker_id: string | null; upvote_count: number
  categories: { name: string } | null
}
type Worker = { id: string; full_name: string; availability: string; department: string }

const SEV_BADGE: Record<Sev, string> = {
  L1: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  L2: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  L3: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  L4: "bg-red-50 text-red-700 ring-1 ring-red-200",
}
const SEV_LABEL: Record<Sev, string> = { L1: "Low", L2: "Medium", L3: "High", L4: "Critical" }
const STATUS_LABEL: Record<Status, string> = {
  submitted: "Submitted", under_review: "Under Review", assigned: "Assigned",
  in_progress: "In Progress", resolved: "Resolved", rejected: "Rejected", escalated: "Escalated",
}
const ALL_STATUSES: Status[] = ["submitted", "under_review", "assigned", "in_progress", "resolved", "escalated"]

const COMPLAINT_SELECT =
  "id,ticket_id,title,status,effective_severity,sla_breached,sla_deadline," +
  "escalation_level,created_at,resolved_at,address_text,assigned_worker_id,upvote_count,categories(name)"

export default function TrackPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("latest")
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [isStatOpen, setIsStatOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Complaint | null>(null)
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
      .from("complaints")
      .select(COMPLAINT_SELECT)
      .eq("assigned_officer_id", uid)
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
    rows = (d1 ?? []) as unknown as Complaint[]

    if (rows.length === 0 && department) {
      const { data: d2, error: e2 } = await supabase
        .from("complaints")
        .select(COMPLAINT_SELECT)
        .eq("assigned_department", department)
        .neq("status", "rejected")
        .order("created_at", { ascending: false })
      if (e2) { setError(e2.message); setLoading(false); return }
      rows = (d2 ?? []) as unknown as Complaint[]
    }

    let workerRows: Worker[] = []
    if (department) {
      const { data: wRows } = await supabase
        .from("worker_profiles")
        .select("worker_id,availability,department,profiles(full_name)")
        .eq("department", department)
      workerRows = (wRows ?? []).map((w: any) => ({
        id: w.worker_id,
        full_name: (Array.isArray(w.profiles) ? w.profiles[0] : w.profiles)?.full_name ?? "Unknown",
        availability: w.availability ?? "available",
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
    const channel = supabase
      .channel("track-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => void fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Scroll to detail panel when it opens
  useEffect(() => {
    if (expandedId && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
    }
  }, [expandedId])

  const filtered = complaints
    .filter(c => {
      const q = search.toLowerCase()
      return (statusFilter === "all" || c.status === statusFilter) &&
        (c.title.toLowerCase().includes(q) ||
          c.ticket_id.toLowerCase().includes(q) ||
          (c.address_text ?? "").toLowerCase().includes(q) ||
          (c.categories?.name ?? "").toLowerCase().includes(q))
    })
    .sort((a, b) => {
      const d = +new Date(a.created_at) - +new Date(b.created_at)
      return sortBy === "latest" ? -d : d
    })

  const complaintIds = complaints.map(c => c.id)
  const expandedComplaint = expandedId ? complaints.find(c => c.id === expandedId) ?? null : null

  function exportCSV() {
    const rows = [
      ["Ticket", "Title", "Category", "Severity", "Status", "SLA", "Created"],
      ...filtered.map(c => [
        c.ticket_id, c.title, c.categories?.name ?? "",
        SEV_LABEL[c.effective_severity], STATUS_LABEL[c.status],
        c.sla_breached ? "Breached" : "OK",
        new Date(c.created_at).toLocaleDateString("en-IN"),
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const a = document.createElement("a"); a.href = url; a.download = "complaints.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">

      {/* SEVERITY LEGEND BANNER */}
      <div className="flex gap-5 text-sm font-medium text-gray-600 mb-3 px-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
          Low
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
          Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span>
          High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
          Critical
        </span>
      </div>

      {/* MAP CARD */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/80 px-5 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex gap-5 text-sm font-medium text-gray-600">
            {([["bg-green-500", "Low"], ["bg-amber-400", "Medium"], ["bg-orange-500", "High"], ["bg-red-500", "Critical"]] as [string, string][]).map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${c}`} />{l}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {!loading && <span className="text-xs text-gray-400">{complaintIds.length} on map</span>}
            <button className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors">Full Map</button>
          </div>
        </div>
        <div className="h-[400px] w-full">
          <MapComponent selectedComplaintId={selectedId} />
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="rounded-2xl bg-[#eef3f4] p-5 dark:bg-gray-900/50">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Complaints Overview</h2>
            <p className="text-xs text-gray-500">
              {loading ? "Loading…" : error ? error : `Showing ${filtered.length} of ${complaints.length}`}
            </p>
          </div>
          <button onClick={exportCSV}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            Export CSV
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search ticket, title, address…"
            className="flex-1 min-w-48 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b4725a]
                       dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
          <div className="relative">
            <button onClick={() => { setIsSortOpen(o => !o); setIsStatOpen(false) }}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {sortBy === "latest" ? "Latest first" : "Oldest first"} <span className="text-xs opacity-60">▼</span>
            </button>
            <div className={`absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl transition-all duration-200 dark:border-gray-700 dark:bg-gray-800 ${isSortOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
              {["latest", "oldest"].map(o => (
                <button key={o} onClick={() => { setSortBy(o); setIsSortOpen(false) }}
                  className={`block w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${sortBy === o ? "font-semibold text-[#b4725a]" : "text-gray-700 dark:text-gray-300"}`}>
                  {o === "latest" ? "Latest first" : "Oldest first"}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <button onClick={() => { setIsStatOpen(o => !o); setIsSortOpen(false) }}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {statusFilter === "all" ? "All statuses" : STATUS_LABEL[statusFilter as Status]} <span className="text-xs opacity-60">▼</span>
            </button>
            <div className={`absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl transition-all duration-200 dark:border-gray-700 dark:bg-gray-800 ${isStatOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
              <button onClick={() => { setStatusFilter("all"); setIsStatOpen(false) }}
                className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${statusFilter === "all" ? "font-semibold text-[#b4725a]" : "text-gray-700 dark:text-gray-300"}`}>
                All statuses
              </button>
              {ALL_STATUSES.map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setIsStatOpen(false) }}
                  className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${statusFilter === s ? "font-semibold text-[#b4725a]" : "text-gray-700 dark:text-gray-300"}`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-900">
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#5b3a2e] to-[#8b5e49] text-white">
                <tr>
                  {["Ticket", "Title", "Severity", "Status", "SLA", "Actions"].map(h => (
                    <th key={h} className="p-3 text-left text-xs font-semibold tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[80, 180, 70, 90, 55, 100].map((w, j) => (
                        <td key={j} className="p-3"><div className="h-3 rounded-md bg-gray-100 dark:bg-gray-800" style={{ width: w }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-sm text-gray-400">
                    {complaints.length === 0
                      ? "No complaints assigned to your department yet."
                      : "No complaints match your filters"}
                  </td></tr>
                ) : filtered.map(c => {
                  const canAssign = !c.assigned_worker_id && (c.status === "submitted" || c.status === "under_review")
                  const isSelected = selectedId === c.id
                  const isExpanded = expandedId === c.id
                  return (
                    <tr key={c.id}
                      onClick={() => setSelectedId(prev => prev === c.id ? null : c.id)}
                      className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 ${isSelected ? "bg-amber-50/70 dark:bg-amber-900/10" : ""}`}>
                      <td className="p-3 font-mono text-xs text-gray-400">{c.ticket_id}</td>
                      <td className="p-3 max-w-[220px]">
                        <p className="truncate font-medium text-gray-800 dark:text-gray-200">{c.title}</p>
                        {c.categories?.name && <p className="text-[10px] text-gray-400">{c.categories.name}</p>}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${SEV_BADGE[c.effective_severity]}`}>
                          {SEV_LABEL[c.effective_severity]}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td className="p-3">
                        {c.sla_breached
                          ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">Breached</span>
                          : <span className="text-[10px] text-gray-300">—</span>}
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setExpandedId(prev => prev === c.id ? null : c.id)}
                            className="text-xs font-semibold text-blue-600 hover:underline"
                          >
                            {isExpanded ? "Close" : "View"}
                          </button>
                          {canAssign && <AssignDropdown complaintId={c.id} workers={workers} onAssigned={fetchData} />}
                          <button onClick={() => setDetail(c)} className="text-xs font-semibold text-blue-600 hover:underline">View</button>
                          {canAssign && <AssignDropdown complaintId={c.id} workers={workers} onAssigned={fetchData} />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inline detail panel — replaces modal, renders below the table */}
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
