// apps/web/app/authority/workers/page.tsx
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/src/lib/supabase"
import { CheckCircle2, Circle, XCircle } from "lucide-react"

type Availability = "available" | "busy" | "inactive"

type Worker = {
  worker_id:         string
  availability:      Availability
  department:        string
  city:              string
  profiles:          { full_name: string; email: string } | null
  total_resolved:    number
  active_complaints: number
  joined_at:         string | null
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
      .select("worker_id,availability,department,city,total_resolved,current_complaint_id,joined_at,profiles(full_name,email)")

    if (department) query = query.eq("department", department)

    const { data: wRows, error: wErr } = await query

    if (wErr) { setError(wErr.message); setLoading(false); return }
    if (!wRows?.length) { setWorkers([]); setLoading(false); return }

    // Count currently active (non-resolved) assigned complaints per worker
    const ids = wRows.map((w: any) => w.worker_id)
    const { data: activeRows } = await supabase
      .from("complaints")
      .select("assigned_worker_id")
      .in("assigned_worker_id", ids)
      .not("status", "in", "(resolved,rejected)")

    const activeCounts: Record<string, number> = {}
    ids.forEach(id => { activeCounts[id] = 0 })
    ;(activeRows ?? []).forEach((r: any) => {
      if (activeCounts[r.assigned_worker_id] !== undefined) activeCounts[r.assigned_worker_id]++
    })

    setWorkers(
      wRows.map((w: any) => {
        const prof = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles
        return {
          worker_id:    w.worker_id,
          availability: (w.availability ?? "inactive") as Availability,
          department:   w.department ?? department,
          city:         w.city ?? "",
          profiles:     prof ?? null,
          total_resolved: w.total_resolved ?? 0,
          active_complaints: activeCounts[w.worker_id] ?? 0,
          joined_at:    w.joined_at ?? null,
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

      {/* Subtitle — h1 already shown in layout topbar breadcrumb */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {dept ? <span className="font-medium text-gray-600 dark:text-gray-300">{dept}</span> : null}
          {dept ? " · " : ""}{loading ? "Loading…" : `${workers.length} workers`}
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
                     dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:text-gray-200"
        />
        <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
          {(["all","available","busy","inactive"] as const).map(f => (
            <button key={f} onClick={() => setAvailFilter(f)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors
                ${availFilter===f ? "bg-[#b4725a] text-white" : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-[#2a2a2a]"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_,i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 dark:border-[#2a2a2a] dark:bg-[#161616]">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <div className="h-4 w-36 rounded-lg bg-gray-100 dark:bg-[#2a2a2a]"/>
                  <div className="h-3 w-24 rounded-lg bg-gray-100 dark:bg-[#2a2a2a]"/>
                </div>
                <div className="h-5 w-16 rounded-full bg-gray-100 dark:bg-[#2a2a2a]"/>
              </div>
              <div className="mt-4 h-14 rounded-xl bg-gray-50 dark:bg-[#1e1e1e]"/>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-red-200 text-sm text-red-400">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center dark:border-[#2a2a2a]">
          {workers.length === 0 ? (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No workers found</p>
              <p className="mt-1 text-xs text-gray-400">
                {dept
                  ? <>No worker profiles in the <span className="font-semibold">{dept}</span> department. Workers need a <code className="rounded bg-gray-100 px-1 dark:bg-[#1e1e1e]">worker_profiles</code> row with matching department.</>
                  : "Your profile has no department set — workers are filtered by department."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No workers match your search.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(w => {
            const av       = AVAIL[w.availability] ?? AVAIL.inactive
            const initials = (w.profiles?.full_name ?? "?")
              .split(" ").map((p:string) => p[0]).join("").slice(0,2).toUpperCase()

            return (
              <div key={w.worker_id}
                className="group rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:shadow-md dark:border-[#2a2a2a] dark:bg-[#161616]">

                {/* Header row */}
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold
                      ${w.availability === "available" ? "bg-emerald-50 text-emerald-700" : w.availability === "busy" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">
                        {w.profiles?.full_name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-gray-400">{w.city || w.profiles?.email || w.department}</p>
                    </div>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${av.pill}`}>
                    {av.icon} {av.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 divide-x divide-gray-100 rounded-xl bg-gray-50 py-3 text-center dark:divide-[#2a2a2a] dark:bg-[#1e1e1e]">
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{w.active_complaints}</p>
                    <p className="text-[10px] font-medium text-gray-400">Active</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">{w.total_resolved}</p>
                    <p className="text-[10px] font-medium text-gray-400">Resolved</p>
                  </div>
                </div>

                {/* Availability note */}
                {w.availability !== "available" && (
                  <p className="mt-3 text-[11px] text-center text-gray-400">
                    {w.availability === "busy" ? "⚠ Currently busy — cannot be assigned new tickets" : "Worker inactive"}
                  </p>
                )}
                {w.availability === "available" && (
                  <p className="mt-3 text-[11px] text-center text-emerald-600">
                    ✓ Available for assignment
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
