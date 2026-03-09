"use client";

import { useEffect, useState } from "react";
import { MapPin, Building2 } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import type { Database } from "@/src/types/database.types";

type ComplaintRow = Database["public"]["Tables"]["complaints"]["Row"];

// Helper function to format status text (in_progress → In Progress)
function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Severity dot color mapping (L4=red, L3=yellow, L2=blue, L1=gray)
function getSeverityDotColor(severity: string): string {
  const normalized = severity.trim().toUpperCase();
  if (normalized === "L4") return "bg-red-500";
  if (normalized === "L3") return "bg-yellow-500";
  if (normalized === "L2") return "bg-blue-500";
  if (normalized === "L1") return "bg-gray-400";
  return "bg-gray-300";
}

// Format timestamp to relative time or date
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  // For older dates, show formatted date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

// Status badge color mapping (light mode only)
function statusClasses(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "submitted") {
    return "bg-amber-100 text-amber-700";
  }
  if (normalized === "assigned") {
    return "bg-blue-100 text-blue-700";
  }
  if (normalized === "in_progress") {
    return "bg-purple-100 text-purple-700";
  }
  if (normalized === "under_review") {
    return "bg-purple-100 text-purple-700";
  }
  if (normalized === "resolved") {
    return "bg-green-100 text-green-700";
  }
  return "bg-gray-100 text-gray-600";
}

interface TicketCardProps {
  ticket: ComplaintRow;
}

function TicketCard({ ticket }: TicketCardProps) {
  return (
    <article className="flex flex-col p-5 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-gray-300 transition-all duration-200 ease-out cursor-pointer dark:bg-[#1e1e1e] dark:border-[#2a2a2a] dark:hover:border-[#3a3a3a] dark:shadow-none">
      <div className="space-y-2">
        {/* Header: Ticket ID with Severity Dot and Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${getSeverityDotColor(ticket.severity || "L1")}`} />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {ticket.ticket_id || "N/A"}
            </span>
          </div>
          <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusClasses(ticket.status || "")}`}>
            {formatStatus(ticket.status || "Unknown")}
          </span>
        </div>

        {/* Issue Title - Primary Focus */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">
          {ticket.title}
        </h3>

        {/* Locality - Secondary with Icon */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <MapPin size={14} className="flex-shrink-0" />
          <span className="line-clamp-1">{ticket.address_text || "Location not available"}</span>
        </div>

        {/* Assigned Department - Secondary with Icon */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <Building2 size={14} className="flex-shrink-0" />
          <span>{ticket.assigned_department || "Unassigned"}</span>
        </div>

        {/* Timestamp - Bottom */}
        <div className="pt-1 mt-2 border-t border-gray-100 dark:border-[#2a2a2a]">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatTimestamp(ticket.created_at)}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function RecentTickets() {
  const [tickets, setTickets] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [citizenId, setCitizenId] = useState<string | null>(null);

  // Fetch current user's citizen ID
  useEffect(() => {
    const getCitizenId = async () => {
      // getSession() reads from localStorage — no network call, no race condition.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCitizenId(session.user.id);
      } else {
        setError("User not authenticated");
        setLoading(false);
      }
    };

    getCitizenId();
  }, []);

  // Fetch initial tickets and setup real-time subscription
  useEffect(() => {
    if (!citizenId) return;

    const fetchTickets = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("complaints")
          .select("*")
          .eq("citizen_id", citizenId)
          .order("created_at", { ascending: false })
          .limit(3);

        if (fetchError) {
          throw fetchError;
        }

        setTickets(data || []);
      } catch (err) {
        console.error("Error fetching tickets:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch tickets");
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();

    // Setup real-time subscription
    const channel = supabase
      .channel(`complaints-${citizenId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "complaints",
          filter: `citizen_id=eq.${citizenId}`,
        },
        (payload) => {
          const newTicket = payload.new as ComplaintRow;
          setTickets((prev) => [newTicket, ...prev].slice(0, 3));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "complaints",
          filter: `citizen_id=eq.${citizenId}`,
        },
        (payload) => {
          const updatedTicket = payload.new as ComplaintRow;
          setTickets((prev) =>
            prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [citizenId]);

  if (error) {
    return (
      <div className="p-6 rounded-lg border border-red-200 bg-red-50 text-red-700 shadow-sm text-center dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-40 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
            <div className="space-y-3 animate-pulse">
              <div className="h-3 bg-gray-200 dark:bg-[#2a2a2a] rounded w-1/3" />
              <div className="h-4 bg-gray-200 dark:bg-[#2a2a2a] rounded w-full" />
              <div className="h-3 bg-gray-200 dark:bg-[#2a2a2a] rounded w-2/3" />
              <div className="h-3 bg-gray-200 dark:bg-[#2a2a2a] rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-gray-200 bg-white shadow-sm text-center dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
        <p className="text-sm text-gray-600 dark:text-gray-400">No tickets submitted yet. Create one using the chat panel.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
}