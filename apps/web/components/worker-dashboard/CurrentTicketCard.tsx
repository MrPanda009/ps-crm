"use client";

import { MapPin, Building2, Navigation, NotebookPen, CheckCircle2 } from "lucide-react";
import type { DashboardTask } from "./dashboard-types";
import {
  formatTimestamp,
  getSeverityDotColor,
  statusClasses,
  formatStatus,
} from "../../lib/ticket-formatters";

interface CurrentTicketCardProps {
  ticket: DashboardTask;
  onNavigate: (latitude: number, longitude: number) => void;
  onUpdate: (ticketId: string) => void;
  onMarkCompleted: (ticketId: string) => void;
}

export default function CurrentTicketCard({
  ticket,
  onNavigate,
  onUpdate,
  onMarkCompleted,
}: CurrentTicketCardProps) {
  const canNavigate = ticket.latitude !== null && ticket.longitude !== null;
  const canComplete = ticket.status === "in_progress";

  return (
    <article className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out dark:bg-[#1e1e1e] dark:border-[#2a2a2a] dark:hover:border-[#3a3a3a]">
      <div className="p-5 space-y-2">
        {/* Header: Ticket ID with Severity Dot and Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${getSeverityDotColor(
                ticket.severity
              )}`}
            />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {ticket.ticketId}
            </span>
          </div>
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${statusClasses(
              ticket.status
            )}`}
          >
            {formatStatus(ticket.status)}
          </span>
        </div>

        {/* Issue Title - Primary Focus */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">
          {ticket.description}
        </h3>

        {/* Location - Secondary with Icon */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <MapPin size={14} className="flex-shrink-0" />
          <span className="line-clamp-1">{ticket.location}</span>
        </div>

        {/* Category/Department - Secondary with Icon */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <Building2 size={14} className="flex-shrink-0" />
          <span className="line-clamp-1">{ticket.category}</span>
        </div>

        {/* Timestamp - Bottom separator */}
        <div className="pt-2 mt-2 border-t border-gray-100 dark:border-[#2a2a2a]">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatTimestamp(ticket.createdAt)}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 px-5 pb-5 pt-0">
        <button
          type="button"
          onClick={() => {
            if (canNavigate) {
              onNavigate(ticket.latitude!, ticket.longitude!);
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600 transition-colors"
          disabled={!canNavigate}
          title={
            canNavigate
              ? "Open in Google Maps"
              : "Location not available"
          }
        >
          <Navigation size={16} />
          Navigate
        </button>

        <button
          type="button"
          onClick={() => onUpdate(ticket.id)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-[#3a3a3a] dark:text-gray-200 dark:hover:bg-[#2a2a2a] transition-colors"
          title="Add progress note"
        >
          <NotebookPen size={16} />
          Update
        </button>

        <button
          type="button"
          onClick={() => onMarkCompleted(ticket.id)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600 transition-colors"
          disabled={!canComplete}
          title={
            canComplete
              ? "Mark ticket completed"
              : "Ticket must be in progress to complete"
          }
        >
          <CheckCircle2 size={16} />
          Mark Completed
        </button>
      </div>
    </article>
  );
}
