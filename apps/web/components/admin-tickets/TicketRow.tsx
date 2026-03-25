import type { CSSProperties } from "react"
import PriorityBadge from "@/components/admin-tickets/PriorityBadge"
import StatusBadge from "@/components/admin-tickets/StatusBadge"
import TicketActions from "@/components/admin-tickets/TicketActions"
import { formatRelativeCreated } from "@/components/admin-tickets/formatters"
import type { TicketRecord } from "@/components/admin-tickets/types"

type TicketRowProps = {
  ticket: TicketRecord
  actionLoading?: boolean
  onView: (ticket: TicketRecord) => void
  onAssign: (ticket: TicketRecord) => void
  onEscalate: (ticket: TicketRecord) => void
}

export default function TicketRow({ ticket, actionLoading = false, onView, onAssign, onEscalate }: TicketRowProps) {
  const clamp3Lines: CSSProperties = {
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  }

  return (
    <tr className="border-t border-[#ded6cb] align-top">
      <td className="px-3 py-4 text-sm font-medium text-[#332d28]">
        <span className="block w-full" style={clamp3Lines}>{ticket.ticketId}</span>
      </td>
      <td className="px-3 py-4 text-sm font-semibold text-[#29231f]">
        <span className="block w-full" style={clamp3Lines}>{ticket.title}</span>
      </td>
      <td className="px-3 py-4 text-sm text-[#332d28]">
        <span className="block w-full" style={clamp3Lines}>{ticket.category}</span>
      </td>
      <td className="px-3 py-4 text-sm text-[#332d28]">
        <span className="block w-full" style={clamp3Lines}>{ticket.location}</span>
      </td>
      <td className="px-3 py-4 whitespace-nowrap"><StatusBadge status={ticket.status} /></td>
      <td className="px-3 py-4 whitespace-nowrap"><PriorityBadge severity={ticket.severity} /></td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-[#332d28]">
        <span className="block w-full" style={clamp3Lines}>{formatRelativeCreated(ticket.createdAt)}</span>
      </td>
      <td className="px-3 py-4 text-sm text-[#332d28]">
        <span className="block w-full" style={clamp3Lines}>{ticket.authority}</span>
      </td>
      <td className="px-3 py-4 text-sm text-[#332d28]">
        <span className="block w-full" style={clamp3Lines}>{ticket.worker}</span>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <TicketActions
          ticketId={ticket.ticketId}
          disabled={actionLoading}
          onView={() => onView(ticket)}
          onAssign={() => onAssign(ticket)}
          onEscalate={() => onEscalate(ticket)}
        />
      </td>
    </tr>
  )
}
