// apps/web/app/authority/workers/page.tsx
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/src/lib/supabase"
import { CheckCircle2, Circle, XCircle } from "lucide-react"

type Availability = "available" | "busy" | "inactive"

type Worker = {
  worker_id:    string
  availability: Availability
  department:   string
  profiles:     { full_name: string; email: string } | null
  _assigned:    number
  _resolved:    number
}

const AVAIL: Record<Availability, { label: string; pill: string; icon: React.ReactNode }> = {
  available: { label:"Available", pill:"bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", icon:<CheckCircle2 size={11} className="text-emerald-500"/> },
  busy:      { label:"Busy",      pill:"bg-amber-50 text-amber-700 ring-1 ring-amber-200",      icon:<Circle      size={11} className="text-amber-400"/>   },
  inactive:  { label:"Inactive",  pill:"bg-gray-100 text-gray-500",                             icon:<XCircle     size={11} className="text-gray-400"/>    },
}

export default function WorkersPage() {
  const [workers,     setWorkers]     = useState<Worker[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string|null>(null)
  const [search,      setSearch]      = useState("")
  const [availFilter, setAvailFilter] = useState<"all"|Availability>("all")
  const [dept,        setDept]        = useState("")

  async function fetchWorkers() {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) { setError("Not logged in"); setLoading(false); return }

    const { data: profile } = await supabase
      .from("profiles").select("department").eq("id", uid).maybeSingle()
    const department = profile?.department ?? ""
    setDept(department)

    let query = supabase
      .from("worker_profiles")
      .select("worker_id,availability,department,profiles(full_name,email)")

    if (department) query = query.eq("department", department)

    const { data: wRows, error: wErr } = await query

    if (wErr) { setError(wErr.message); setLoading(false); return }
    if (!wRows?.length) { setWorkers([]); setLoading(false); return }

    const ids = wRows.map((w: any) => w.worker_id)

    const { data: assignedRows } = await supabase
      .from("complaints")
      .select("assigned_worker_id,status")
      .in("assigned_worker_id", ids)

    const counts: Record<string, { assigned:number; resolved:number }> = {}
    ids.forEach(id => { counts[id] = { assigned:0, resolved:0 } })
    ;(assignedRows ?? []).forEach((r: any) => {
      if (counts[r.assigned_worker_id]) {
        counts[r.assigned_worker_id].assigned++
        if (r.status === "resolved") counts[r.assigned_worker_id].resolved++
      }
    })

    setWorkers(
      wRows.map((w: any) => {
        const prof = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles
        return {
          worker_id:    w.worker_id,
          availability: (w.availability ?? "available") as Availability,
          department:   w.department ?? department,
          profiles:     prof ?? null,
          _assigned:    counts[w.worker_id]?.assigned  ?? 0,
          _resolved:    counts[w.worker_id]?.resolved  ?? 0,
        }
      })
    )
    setError(null)
    setLoading(false)
  }

  useEffect(() => { void fetchWorkers() }, [])

  useEffect(() => {
    const ch = supabase.channel("workers-realtime")
      .on("postgres_changes", { event:"*", schema:"public", table:"worker_profiles" }, () => void fetchWorkers())
      .on("postgres_changes", { event:"*", schema:"public", table:"complaints"      }, () => void fetchWorkers())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const filtered = workers.filter(w => {
    const q = search.toLowerCase()
    const matchSearch =
      (w.profiles?.full_name ?? "").toLowerCase().includes(q) ||
      (w.profiles?.email     ?? "").toLowerCase().includes(q) ||
      w.department.toLowerCase().includes(q)
    return (availFilter === "all" || w.availability === availFilter) && matchSearch
  })

  const available = workers.filter(w => w.availability === "available").length
  const busy      = workers.filter(w => w.availability === "busy").length
  const inactive  = workers.filter(w => w.availability === "inactive").length

  return (
    <div className="space-y-5">

      {/* Header — refresh button removed */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Workers</h1>
        <p className="text-sm text-gray-400">
          {dept ? `${dept} department · ` : ""}{workers.length} total
        </p>
      </div>

      {/* Summary pills */}
      {!loading && (
        <div className="flex flex-wrap gap-3">
          {[
            { label:"Available", count:available, color:"bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
            { label:"Busy",      count:busy,      color:"bg-amber-50 text-amber-700 ring-1 ring-amber-200"       },
            { label:"Inactive",  count:inactive,  color:"bg-gray-100 text-gray-500"                              },
          ].map(({ label, count, color }) => (
            <span key={label} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${color}`}>
              {count} {label}
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 min-w-52 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm
                     placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b4725a]
                     dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
        <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {(["all","available","busy","inactive"] as const).map(f => (
            <button key={f} onClick={() => setAvailFilter(f)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors
                ${availFilter===f ? "bg-[#b4725a] text-white" : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_,i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <div className="h-4 w-36 rounded-lg bg-gray-100 dark:bg-gray-800"/>
                  <div className="h-3 w-24 rounded-lg bg-gray-100 dark:bg-gray-800"/>
                </div>
                <div className="h-5 w-16 rounded-full bg-gray-100 dark:bg-gray-800"/>
              </div>
              <div className="mt-4 h-14 rounded-xl bg-gray-50 dark:bg-gray-800"/>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-red-200 text-sm text-red-400">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-700">
          {workers.length === 0 ? "No workers found for your department." : "No workers match your search."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(w => {
            const av      = AVAIL[w.availability] ?? AVAIL.inactive
            const rate    = w._assigned > 0 ? Math.round((w._resolved / w._assigned) * 100) : 0
            const initials = (w.profiles?.full_name ?? "?")
              .split(" ").map((p:string) => p[0]).join("").slice(0,2).toUpperCase()

            return (
              <div key={w.worker_id}
                className="group rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">

                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0e8e4] text-sm font-bold text-[#b4725a]">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">
                        {w.profiles?.full_name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-gray-400">{w.profiles?.email ?? w.department}</p>
                    </div>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${av.pill}`}>
                    {av.icon} {av.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 divide-x divide-gray-100 rounded-xl bg-gray-50 py-3 text-center dark:divide-gray-800 dark:bg-gray-800/60">
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{w._assigned}</p>
                    <p className="text-[10px] font-medium text-gray-400">Assigned</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">{w._resolved}</p>
                    <p className="text-[10px] font-medium text-gray-400">Resolved</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${rate>=70?"text-emerald-600":rate>=40?"text-amber-600":"text-red-500"}`}>{rate}%</p>
                    <p className="text-[10px] font-medium text-gray-400">Rate</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-700 ${rate>=70?"bg-emerald-400":rate>=40?"bg-amber-400":"bg-red-400"}`}
                      style={{ width:`${rate}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
