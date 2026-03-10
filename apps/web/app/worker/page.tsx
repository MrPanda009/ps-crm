"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import WorkerStatsCards from "@/components/worker-dashboard/WorkerStatsCards"
import CurrentTaskCard from "@/components/worker-dashboard/WorkerCurrentTaskCard"
import UrgentTaskCard from "@/components/worker-dashboard/UrgentTaskCard"
import AssignedTasksTable from "@/components/worker-dashboard/AssignedTasksTable"
import RecentActivityPanel from "@/components/worker-dashboard/RecentActivityPanel"
import { supabase } from "@/src/lib/supabase"
import {
  haversineKm,
  parseLatLng,
  severityWeight,
  type ActivityItem,
  type DashboardStats,
  type DashboardTask,
} from "@/components/worker-dashboard/dashboard-types"

const TaskMapWidget = dynamic(() => import("@/components/worker-dashboard/WorkerTaskMapWidget"), {
  ssr: false,
})

type ComplaintWithCategory = {
  id: string
  ticket_id: string
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
          "id, ticket_id, description, address_text, severity, status, created_at, resolved_at, location, photo_urls, photo_count, categories(name)",
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

    setTasks(normalizedTasks)

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
      fetchDashboardData()
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [fetchDashboardData])

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
  const assignedPreview = useMemo(() => sortedAssignedTasks.slice(0, 5), [sortedAssignedTasks])

  const updateTaskStatus = useCallback(
    async (complaintId: string, nextStatus: "in_progress" | "resolved", note?: string) => {
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

      fetchDashboardData()
    },
    [fetchDashboardData, tasks, workerId],
  )

  const handleStartTask = useCallback(
    async (complaintId: string) => {
      if (currentTask) {
        setError("Complete your current task first.")
        return
      }
      await updateTaskStatus(complaintId, "in_progress")
    },
    [currentTask, updateTaskStatus],
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

  return (
    <div className="space-y-6">
      <WorkerStatsCards stats={stats} error={error} />

      <CurrentTaskCard
        task={currentTask}
        loading={loading}
        error={error}
        onUpdateProgress={handleUpdateProgress}
        onMarkCompleted={handleCompleteTask}
      />

      <UrgentTaskCard task={urgentTask} loading={loading} error={error} onStartWork={handleStartTask} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AssignedTasksTable
            tasks={assignedPreview}
            loading={loading}
            error={error}
            hasCurrentTask={Boolean(currentTask)}
            onStartTask={handleStartTask}
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <TaskMapWidget
            tasks={tasks.filter((task) => task.status === "assigned" || task.status === "in_progress")}
            loading={loading}
            error={error}
          />

          <RecentActivityPanel items={activity} loading={loading} error={error} />
        </div>
      </div>
    </div>
  )
}