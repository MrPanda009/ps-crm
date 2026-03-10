// apps/web/app/authority/page.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/src/lib/supabase"
import {
  buildSixMonthBuckets,
  computeStats,
  getUrgentTickets,
  monthLabel,
  type AuthorityComplaintRow,
  type DashboardStats,
  type TrendPoint,
  type WorkerOption,
} from "./_components/dashboard-types"

import AuthorityStatsCards from "./_components/AuthorityStatsCards"
import AuthorityTrendChart from "./_components/AuthorityTrendChart"
import AuthorityStatusBreakdown from "./_components/AuthorityStatusBreakdown"
import AuthorityRecentTickets from "./_components/AuthorityRecentTickets"
import AuthorityUrgentTickets from "./_components/AuthorityUrgentTickets"

// Exact columns that exist on complaints table per database.types.ts
const COMPLAINT_SELECT =
  "id, ticket_id, title, status, effective_severity, sla_breached, sla_deadline, " +
  "escalation_level, created_at, resolved_at, address_text, assigned_worker_id, " +
  "upvote_count, categories(name)"

const TREND_SELECT = "status, created_at, resolved_at"

export default function AuthorityDashboardPage() {
  const [complaints, setComplaints] = useState<AuthorityComplaintRow[]>([])
  const [workers, setWorkers] = useState<WorkerOption[]>([])
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    total: 0, pendingAction: 0, inProgress: 0, resolvedThisMonth: 0, slaBreached: 0,
  })
  const [department, setDepartment] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) {
      setError("Not authenticated.")
      setLoading(false)
      return
    }

    // Get officer's department from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("department")
      .eq("id", uid)
      .maybeSingle()

    const dept = profile?.department ?? ""
    setDepartment(dept)

    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 5)
    cutoff.setDate(1)
    cutoff.setHours(0, 0, 0, 0)

    // Fetch complaints — try assigned_officer_id first, then assigned_department fallback
    let allRows: any[] = []
    let trendRows: any[] = []

    const [r1, r2] = await Promise.all([
      supabase
        .from("complaints")
        .select(COMPLAINT_SELECT)
        .eq("assigned_officer_id", uid)
        .neq("status", "rejected"),
      supabase
        .from("complaints")
        .select(TREND_SELECT)
        .eq("assigned_officer_id", uid)
        .gte("created_at", cutoff.toISOString()),
    ])

    allRows = r1.data ?? []
    trendRows = r2.data ?? []

    // Fallback: use assigned_department (the correct column name)
    if (allRows.length === 0 && dept) {
      const [r3, r4] = await Promise.all([
        supabase
          .from("complaints")
          .select(COMPLAINT_SELECT)
          .eq("assigned_department", dept)   // ← correct column
          .neq("status", "rejected"),
        supabase
          .from("complaints")
          .select(TREND_SELECT)
          .eq("assigned_department", dept)   // ← correct column
          .gte("created_at", cutoff.toISOString()),
      ])
      allRows = r3.data ?? []
      trendRows = r4.data ?? []

      if (r3.error) {
        setError("Failed to load complaints: " + r3.error.message)
        setLoading(false)
        return
      }
    }

    // Fetch workers in this department
    const { data: wRows } = await supabase
      .from("worker_profiles")
      .select("worker_id, availability, department, profiles(full_name)")
      .eq("department", dept)

    const mappedComplaints = allRows as unknown as AuthorityComplaintRow[]

    const mappedWorkers: WorkerOption[] = (wRows ?? []).map((w: any) => ({
      id: w.worker_id,
      full_name: w.profiles?.full_name ?? "Unknown",
      availability: w.availability,
      department: w.department ?? dept,
    }))

    // Build 6-month trend buckets
    const buckets = buildSixMonthBuckets()
      ; (trendRows ?? []).forEach((r: any) => {
        const mk = monthLabel(new Date(r.created_at))
        if (buckets[mk]) buckets[mk].submitted++
        if (r.status === "resolved" && r.resolved_at) {
          const rk = monthLabel(new Date(r.resolved_at))
          if (buckets[rk]) buckets[rk].resolved++
        }
      })
    const trendPoints: TrendPoint[] = Object.entries(buckets).map(
      ([month, v]) => ({ month, ...v })
    )

    setComplaints(mappedComplaints)
    setWorkers(mappedWorkers)
    setStats(computeStats(mappedComplaints))
    setTrend(trendPoints)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const ch = supabase
      .channel("authority-dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_profiles" }, () => void load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const urgentTickets = getUrgentTickets(complaints)

  return (
    <div className="space-y-4">
      <AuthorityStatsCards stats={stats} loading={loading} error={error} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AuthorityTrendChart trend={trend} department={department} loading={loading} />
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
        <AuthorityUrgentTickets
          tickets={urgentTickets}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  )
}
