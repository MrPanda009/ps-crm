"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Search, X, ChevronDown } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import type { Database } from "@/src/types/database.types";

type ComplaintRow = Database["public"]["Tables"]["complaints"]["Row"];
type TicketListRow = Pick<
  ComplaintRow,
  "id" | "ticket_id" | "title" | "address_text" | "assigned_department" | "status" | "created_at" | "upvote_count"
>;

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function statusClasses(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "submitted") return "bg-amber-100 text-amber-700";
  if (normalized === "assigned") return "bg-blue-100 text-blue-700";
  if (normalized === "in_progress" || normalized === "under_review") return "bg-purple-100 text-purple-700";
  if (normalized === "resolved") return "bg-green-100 text-green-700";
  if (normalized === "rejected") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function formatReportedTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function extractRelevantAddress(fullAddress: string | null | undefined): string {
  if (!fullAddress) return "Address unavailable";
  const beforeGPS = fullAddress.split("|")[0].trim();
  const lines = beforeGPS
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length < 100);
  return lines.slice(0, 3).join(", ") || beforeGPS;
}

function extractUniqueStatuses(tickets: TicketListRow[]): string[] {
  const seen = new Set<string>();
  tickets.forEach((t) => {
    if (t.status) seen.add(t.status);
  });
  return Array.from(seen).sort();
}

function extractUniqueDepartments(tickets: TicketListRow[]): string[] {
  const seen = new Set<string>();
  tickets.forEach((t) => {
    if (t.assigned_department && t.assigned_department !== "Unassigned") seen.add(t.assigned_department);
  });
  return Array.from(seen).sort();
}

function filterAndSortTickets(
  tickets: TicketListRow[],
  searchQuery: string,
  statusFilter: string | null,
  departmentFilter: string | null,
  sortBy: "latest" | "upvotes" | "oldest"
): TicketListRow[] {
  let filtered = [...tickets];

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter((ticket) => {
      const ticketId = (ticket.ticket_id || "").toLowerCase();
      const title = (ticket.title || "").toLowerCase();
      const address = extractRelevantAddress(ticket.address_text).toLowerCase();
      return ticketId.includes(query) || title.includes(query) || address.includes(query);
    });
  }

  // Apply status filter
  if (statusFilter) {
    filtered = filtered.filter((ticket) => ticket.status === statusFilter);
  }

  // Apply department filter
  if (departmentFilter) {
    filtered = filtered.filter((ticket) => ticket.assigned_department === departmentFilter);
  }

  // Apply sorting
  if (sortBy === "upvotes") {
    filtered.sort((a, b) => {
      const diff = (b.upvote_count ?? 0) - (a.upvote_count ?? 0);
      if (diff !== 0) return diff;
      // Tie-breaker: latest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  } else if (sortBy === "oldest") {
    // Oldest first
    filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else {
    // Default: latest
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return filtered;
}

export default function CitizenTicketsPage() {
  const [tickets, setTickets] = useState<TicketListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [citizenId, setCitizenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "upvotes" | "oldest">("latest");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  useEffect(() => {
    const bootstrapCitizen = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.id) {
        setError("Unable to identify citizen account.");
        setLoading(false);
        return;
      }

      setCitizenId(user.id);
    };

    void bootstrapCitizen();
  }, []);

  useEffect(() => {
    if (!citizenId) return;

    let isActive = true;

    const fetchTickets = async () => {
      if (!isActive) return;
      setLoading(true);
      setError(null);

      const { data, error: ticketError } = await supabase
        .from("complaints")
        .select("id, ticket_id, title, address_text, assigned_department, status, created_at, upvote_count")
        .eq("citizen_id", citizenId)
        .order("created_at", { ascending: false });

      if (!isActive) return;

      if (ticketError) {
        setError("Failed to load tickets.");
        setLoading(false);
        return;
      }

      setTickets((data ?? []) as TicketListRow[]);
      setLoading(false);
    };

    const toTicketRow = (row: ComplaintRow): TicketListRow => ({
      id: row.id,
      ticket_id: row.ticket_id,
      title: row.title,
      address_text: row.address_text,
      assigned_department: row.assigned_department,
      status: row.status,
      created_at: row.created_at,
      upvote_count: row.upvote_count,
    });

    const upsertTicket = (prev: TicketListRow[], incoming: TicketListRow): TicketListRow[] => {
      const existingIndex = prev.findIndex((item) => item.id === incoming.id);
      if (existingIndex === -1) {
        return [incoming, ...prev];
      }

      const next = [...prev];
      next[existingIndex] = incoming;
      return next;
    };

    void fetchTickets();

    const channel = supabase
      .channel(`citizen-ticket-list-${citizenId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "complaints",
          filter: `citizen_id=eq.${citizenId}`,
        },
        (payload) => {
          const incoming = toTicketRow(payload.new as ComplaintRow);
          setTickets((prev) => upsertTicket(prev, incoming));
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
          const incoming = toTicketRow(payload.new as ComplaintRow);
          setTickets((prev) => upsertTicket(prev, incoming));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "complaints",
          filter: `citizen_id=eq.${citizenId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string }).id;
          if (!deletedId) return;
          setTickets((prev) => prev.filter((item) => item.id !== deletedId));
        }
      )
      .subscribe((status) => {
        // Recover quickly from transient realtime channel issues to avoid stale upvote counts.
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && isActive) {
          void fetchTickets();
        }
      });

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchTickets();
      }
    }, 12000);

    return () => {
      isActive = false;
      window.clearInterval(pollInterval);
      void channel.unsubscribe();
    };
  }, [citizenId]);

  // Extract available statuses and departments whenever tickets change
  useEffect(() => {
    setAvailableStatuses(extractUniqueStatuses(tickets));
    setAvailableDepartments(extractUniqueDepartments(tickets));
  }, [tickets]);

  // Compute filtered and sorted tickets
  const filteredTickets = filterAndSortTickets(tickets, searchQuery, statusFilter, departmentFilter, sortBy);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSortBy("latest");
    setStatusFilter(null);
    setDepartmentFilter(null);
  };

  const hasActiveFilters = searchQuery || statusFilter || departmentFilter || sortBy !== "latest";

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col px-4 sm:px-6 py-4">
      <section className="flex-1 min-h-0 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-10rem)] lg:max-h-[calc(100vh-8rem)]">
        {/* Search and Filter Controls */}
        <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-5 py-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by ticket id, title, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Sort and Filter Dropdowns */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Sort: {sortBy === "latest" ? "Latest" : sortBy === "upvotes" ? "Highest Upvote" : "Oldest"}
                <ChevronDown size={16} className={`transition-transform ${sortDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {sortDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-20 w-40 rounded-lg border border-gray-300 bg-white shadow-lg">
                  <button
                    onClick={() => {
                      setSortBy("latest");
                      setSortDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                      sortBy === "latest" ? "bg-purple-50 text-purple-700 font-medium" : ""
                    }`}
                  >
                    Latest
                  </button>
                  <button
                    onClick={() => {
                      setSortBy("upvotes");
                      setSortDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                      sortBy === "upvotes" ? "bg-purple-50 text-purple-700 font-medium" : ""
                    }`}
                  >
                    Highest Upvote
                  </button>
                  <button
                    onClick={() => {
                      setSortBy("oldest");
                      setSortDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                      sortBy === "oldest" ? "bg-purple-50 text-purple-700 font-medium" : ""
                    }`}
                  >
                    Oldest
                  </button>
                </div>
              )}
            </div>

            {/* Status Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Status: {statusFilter ? formatStatus(statusFilter) : "All"}
                <ChevronDown size={16} className={`transition-transform ${statusDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {statusDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-20 w-48 rounded-lg border border-gray-300 bg-white shadow-lg">
                  <button
                    onClick={() => {
                      setStatusFilter(null);
                      setStatusDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                      statusFilter === null ? "bg-purple-50 text-purple-700 font-medium" : ""
                    }`}
                  >
                    All
                  </button>
                  {availableStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                        setStatusDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                        statusFilter === status ? "bg-purple-50 text-purple-700 font-medium" : ""
                      }`}
                    >
                      {formatStatus(status)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Department Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDepartmentDropdownOpen(!departmentDropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Department: {departmentFilter ? departmentFilter : "All"}
                <ChevronDown size={16} className={`transition-transform ${departmentDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {departmentDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-20 w-48 rounded-lg border border-gray-300 bg-white shadow-lg">
                  <button
                    onClick={() => {
                      setDepartmentFilter(null);
                      setDepartmentDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                      departmentFilter === null ? "bg-purple-50 text-purple-700 font-medium" : ""
                    }`}
                  >
                    All Departments
                  </button>
                  {availableDepartments.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => {
                        setDepartmentFilter(dept);
                        setDepartmentDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                        departmentFilter === dept ? "bg-purple-50 text-purple-700 font-medium" : ""
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto flex-1 min-h-0 flex flex-col">
          <div className="min-w-[980px] flex flex-col flex-1 min-h-0">
            <div className="sticky top-0 z-10 grid grid-cols-[150px_2fr_2fr_1.2fr_1fr_1fr_100px] gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Ticket ID</span>
              <span>Issue Title</span>
              <span>Locality / Address</span>
              <span>Assigned Department</span>
              <span>Status</span>
              <span>Reported Time</span>
              <span className="text-right">Upvotes</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading && (
                <div className="px-5 py-8 text-sm text-gray-500">Loading tickets...</div>
              )}

              {!loading && error && (
                <div className="px-5 py-8 text-sm text-red-600">{error}</div>
              )}

              {!loading && !error && tickets.length === 0 && !searchQuery && statusFilter === null && departmentFilter === null && (
                <div className="px-5 py-8 text-sm text-gray-500">No tickets reported yet.</div>
              )}

              {!loading && !error && tickets.length > 0 && filteredTickets.length === 0 && (
                <div className="px-5 py-8 text-sm text-gray-500">No tickets match your filters.</div>
              )}

              {!loading && !error && filteredTickets.length > 0 && (
                <ul className="divide-y divide-gray-100">
                  {filteredTickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="grid grid-cols-[150px_2fr_2fr_1.2fr_1fr_1fr_100px] gap-3 px-5 py-4 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium text-gray-900 font-mono text-xs sm:text-sm truncate">
                        {ticket.ticket_id || "N/A"}
                      </span>

                      <span className="text-gray-900 font-medium line-clamp-2 leading-snug">
                        {ticket.title || "Untitled issue"}
                      </span>

                      <span className="text-gray-600 line-clamp-1 leading-snug cursor-pointer" title={ticket.address_text || "Address unavailable"}>
                        {extractRelevantAddress(ticket.address_text) || "Address unavailable"}
                      </span>

                      <span className="text-gray-700 line-clamp-2 leading-snug">
                        {ticket.assigned_department || "Unassigned"}
                      </span>

                      <span>
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusClasses(ticket.status || "")}`}>
                          {formatStatus(ticket.status || "submitted")}
                        </span>
                      </span>

                      <span className="text-gray-500 text-xs sm:text-sm">
                        {formatReportedTime(ticket.created_at)}
                      </span>

                      <span className="inline-flex items-center justify-end gap-1 text-gray-700 font-medium">
                        <ArrowUp size={14} className="text-gray-400" />
                        {ticket.upvote_count ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
