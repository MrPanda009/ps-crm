"use client";

import { ThumbsUp, MapPin } from "lucide-react";
import type { MappedComplaint } from "./useNearbyTickets";
import { getSeverityConfig } from "./useNearbyTickets";

interface TicketCardProps {
  complaint: MappedComplaint;
  isSelected: boolean;
  hasUpvoted: Set<string>;
  onClick: () => void;
  onUpvote: (id: string) => void;
}

export default function TicketCard({
  complaint,
  isSelected,
  hasUpvoted,
  onClick,
  onUpvote,
}: TicketCardProps) {
  const sev = getSeverityConfig(complaint.effective_severity || complaint.severity);
  const upvoted = hasUpvoted.has(complaint.id);
  const photo = complaint.photo_urls?.[0];

  return (
    <div
      onClick={onClick}
      className="relative flex gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border
        bg-white dark:bg-[#1e1e1e] hover:bg-gray-50 dark:hover:bg-[#2a2a2a]"
      style={{
        borderColor: isSelected ? sev.color : "transparent",
        backgroundColor: isSelected ? sev.color + "0d" : undefined,
        boxShadow: isSelected ? `0 0 0 1.5px ${sev.color}44` : undefined,
      }}
    >
      {/* Photo or icon */}
      <div
        className="shrink-0 w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center"
        style={{ background: sev.color + "18" }}
      >
        {photo ? (
          <img src={photo} alt={complaint.title} className="w-full h-full object-cover" />
        ) : (
          <MapPin size={22} style={{ color: sev.color }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ background: sev.color + "22", color: sev.color }}
          >
            {sev.label}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
          {complaint.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {complaint.address_text || complaint.ward_name || "Location on map"}
        </p>
      </div>

      {/* Upvote */}
      <button
        onClick={(e) => { e.stopPropagation(); onUpvote(complaint.id); }}
        className={`shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition-all
          ${upvoted
            ? "bg-blue-500 text-white"
            : "bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400 hover:bg-blue-500/20 hover:text-blue-500"
          }`}
      >
        <ThumbsUp size={13} />
        <span className="text-[11px] font-bold">{complaint.upvote_count}</span>
      </button>
    </div>
  );
}
