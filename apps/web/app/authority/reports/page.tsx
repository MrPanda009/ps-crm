// apps/web/app/authority/reports/page.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/src/lib/supabase"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Download } from "lucide-react"

type Status = "submitted"|"under_review"|"assigned"|"in_progress"|"resolved"|"rejected"|"escalated"
type Sev    = "L1"|"L2"|"L3"|"L4"

type Complaint = {
  id: string; status: Status; effective_severity: Sev
  sla_breached: boolean; created_at: string; resolved_at: string|null
  categories: { name: string }|null
}

const SEV_COLORS: Record<Sev, string>    = { L1:"#60a5fa", L2:"#fbbf24", L3:"#f97316", L4:"#ef4444" }
const SEV_LABELS: Record<Sev, string>    = { L1:"Low", L2:"Medium", L3:"High", L4:"Critical" }
const STATUS_COLORS: Record<string, string> = {
  submitted:"#94a3b8", under_review:"#fbbf24", assigned:"#60a5fa",
  in_progress:"#818cf8", resolved:"#34d399", escalated:"#f43f5e",
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 font-semibold text-gray-800 dark:text-white">{title}</h2>
      {children}
    </div>
  )
}

const COMPLAINT_SELECT =
  "id,status,effective_severity,sla_breached,created_at,resolved_at,photo_urls,photo_count,categories(name)"

export default function ReportsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading,    setLoading]    = useState(true)
  const [dept,       setDept]       = useState("")
  const [range,      setRange]      = useState<"3m"|"6m"|"12m">("6m")

  const load = useCallback(async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return

    const { data: profile } = await supabase
      .from("profiles").select("department").eq("id", uid).maybeSingle()
    const department = profile?.department ?? ""
    setDept(department)

    const months = range === "3m" ? 3 : range === "6m" ? 6 : 12
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    cutoff.setDate(1); cutoff.setHours(0,0,0,0)

    // Try assigned_officer_id first
    let data: any[] = []
    const { data: d1 } = await supabase
      .from("complaints")
      .select(COMPLAINT_SELECT)
      .eq("assigned_officer_id", uid)
      .gte("created_at", cutoff.toISOString())
    data = d1 ?? []

    // Fallback: assigned_department (correct column)
    if (data.length === 0 && department) {
      const { data: d2 } = await supabase
        .from("complaints")
        .select(COMPLAINT_SELECT)
        .eq("assigned_department", department)   // ← fixed
        .gte("created_at", cutoff.toISOString())
      data = d2 ?? []
    }

    setComplaints(data as unknown as Complaint[])
    setLoading(false)
  }, [range])

  useEffect(() => { void load() }, [load])

  const total    = complaints.length
  const resolved = complaints.filter(c => c.status === "resolved").length
  const breached = complaints.filter(c => c.sla_breached).length
  const slaRate  = total > 0 ? Math.round(((total - breached) / total) * 100) : 0

  const months = range === "3m" ? 3 : range === "6m" ? 6 : 12
  const trendData = (() => {
    const buckets: Record<string, { month: string; filed: number; resolved: number }> = {}
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const k = d.toLocaleString("en-IN", { month: "short", year: "2-digit" })
      buckets[k] = { month: k, filed: 0, resolved: 0 }
    }
    complaints.forEach(c => {
      const mk = new Date(c.created_at).toLocaleString("en-IN", { month: "short", year: "2-digit" })
      if (buckets[mk]) buckets[mk].filed++
      if (c.status === "resolved" && c.resolved_at) {
        const rk = new Date(c.resolved_at).toLocaleString("en-IN", { month: "short", year: "2-digit" })
        if (buckets[rk]) buckets[rk].resolved++
      }
    })
    return Object.values(buckets)
  })()

  const sevData = (["L1","L2","L3","L4"] as Sev[]).map(s => ({
    name: SEV_LABELS[s],
    value: complaints.filter(c => c.effective_severity === s).length,
    color: SEV_COLORS[s],
  })).filter(d => d.value > 0)

  const catMap: Record<string, number> = {}
  complaints.forEach(c => {
    const k = c.categories?.name ?? "Uncategorised"
    catMap[k] = (catMap[k] ?? 0) + 1
  })
  const catData = Object.entries(catMap)
    .sort((a,b) => b[1] - a[1]).slice(0,8)
    .map(([name, value]) => ({ name, value }))

  const statusData = Object.entries(STATUS_COLORS)
    .map(([s, color]) => ({
      name: s.replace("_"," "),
      value: complaints.filter(c => c.status === s).length,
      color,
    })).filter(d => d.value > 0)

  function exportCSV() {
    const rows = [
      ["ID","Status","Severity","SLA Breached","Created","Resolved","Category"],
      ...complaints.map(c => [
        c.id, c.status, SEV_LABELS[c.effective_severity],
        c.sla_breached ? "Yes" : "No",
        new Date(c.created_at).toLocaleDateString("en-IN"),
        c.resolved_at ? new Date(c.resolved_at).toLocaleDateString("en-IN") : "—",
        c.categories?.name ?? "Uncategorised",
      ])
    ]
    const csv = rows.map(r => r.join(",")).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = `jansamadhan-report-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const Skeleton = () => <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-sm text-gray-400">{dept} · {total} complaints in period</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {(["3m","6m","12m"] as const).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-4 py-2 text-sm font-medium transition-colors
                  ${range === r ? "bg-[#b4725a] text-white" : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"}`}>
                {r === "3m" ? "3 months" : r === "6m" ? "6 months" : "1 year"}
              </button>
            ))}
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Filed",    value: total,        color: "text-gray-900 dark:text-white" },
          { label: "Resolved",       value: resolved,     color: "text-emerald-600" },
          { label: "SLA Compliance", value: `${slaRate}%`, color: slaRate >= 80 ? "text-emerald-600" : "text-red-500" },
          { label: "SLA Breached",   value: breached,     color: "text-red-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
            {loading
              ? <div className="mt-2 h-8 w-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
              : <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
            }
          </div>
        ))}
      </div>

      <Section title="Monthly Activity">
        {loading ? <Skeleton /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} margin={{ top:4, right:4, bottom:0, left:-20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize:11, fill:"#9ca3af" }} />
              <YAxis tick={{ fontSize:11, fill:"#9ca3af" }} />
              <Tooltip contentStyle={{ fontSize:12, borderRadius:10 }} />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="filed"    fill="#b4725a" radius={[4,4,0,0]} name="Filed" />
              <Bar dataKey="resolved" fill="#10b981" radius={[4,4,0,0]} name="Resolved" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Section title="Severity Distribution">
          {loading ? <Skeleton /> : sevData.length === 0 ? (
            <p className="text-sm text-gray-400">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sevData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={3}>
                  {sevData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v,n) => [`${v} complaints`, n]} contentStyle={{ fontSize:12, borderRadius:10 }} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Status Breakdown">
          {loading ? <Skeleton /> : statusData.length === 0 ? (
            <p className="text-sm text-gray-400">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={3}>
                  {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v,n) => [`${v}`, n]} contentStyle={{ fontSize:12, borderRadius:10 }} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      <Section title="Complaints by Category">
        {loading ? <Skeleton /> : catData.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={catData} layout="vertical" margin={{ top:4, right:20, bottom:0, left:80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize:11, fill:"#9ca3af" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:"#6b7280" }} width={80} />
              <Tooltip contentStyle={{ fontSize:12, borderRadius:10 }} />
              <Bar dataKey="value" fill="#b4725a" radius={[0,4,4,0]} name="Complaints" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>
    </div>
  )
}
