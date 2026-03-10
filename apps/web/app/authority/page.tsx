// apps/web/app/authority/page.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/src/lib/supabase"
import {
  buildDayBuckets,
  buildSixMonthBuckets,
  computeStats,
  dayLabel,
  getUrgentTickets,
  isBreached,
  monthLabel,
  type AuthorityComplaintRow,
  type DashboardStats,
  type TrendPoint,
  type WorkerOption,
} from "./_components/dashboard-types"

import AuthorityStatsCards      from "./_components/AuthorityStatsCards"
import AuthorityTrendChart      from "./_components/AuthorityTrendChart"
import AuthorityStatusBreakdown from "./_components/AuthorityStatusBreakdown"
import AuthorityRecentTickets   from "./_components/AuthorityRecentTickets"
import AuthorityUrgentTickets   from "./_components/AuthorityUrgentTickets"

// sla_breached intentionally NOT fetched — stale in DB.
// isBreached(sla_deadline, status) is used everywhere instead.
const COMPLAINT_SELECT =
  "id, ticket_id, title, status, effective_severity, sla_deadline, " +
  "escalation_level, created_at, resolved_at, address_text, assigned_worker_id, " +
  "upvote_count, categories(name)"

// Trend rows: need status, created_at, resolved_at
const TREND_SELECT = "status, created_at, resolved_at"

export default function AuthorityDashboardPage() {
  const [complaints,  setComplaints]  = useState<AuthorityComplaintRow[]>([])
  const [workers,     setWorkers]     = useState<WorkerOption[]>([])
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([])   // active view data
  const [allTrend,    setAllTrend]    = useState<{                   // all pre-built buckets
    day:   TrendPoint[]
    week:  TrendPoint[]
    month: TrendPoint[]
  }>({ day: [], week: [], month: [] })
  const [stats,       setStats]       = useState<DashboardStats>({
    total: 0, pendingAction: 0, inProgress: 0, resolvedThisMonth: 0, slaBreached: 0,
  })
  const [department,  setDepartment]  = useState("")
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) { setError("Not authenticated."); setLoading(false); return }

    const { data: profile } = await supabase
      .from("profiles").select("department").eq("id", uid).maybeSingle()
    const dept = profile?.department ?? ""
    setDepartment(dept)

    // Date cutoffs
    const sixMonthCutoff = new Date()
    sixMonthCutoff.setMonth(sixMonthCutoff.getMonth() - 5)
    sixMonthCutoff.setDate(1); sixMonthCutoff.setHours(0, 0, 0, 0)

    const weekCutoff = new Date()
    weekCutoff.setDate(weekCutoff.getDate() - 6)
    weekCutoff.setHours(0, 0, 0, 0)

    const dayCutoff = new Date()
    dayCutoff.setHours(0, 0, 0, 0)

    let allRows:   any[] = []
    let trendRows: any[] = []

    // Try by assigned officer first
    const [r1, r2] = await Promise.all([
      supabase.from("complaints").select(COMPLAINT_SELECT)
        .eq("assigned_officer_id", uid).neq("status", "rejected"),
      supabase.from("complaints").select(TREND_SELECT)
        .eq("assigned_officer_id", uid).gte("created_at", sixMonthCutoff.toISOString()),
    ])
    allRows   = r1.data ?? []
    trendRows = r2.data ?? []

    // Fallback: fetch by department if officer has no direct assignments
    if (allRows.length === 0 && dept) {
      const [r3, r4] = await Promise.all([
        supabase.from("complaints").select(COMPLAINT_SELECT)
          .eq("assigned_department", dept).neq("status", "rejected"),
        supabase.from("complaints").select(TREND_SELECT)
          .eq("assigned_department", dept).gte("created_at", sixMonthCutoff.toISOString()),
      ])
      if (r3.error) { setError("Failed to load: " + r3.error.message); setLoading(false); return }
      allRows   = r3.data ?? []
      trendRows = r4.data ?? []
    }

    // Workers — only for this department, join profile name
    const { data: wRows } = dept
      ? await supabase.from("worker_profiles")
          .select("worker_id, availability, department, profiles(full_name)")
          .eq("department", dept)
      : { data: [] }

    const mappedComplaints = allRows as unknown as AuthorityComplaintRow[]

    const mappedWorkers: WorkerOption[] = (wRows ?? []).map((w: any) => ({
      id:           w.worker_id,
      full_name:    (Array.isArray(w.profiles) ? w.profiles[0] : w.profiles)?.full_name ?? "Unknown",
      availability: w.availability ?? "inactive",
      department:   w.department ?? dept,
    }))

    // ── Day trend (today, hour-by-hour for last 24h buckets) ──────────────────
    // We bucket by hour label for today, simplest: use "HH:00" style
    const hourBuckets: Record<string, Omit<TrendPoint, "label">> = {}
    for (let h = 0; h < 24; h++) {
      const lbl = `${String(h).padStart(2, "0")}:00`
      hourBuckets[lbl] = { submitted: 0, resolved: 0, in_progress: 0, assigned: 0 }
    }
    mappedComplaints.forEach(c => {
      const d = new Date(c.created_at)
      if (d >= dayCutoff) {
        const lbl = `${String(d.getHours()).padStart(2, "0")}:00`
        if (hourBuckets[lbl]) {
          hourBuckets[lbl].submitted++
          if (c.status === "assigned")    hourBuckets[lbl].assigned++
          if (c.status === "in_progress") hourBuckets[lbl].in_progress++
          if (c.status === "resolved")    hourBuckets[lbl].resolved++
        }
      }
    })
    const dayPoints: TrendPoint[] = Object.entries(hourBuckets).map(([label, v]) => ({ label, ...v }))

    // ── Week trend (last 7 days) ───────────────────────────────────────────────
    const dBuckets = buildDayBuckets(7)
    mappedComplaints.forEach(c => {
      const d = new Date(c.created_at)
      if (d >= weekCutoff) {
        const dk = dayLabel(d)
        if (dBuckets[dk]) {
          dBuckets[dk].submitted++
          if (c.status === "assigned")    dBuckets[dk].assigned++
          if (c.status === "in_progress") dBuckets[dk].in_progress++
          if (c.status === "resolved")    dBuckets[dk].resolved++
        }
      }
    })
    const weekPoints: TrendPoint[] = Object.entries(dBuckets).map(([label, v]) => ({ label, ...v }))

    // ── Month trend (6 months) ────────────────────────────────────────────────
    const mBuckets = buildSixMonthBuckets()
    ;(trendRows ?? []).forEach((r: any) => {
      const mk = monthLabel(new Date(r.created_at))
      if (mBuckets[mk]) {
        mBuckets[mk].submitted++
        if (r.status === "assigned")    mBuckets[mk].assigned++
        if (r.status === "in_progress") mBuckets[mk].in_progress++
        if (r.status === "resolved" && r.resolved_at) {
          const rk = monthLabel(new Date(r.resolved_at))
          if (mBuckets[rk]) mBuckets[rk].resolved++
        }
      }
    })
    const monthPoints: TrendPoint[] = Object.entries(mBuckets).map(([label, v]) => ({ label, ...v }))

    const built = { day: dayPoints, week: weekPoints, month: monthPoints }

    setComplaints(mappedComplaints)
    setWorkers(mappedWorkers)
    setStats(computeStats(mappedComplaints))
    setAllTrend(built)
    setTrendPoints(weekPoints)   // default view = week
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const ch = supabase
      .channel("authority-dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" },       () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_profiles" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "upvotes" },         () => void load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const urgentTickets = getUrgentTickets(complaints)

  return (
    <div className="space-y-4">
      <AuthorityStatsCards stats={stats} loading={loading} error={error} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AuthorityTrendChart
            allTrend={allTrend}
            department={department}
            loading={loading}
          />
        </div>
        <AuthorityStatusBreakdown complaints={complaints} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AuthorityRecentTickets
            complaints={complaints}
            workers={workers}
            loading={loading}
            error={error}
            onRefresh={load}
          />
        </div>
        <AuthorityUrgentTickets tickets={urgentTickets} loading={loading} error={error} />
      </div>
    </div>
  )
}
