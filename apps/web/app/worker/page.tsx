"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { AlertTriangle, CheckCircle2, ClipboardList, MapPinned } from "lucide-react"
import { supabase } from "@/src/lib/supabase"
import {
  formatDistance,
  formatSeverity,
  haversineKm,
  parseLatLng,
  relativeTime,
  severityClass,
  severityWeight,
  type ActivityItem,
  type DashboardStats,
  type DashboardTask,
} from "@/components/worker-dashboard/dashboard-types"
import CurrentTicketCard from "@/components/worker-dashboard/CurrentTicketCard"

const WorkerTaskMapPanel = dynamic(() => import("@/components/worker-dashboard/WorkerTaskMapPanel"), {
  ssr: false,
})

type ComplaintWithCategory = {
  id: string
  ticket_id: string
  assigned_worker_id: string | null
  description: string
  address_text: string | null
  severity: "L1" | "L2" | "L3" | "L4"
  status:
    | "submitted"
    | "under_review"
    | "assigned"
    | "in_progress"
    | "resolved"
    | "rejected"
    | "escalated"
  created_at: string
  resolved_at: string | null
  location: unknown
  categories: { name: string } | null
}

type ProfileAccessRow = {
  id: string
  email: string
  role: string
}

export default function WorkerDashboardPage() {
  const [workerId, setWorkerId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<DashboardTask[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false)
  const [completionNote, setCompletionNote] = useState("")

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.getUser()
    const currentWorkerId = authData.user?.id ?? null
    const currentUserEmail = authData.user?.email ?? null

    if (authError || !currentWorkerId || !currentUserEmail) {
      setLoading(false)
      setError("Unable to load worker context.")
      return
    }

    const { data: profileRow, error: profileAccessError } = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", currentWorkerId)
      .eq("email", currentUserEmail)
      .eq("role", "worker")
      .maybeSingle()

    if (profileAccessError || !profileRow) {
      setLoading(false)
      setError("Access denied. This dashboard is only available to users assigned as workers.")
      return
    }

    const workerProfileAccess = profileRow as ProfileAccessRow
    if (workerProfileAccess.email !== currentUserEmail || workerProfileAccess.role !== "worker") {
      setLoading(false)
      setError("Access denied. This dashboard is only available to users assigned as workers.")
      return
    }

    setWorkerId(currentWorkerId)

    const [{ data: workerProfile, error: profileError }, { data: complaintRows, error: complaintError }] = await Promise.all([
      supabase
        .from("worker_profiles")
        .select("last_location")
        .eq("worker_id", currentWorkerId)
        .maybeSingle(),
      supabase
        .from("complaints")
        .select(
          "id, ticket_id, assigned_worker_id, description, address_text, severity, status, created_at, resolved_at, location, categories(name)",
        )
        .eq("assigned_worker_id", currentWorkerId)
        .in("status", ["assigned", "in_progress", "resolved"]),
    ])

    if (profileError || complaintError) {
      setError("Failed to load worker dashboard data.")
      setLoading(false)
      return
    }

    const workerLocation = parseLatLng(workerProfile?.last_location)
    const normalizedTasks = (complaintRows ?? []).map((row) => {
      const complaint = row as unknown as ComplaintWithCategory
      const complaintLocation = parseLatLng(complaint.location)
      const distanceKm =
        workerLocation && complaintLocation ? haversineKm(workerLocation, complaintLocation) : null

      return {
        id: complaint.id,
        ticketId: complaint.ticket_id || complaint.id,
        assignedWorkerId: complaint.assigned_worker_id,
        description: complaint.description,
        category: complaint.categories?.name ?? "Uncategorized",
        location: complaint.address_text ?? "Unknown location",
        severity: complaint.severity,
        status: complaint.status,
        createdAt: complaint.created_at,
        resolvedAt: complaint.resolved_at,
        latitude: complaintLocation?.lat ?? null,
        longitude: complaintLocation?.lng ?? null,
        distanceKm,
      } satisfies DashboardTask
    })

    setTasks(normalizedTasks.filter((task) => task.assignedWorkerId === currentWorkerId))

    const { data: ticketRows, error: ticketError } = await supabase
      .from("ticket_history")
      .select("id, complaint_id, old_status, new_status, note, created_at")
      .eq("changed_by", currentWorkerId)
      .order("created_at", { ascending: false })
      .limit(5)

    if (ticketError) {
      setError("Activity feed failed to refresh.")
    }

    const activityItems = (ticketRows ?? []).map((row) => {
      let text = `Updated Complaint #${row.complaint_id}`
      if (row.new_status === "in_progress") text = `Started work on Complaint #${row.complaint_id}`
      if (row.new_status === "resolved") text = `Completed Complaint #${row.complaint_id}`
      if (row.note && row.new_status !== "in_progress" && row.new_status !== "resolved") {
        text = `Updated progress on Complaint #${row.complaint_id}`
      }

      return {
        id: row.id,
        text,
        createdAt: row.created_at,
      } satisfies ActivityItem
    })

    setActivity(activityItems)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchDashboardData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchDashboardData])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchDashboardData()
      }
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [fetchDashboardData])

  // ── Realtime sync: listen for external changes ──────────────────────────────
  useEffect(() => {
    if (!workerId) return

    const channel = supabase
      .channel(`worker-dashboard-rt-${workerId}`)
      // Authority assigns/reassigns/updates a ticket assigned to this worker
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints", filter: `assigned_worker_id=eq.${workerId}` },
        () => void fetchDashboardData(),
      )
      // Catch tickets being reassigned AWAY from this worker (old row had our id, new row doesn't)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "complaints" },
        (payload) => {
          const old = payload.old as { assigned_worker_id?: string }
          if (old.assigned_worker_id === workerId) {
            void fetchDashboardData()
          }
        },
      )
      // Admin changes worker profile (department, availability, block)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_profiles", filter: `worker_id=eq.${workerId}` },
        () => void fetchDashboardData(),
      )
      // Activity feed: new ticket_history entry by this worker
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_history", filter: `changed_by=eq.${workerId}` },
        () => void fetchDashboardData(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workerId, fetchDashboardData])

  const sortedAssignedTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status === "assigned")
      .sort((a, b) => {
        if (severityWeight[b.severity] !== severityWeight[a.severity]) {
          return severityWeight[b.severity] - severityWeight[a.severity]
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })
  }, [tasks])

  const stats = useMemo(() => {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

    return {
      tasksToday: tasks.filter((task) => new Date(task.createdAt).getTime() >= startOfDay).length,
      pending: tasks.filter((task) => task.status === "assigned").length,
      completedToday: tasks.filter(
        (task) => task.status === "resolved" && task.resolvedAt && new Date(task.resolvedAt).getTime() >= startOfDay,
      ).length,
      urgent: tasks.filter((task) => task.status !== "resolved" && (task.severity === "L3" || task.severity === "L4")).length,
    } satisfies DashboardStats
  }, [tasks])

  const currentTask = useMemo(() => tasks.find((task) => task.status === "in_progress") ?? null, [tasks])
  const urgentTask = useMemo(() => (sortedAssignedTasks.length > 0 ? sortedAssignedTasks[0] : null), [sortedAssignedTasks])

  const updateTaskStatus = useCallback(
    async (complaintId: string, nextStatus: "in_progress" | "resolved" | "escalated", note?: string) => {
      if (!workerId) return

      const task = tasks.find((item) => item.id === complaintId)
      if (!task) return

      const { error: updateError } = await supabase
        .from("complaints")
        .update({
          status: nextStatus,
          resolved_at: nextStatus === "resolved" ? new Date().toISOString() : null,
        })
        .eq("id", complaintId)

      if (updateError) {
        setError(`Failed to update status for complaint ${task.ticketId}.`)
        return
      }

      const { error: historyError } = await supabase.from("ticket_history").insert({
        changed_by: workerId,
        complaint_id: complaintId,
        old_status: task.status,
        new_status: nextStatus,
        note: note ?? null,
        is_internal: false,
      })

      if (historyError) {
        setError("Task updated, but activity log write failed.")
      }

      if (nextStatus === "in_progress") {
        await supabase
          .from("worker_profiles")
          .update({ current_complaint_id: complaintId, availability: "busy" })
          .eq("worker_id", workerId)
      }

      if (nextStatus === "resolved") {
        await supabase
          .from("worker_profiles")
          .update({ current_complaint_id: null, availability: "available" })
          .eq("worker_id", workerId)
      }

      if (nextStatus === "escalated") {
        await supabase
          .from("worker_profiles")
          .update({ current_complaint_id: null, availability: "available" })
          .eq("worker_id", workerId)
      }

      fetchDashboardData()
    },
    [fetchDashboardData, tasks, workerId],
  )

  const handleCompleteTask = useCallback(
    async (complaintId: string) => {
      await updateTaskStatus(complaintId, "resolved", "Completed from worker dashboard")
    },
    [updateTaskStatus],
  )

  const handleUpdateProgress = useCallback(
    async (complaintId: string, note: string) => {
      if (!workerId) return
      const task = tasks.find((item) => item.id === complaintId)
      if (!task) return

      const { error: historyError } = await supabase.from("ticket_history").insert({
        changed_by: workerId,
        complaint_id: complaintId,
        old_status: task.status,
        new_status: task.status,
        note,
        is_internal: false,
      })

      if (historyError) {
        setError(`Failed to add progress note for complaint ${task.ticketId}.`)
        return
      }

      fetchDashboardData()
    },
    [fetchDashboardData, tasks, workerId],
  )

  const mapTasks = useMemo(
    () => tasks.filter((task) => !workerId || task.assignedWorkerId === workerId),
    [tasks, workerId],
  )

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null),
    [selectedTaskId, tasks],
  )

  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
  }, [])

  const displayTask = useMemo(() => {
    return selectedTask
  }, [selectedTask])

  const statsCards = useMemo(
    () => [
      {
        title: "Tasks Today",
        value: stats.tasksToday,
        icon: ClipboardList,
        tone: "bg-white border-gray-200 dark:bg-[#1e1e1e] dark:border-[#2a2a2a]",
      },
      {
        title: "Pending",
        value: stats.pending,
        icon: MapPinned,
        tone: "bg-white border-gray-200 dark:bg-[#1e1e1e] dark:border-[#2a2a2a]",
      },
      {
        title: "Completed Today",
        value: stats.completedToday,
        icon: CheckCircle2,
        tone: "bg-white border-gray-200 dark:bg-[#1e1e1e] dark:border-[#2a2a2a]",
      },
      {
        title: "Urgent",
        value: stats.urgent,
        icon: AlertTriangle,
        tone: "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20",
      },
    ],
    [stats.completedToday, stats.pending, stats.tasksToday, stats.urgent],
  )

  async function handleConfirmComplete() {
    if (!displayTask) return
    await handleCompleteTask(displayTask.id)
    setIsCompletionModalOpen(false)
    setCompletionNote("")
  }

  return (
    <div className="flex min-h-full flex-col gap-3 overflow-visible lg:gap-4">
      {error ? (
        <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <section className="shrink-0 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {statsCards.map((card) => {
          const Icon = card.icon
          return (
            <article key={card.title} className={`rounded-xl border p-3 shadow-sm sm:p-5 ${card.tone}`}>
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-[#2a2a2a] dark:text-gray-200 sm:h-11 sm:w-11">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 sm:text-sm">{card.title}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl">{card.value}</p>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="min-h-0 space-y-4 overflow-visible xl:col-span-3 xl:pr-1">
          <WorkerTaskMapPanel
            tasks={mapTasks}
            loading={loading}
            error={error}
            highlightedTaskId={selectedTask?.id ?? null}
            onSelectTask={handleSelectTask}
          />
        </div>

        {displayTask ? (
          <aside className="min-h-0 overflow-visible xl:col-span-1 xl:pr-1">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ticket Details</h2>
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(null)}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-[#3a3a3a] dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
                >
                  Close
                </button>
              </div>

              <CurrentTicketCard
                ticket={displayTask}
                onNavigate={(latitude, longitude) => {
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }}
                onUpdate={async (ticketId, note) => {
                  await handleUpdateProgress(ticketId, note)
                }}
                onStatusChange={async (ticketId, newStatus) => {
                  await updateTaskStatus(ticketId, newStatus as "in_progress" | "resolved" | "escalated")
                }}
                onMarkCompleted={(_ticketId) => setIsCompletionModalOpen(true)}
              />
            </section>
          </aside>
        ) : null}
      </section>

      {isCompletionModalOpen && displayTask ? (
        <div className="fixed inset-0 z-[2200] flex items-center justify-center p-3 sm:p-4">
          <button
            type="button"
            aria-label="Close completion window"
            className="absolute inset-0 bg-gray-950/40 backdrop-blur-[1px]"
            onClick={() => setIsCompletionModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-lg sm:p-5 dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Complete Ticket</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Ticket {displayTask.ticketId} will be marked completed. Photo upload is reserved for the next phase.
            </p>

            <label className="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">Proof image (future flow)</label>
            <input
              type="file"
              className="mt-2 block w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-700 dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-gray-200"
            />

            <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">Completion note (optional)</label>
            <textarea
              value={completionNote}
              onChange={(event) => setCompletionNote(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-700 dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-gray-200"
              placeholder="Add a short note for closure"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCompletionModalOpen(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-[#3a3a3a] dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmComplete}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Confirm Complete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
