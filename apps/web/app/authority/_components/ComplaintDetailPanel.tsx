// apps/web/app/authority/_components/ComplaintDetailPanel.tsx

"use client"

import React, { useState } from "react"
import { CheckCheck, ChevronDown, Loader2, MapPin, UserCheck, X } from "lucide-react"
import { supabase } from "@/src/lib/supabase"
import {
  SEVERITY_META,
  STATUS_META,
  timeAgo,
  type AuthorityComplaintRow,
  type WorkerOption,
} from "./dashboard-types"

// ─── Assign dropdown ──────────────────────────────────────────────────────────

export function AssignDropdown({
  complaintId,
  workers,
  onAssigned,
}: {
  complaintId: string
  workers: WorkerOption[]
  onAssigned: () => void
}) {
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [chosen, setChosen] = useState("")

  const available = workers.filter(w => w.availability === "available")

  async function handleAssign() {
    if (!chosen) return
    setSaving(true)
    await supabase
      .from("complaints")
      .update({ assigned_worker_id: chosen, status: "assigned" })
      .eq("id", complaintId)
    setSaving(false)
    setOpen(false)
    setChosen("")
    onAssigned()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-[#b4725a] hover:text-[#b4725a] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-[#b4725a] transition-colors"
      >
        <UserCheck size={12} />
        Assign
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-gray-100 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <div className="p-2 space-y-1 max-h-44 overflow-y-auto">
            {available.length === 0 ? (
              <p className="px-2 py-2 text-xs text-gray-400 text-center">No workers available</p>
            ) : available.map(w => (
              <label
                key={w.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition-colors ${
                  chosen === w.id ? "bg-[#b4725a]/10" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <input
                  type="radio"
                  name={`worker-${complaintId}`}
                  value={w.id}
                  checked={chosen === w.id}
                  onChange={() => setChosen(w.id)}
                  className="accent-[#b4725a]"
                />
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{w.full_name}</p>
                  <p className="text-[10px] text-gray-400">{w.department}</p>
                </div>
              </label>
            ))}
          </div>
          {available.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 p-2">
              <button
                onClick={handleAssign}
                disabled={!chosen || saving}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#4f392e] py-1.5 text-xs font-semibold text-white hover:bg-[#b4725a] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCheck size={11} />}
                {saving ? "Assigning…" : "Confirm Assign"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      {children}
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

export function ComplaintDetailPanel({
  complaint,
  workers,
  onClose,
  onAssigned,
  inline = false,
}: {
  complaint: AuthorityComplaintRow
  workers?: WorkerOption[]
  onClose: () => void
  onAssigned?: () => void
  /** When true, renders as an inline card instead of a fixed side panel */
  inline?: boolean
}) {
  const sev = SEVERITY_META[complaint.effective_severity]
  const st  = STATUS_META[complaint.status]

  const canAssign =
    !!workers?.length &&
    !complaint.assigned_worker_id &&
    (complaint.status === "submitted" || complaint.status === "under_review")

  // ── Shared inner content ──────────────────────────────────────────────────
  const header = (
    <div className={`flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800`}>
      <div className="flex-1 pr-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sev.badge}`}>
            {sev.label}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.badge}`}>
            {st.label}
          </span>
          {complaint.sla_breached && (
            <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600 dark:bg-red-900/30 dark:text-red-400">
              SLA Breached
            </span>
          )}
          {complaint.status === "escalated" && (
            <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              Escalated
            </span>
          )}
        </div>
        <h2 className="text-base font-semibold leading-snug text-gray-900 dark:text-white">
          {complaint.title}
        </h2>
      </div>
      <button
        onClick={onClose}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  )

  const body = (
    <div className={`${inline ? "" : "flex-1 overflow-y-auto"} px-6 py-5 space-y-5`}>
      <Field label="Ticket ID">
        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
          {complaint.ticket_id}
        </span>
      </Field>

      <Field label="Category">
        <span className="text-sm text-gray-800 dark:text-gray-200">
          {complaint.categories?.name ?? "—"}
        </span>
      </Field>

      {complaint.address_text && (
        <Field label="Location">
          <span className="flex items-start gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            <MapPin size={13} className="mt-0.5 flex-shrink-0 text-[#b4725a]" />
            {complaint.address_text}
          </span>
        </Field>
      )}

      <Field label="Reported">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {new Date(complaint.created_at).toLocaleDateString("en-IN", {
            day: "numeric", month: "long", year: "numeric",
          })}
          <span className="ml-1.5 text-xs text-gray-400">
            ({timeAgo(complaint.created_at)})
          </span>
        </span>
      </Field>

      <div className="grid grid-cols-2 gap-5">
        <Field label="Upvotes">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {complaint.upvote_count}
          </span>
        </Field>
        <Field label="Escalation">
          {complaint.escalation_level > 0 ? (
            <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              Level {complaint.escalation_level}
            </span>
          ) : (
            <span className="text-sm text-gray-400">None</span>
          )}
        </Field>
      </div>

      <Field label="Assigned Worker">
        {complaint.assigned_worker_id ? (
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            Assigned ✓
          </span>
        ) : (
          <span className="text-sm text-orange-500">Unassigned</span>
        )}
      </Field>

      {complaint.sla_deadline && (
        <Field label="SLA Deadline">
          <span className={`text-sm ${
            complaint.sla_breached
              ? "font-semibold text-red-600 dark:text-red-400"
              : "text-gray-700 dark:text-gray-300"
          }`}>
            {new Date(complaint.sla_deadline).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </span>
        </Field>
      )}
    </div>
  )

  const footer = (
    <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800 space-y-3">
      {canAssign && workers && onAssigned && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Assign a Worker
          </p>
          <AssignDropdown
            complaintId={complaint.id}
            workers={workers}
            onAssigned={() => { onAssigned(); onClose(); }}
          />
        </>
      )}
      <a
        href="/authority/track"
        className="flex w-full items-center justify-center rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900"
      >
        Open in Track Complaints →
      </a>
    </div>
  )

  // ── Inline card (used in track page) ─────────────────────────────────────
  if (inline) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        {header}
        {body}
        {footer}
      </div>
    )
  }

  // ── Fixed side panel (original behaviour for other pages) ─────────────────
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
        {header}
        {body}
        {footer}
      </div>
    </>
  )
}
