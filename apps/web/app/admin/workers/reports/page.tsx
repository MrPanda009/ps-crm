"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts"
import { supabase } from "@/src/lib/supabase"
import {
  CheckCircle,
  Clock,
  TrendingUp,
  ChevronDown,
  Users,
  HardHat,
} from "lucide-react"
import type {
  AuthorityProfileRow,
  ComplaintAssignmentRow,
} from "@/components/admin-authorities/types"

type WorkerProfileRow = {
  worker_id: string
  department: string
  availability: string
  total_resolved: number
}

/* ─── colour palette ──────────────────────────────────────────────── */
const GOLD = "#C9A84C"
const GOLD_MUTED = "#9b7d34"
const RED = "#EF4444"
const DARK_CARD = "#1a1a1a"
const DARK_BORDER = "#2a2a2a"
const TEAL = "#14b8a6"

const activeStatuses = ["submitted", "under_review", "assigned", "in_progress", "escalated"] as const
const activeStatusSet = new Set(activeStatuses)

function isActiveStatus(status: ComplaintAssignmentRow["status"]): boolean {
  return activeStatusSet.has(status as (typeof activeStatuses)[number])
}

/* ─── helper: ISO week string eg "2025-W03" ──────────────────────── */
function isoWeek(dateStr: string): string {
  const d = new Date(dateStr)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)
  const weekNum = Math.ceil((dayOfYear + jan4.getDay()) / 7)
  return `W${weekNum}`
}

/* ─── small stat card ─────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  sub,
  icon,
  delta,
  color = GOLD,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  delta?: string
  color?: string
}) {
  const pos = delta?.startsWith("+")
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl p-5 min-w-0 bg-white border border-[#d8cfbe] shadow-sm dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:shadow-none"
    >
      <div className="flex items-start justify-between">
        <div style={{ color }} className="opacity-80">
          {icon}
        </div>
        <span className="text-gray-400 dark:text-gray-600 text-xs">···</span>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-bold text-[#27221d] dark:text-white">{value}</span>
          {delta && (
            <span className={`text-xs font-semibold ${pos ? "text-emerald-500 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`}>{delta}</span>
          )}
        </div>
        {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

/* ─── custom tooltip ──────────────────────────────────────────────── */
function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl p-3 text-xs shadow-xl bg-white border border-[#d8cfbe] dark:bg-[#222] dark:border-[#2a2a2a]">
      <p className="mb-2 font-semibold text-[#27221d] dark:text-gray-300">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600 dark:text-gray-400">{p.name}:</span>
          <span className="font-bold text-[#27221d] dark:text-white">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function WorkerReportsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [complaints, setComplaints] = useState<ComplaintAssignmentRow[]>([])
  const [profiles, setProfiles] = useState<AuthorityProfileRow[]>([])
  const [workerProfiles, setWorkerProfiles] = useState<WorkerProfileRow[]>([])
  
  const [selectedWorker, setSelectedWorker] = useState<string>("All Workers")
  const [workerDropdownOpen, setWorkerDropdownOpen] = useState(false)
  const [workerSearch, setWorkerSearch] = useState("")

  /* ─── fetch ───────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.access_token) {
      setError("You must be logged in as admin")
      setLoading(false)
      return
    }
    const response = await fetch("/api/admin/workers", {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    })
    const payload = (await response.json().catch(() => null)) as {
      error?: string
      profiles?: AuthorityProfileRow[]
      complaints?: (ComplaintAssignmentRow & { assigned_worker_id?: string | null })[]
      workerProfiles?: WorkerProfileRow[]
    } | null
    if (!response.ok || !payload) {
      setError(payload?.error || "Unable to load data")
      setLoading(false)
      return
    }
    
    // Map assigned_worker_id to assigned_officer_id for consistency in types if needed,
    // though the typing expects assigned_officer_id, the payload uses assigned_worker_id.
    const mappedComplaints = (payload.complaints || []).map(c => ({
      ...c,
      assigned_officer_id: c.assigned_worker_id || c.assigned_officer_id
    })) as ComplaintAssignmentRow[]

    setComplaints(mappedComplaints)
    if (payload.profiles) setProfiles(payload.profiles)
    if (payload.workerProfiles) setWorkerProfiles(payload.workerProfiles)
    
    setLoading(false)
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  /* ─── worker name mapper ──────────────────────────────────────── */
  const getWorkerName = useCallback((id: string) => {
    const p = profiles.find(p => p.id === id)
    return p?.full_name || p?.email || "Unknown"
  }, [profiles])

  /* ─── unique workers for dropdown ─────────────────────────────── */
  const allWorkers = useMemo(() => {
    const names = profiles.map(p => p.full_name || p.email).sort()
    return ["All Workers", ...names]
  }, [profiles])

  /* ─── top stat cards ──────────────────────────────────────────── */
  const statCards = useMemo(() => {
    const totalWorkers = profiles.length
    const availableWorkers = workerProfiles.filter(w => w.availability === "available").length
    
    // Count complaints assigned to any worker
    const assignedComplaints = complaints.filter(c => c.assigned_officer_id)
    const activeTickets = assignedComplaints.filter((c) => isActiveStatus(c.status)).length

    // Avg resolution time across assigned that have resolved_at
    const resolved = assignedComplaints.filter((c) => c.resolved_at)
    const avgDays = resolved.length
      ? resolved.reduce((sum, c) => {
          const ms = new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()
          return sum + ms / (86400000)
        }, 0) / resolved.length
      : 0

    return { totalWorkers, availableWorkers, activeTickets, avgDays }
  }, [complaints, profiles, workerProfiles])

  /* ─── weekly issues SOLVED line chart ────────────────────────── */
  const weeklyData = useMemo(() => {
    // filter by resolved and assigned to worker
    let filtered = complaints.filter((c) => c.resolved_at && c.assigned_officer_id)
    
    // Apply worker filter if selected
    if (selectedWorker !== "All Workers") {
      const workerProfile = profiles.find(p => (p.full_name || p.email) === selectedWorker)
      if (workerProfile) {
        filtered = filtered.filter(c => c.assigned_officer_id === workerProfile.id)
      }
    }

    // Last 8 weeks
    const now = new Date()
    const weeks: { label: string; start: Date; end: Date }[] = []
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now)
      end.setDate(now.getDate() - i * 7)
      const start = new Date(end)
      start.setDate(end.getDate() - 6)
      weeks.push({ label: isoWeek(end.toISOString()), start, end })
    }

    return weeks.map(({ label, start, end }) => {
      const solved = filtered.filter((c) => {
        const t = new Date(c.resolved_at!).getTime()
        return t >= start.getTime() && t <= end.getTime()
      }).length
      return { week: label, solved }
    })
  }, [complaints, selectedWorker, profiles])

  /* ─── bar chart: active load by worker (Top 10) ──────────────── */
  const workerLoadData = useMemo(() => {
    const counts: Record<string, { id: string; name: string; active: number; total: number }> = {}
    
    complaints.forEach((c) => {
      const wId = c.assigned_officer_id
      if (!wId) return
      
      if (!counts[wId]) {
        counts[wId] = { id: wId, name: getWorkerName(wId), active: 0, total: 0 }
      }
      
      counts[wId].total++
      if (isActiveStatus(c.status)) {
        counts[wId].active++
      }
    })
    
    // Sort by active workload high -> low, take top 10
    return Object.values(counts)
      .filter(w => w.active > 0)
      .sort((a, b) => b.active - a.active)
      .slice(0, 10)
  }, [complaints, getWorkerName])

  /* ─── resolution speed table ──────────────────────────────────── */
  const resolutionTable = useMemo(() => {
    const wMap: Record<string, { name: string; totalDays: number; count: number }> = {}
    
    complaints.filter((c) => c.resolved_at && c.assigned_officer_id).forEach((c) => {
      const id = c.assigned_officer_id!
      if (!wMap[id]) {
        wMap[id] = { name: getWorkerName(id), totalDays: 0, count: 0 }
      }
      const days = (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()) / 86400000
      if (days >= 0 && days < 3650) {
        wMap[id].totalDays += days
        wMap[id].count++
      }
    })
    
    return Object.values(wMap)
      .filter((a) => a.count > 0)
      .map((a) => ({ name: a.name, avgDays: a.totalDays / a.count, totalResolved: a.count }))
      .sort((a, b) => a.avgDays - b.avgDays)
      .slice(0, 8)
  }, [complaints, getWorkerName])

  const maxAvgDays = resolutionTable[resolutionTable.length - 1]?.avgDays || 1

  /* ─── render ──────────────────────────────────────────────────── */
  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 bg-[#f4efe5] dark:bg-[#111111]">

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: TEAL }}>Field Ops Analytics</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#27221d] dark:text-white">Worker Performance Module</h1>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-800" style={{ borderTopColor: TEAL }} />
        </div>
      ) : (
        <div className="space-y-6">

          {/* Stat cards row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Registered Workers"
              value={statCards.totalWorkers.toLocaleString()}
              sub="Field staff in system"
              icon={<Users size={22} />}
              color={TEAL}
            />
            <StatCard
              label="Available Workers"
              value={statCards.availableWorkers.toLocaleString()}
              sub="Currently active & ready"
              icon={<CheckCircle size={22} />}
              color="#10b981"
            />
            <StatCard
              label="Assigned Active Tickets"
              value={statCards.activeTickets.toLocaleString()}
              sub="Currently handled by field workers"
              icon={<HardHat size={22} />}
              color={RED}
            />
            <StatCard
              label="Avg Resolution Time"
              value={`${statCards.avgDays.toFixed(1)} Days`}
              sub="Across field resolutions"
              icon={<Clock size={22} />}
              color="#3b82f6"
            />
          </div>

          {/* Row 2: Weekly Solved + Worker load bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Weekly Issues Solved line chart */}
            <div className="rounded-2xl p-5 bg-white border border-[#d8cfbe] shadow-sm dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:shadow-none">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#27221d] dark:text-white">Weekly Issues Resolved (Field)</h2>
                  <p className="text-xs text-gray-500">Last 8 weeks of field resolutions</p>
                </div>
                {/* Worker dropdown with search */}
                <div className="relative">
                  <button
                    onClick={() => { setWorkerDropdownOpen((o) => !o); setWorkerSearch("") }}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-[#27221d] dark:text-white transition-colors bg-white border border-[#d8cfbe] dark:bg-[#252525] dark:border-[#2a2a2a]"
                  >
                    <span className="max-w-[120px] truncate">{selectedWorker}</span>
                    <ChevronDown size={12} className={`transition-transform ${workerDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {workerDropdownOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl shadow-2xl overflow-hidden bg-white border border-[#d8cfbe] dark:bg-[#1e1e1e] dark:border-[#2a2a2a]">
                      <div className="p-2 border-b border-[#d8cfbe] dark:border-[#2a2a2a]">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search worker…"
                          value={workerSearch}
                          onChange={(e) => setWorkerSearch(e.target.value)}
                          className="w-full rounded-lg px-3 py-1.5 text-xs text-[#27221d] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none bg-gray-50 border border-[#d8cfbe] dark:bg-[#252525] dark:border-[#2a2a2a]"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto py-1">
                        {allWorkers
                          .filter((w) => w.toLowerCase().includes(workerSearch.toLowerCase()))
                          .map((worker) => (
                            <button
                              key={worker}
                              onClick={() => { setSelectedWorker(worker); setWorkerDropdownOpen(false); setWorkerSearch("") }}
                              className={`w-full px-4 py-2 text-left text-xs transition-colors hover:bg-gray-50 dark:hover:bg-[#2a2a2a] dark:hover:text-white ${worker === selectedWorker ? 'text-[#14b8a6] bg-gray-50 dark:bg-[#252525]' : 'text-gray-600 dark:text-gray-400'}`}
                            >
                              {worker}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" strokeOpacity={0.3} />
                    <XAxis dataKey="week" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<DarkTooltip />} />
                    <ReferenceLine y={5} stroke={TEAL} strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: "Target", fill: TEAL, fontSize: 10, opacity: 0.6 }} />
                    <Line
                      type="monotone"
                      dataKey="solved"
                      name="Resolved Tickets"
                      stroke={TEAL}
                      strokeWidth={2.5}
                      dot={{ fill: TEAL, r: 4 }}
                      activeDot={{ r: 6, fill: TEAL }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top 10 Active Workloads (Bar) */}
            <div className="rounded-2xl p-5 bg-white border border-[#d8cfbe] shadow-sm dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:shadow-none">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-[#27221d] dark:text-white">Current Worker Load (Top 10)</h2>
                <p className="text-xs text-gray-500">Number of active assigned tickets per worker</p>
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workerLoadData} barSize={16} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" strokeOpacity={0.3} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 10 }} angle={-30} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<DarkTooltip />} />
                    <Bar dataKey="active" name="Active Tickets" fill={RED} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Average resolution speed table */}
          <div className="rounded-2xl p-5 bg-white border border-[#d8cfbe] shadow-sm dark:bg-[#1a1a1a] dark:border-[#2a2a2a] dark:shadow-none">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#27221d] dark:text-white">Average Resolution Speed</h2>
                <p className="text-xs text-gray-500">Days to resolve — rank sorted (fastest first)</p>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp size={14} style={{ color: TEAL }} />
                <span className="text-xs" style={{ color: TEAL }}>Top Field Workers</span>
              </div>
            </div>

            {resolutionTable.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No resolved ticket data available for workers yet.</p>
            ) : (
              <div className="space-y-3">
                {/* Table header */}
                <div className="grid grid-cols-[24px_1fr_160px_80px_80px] gap-4 px-1 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <span>#</span>
                  <span>Worker</span>
                  <span>Speed</span>
                  <span className="text-right">Resolved</span>
                  <span className="text-right">Days</span>
                </div>
                {/* Table rows */}
                {resolutionTable.map((row, i) => {
                  const pct = (row.avgDays / maxAvgDays) * 100
                  const isTop3 = i < 3
                  return (
                    <div
                      key={row.name}
                      className={`grid grid-cols-[24px_1fr_160px_80px_80px] items-center gap-4 rounded-xl px-3 py-2.5 text-sm transition-colors border ${
                        isTop3 
                          ? "bg-[#14b8a6]/10 border-[#14b8a6]/20 dark:bg-[#14b8a6]/5 dark:border-[#14b8a6]/15" 
                          : "bg-gray-50 border-[#d8cfbe] dark:bg-[#161616] dark:border-[#2a2a2a]"
                      }`}
                    >
                      <span className="font-semibold" style={{ color: isTop3 ? TEAL : "#6b7280" }}>{i + 1}</span>
                      <span className="font-medium text-[#27221d] dark:text-white truncate">{row.name}</span>
                      <div className="h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-[#252525]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: isTop3
                              ? `linear-gradient(90deg, ${TEAL}, #0f766e)`
                              : `linear-gradient(90deg, #3b82f6, #1d4ed8)`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-end">
                        <span className="text-xs text-gray-400">
                          {row.totalResolved}
                        </span>
                      </div>
                      <div className="flex items-center justify-end">
                        <span className="text-xs font-semibold" style={{ color: isTop3 ? TEAL : "#9ca3af" }}>
                          {row.avgDays.toFixed(1)}d
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
