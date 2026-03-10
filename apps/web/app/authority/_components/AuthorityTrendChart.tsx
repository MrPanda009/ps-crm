// apps/web/app/authority/_components/AuthorityTrendChart.tsx
"use client"

import { useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChevronDown } from "lucide-react"
import type { TrendPoint } from "./dashboard-types"

const LINES: { key: keyof Omit<TrendPoint, "label">; label: string; color: string }[] = [
  { key: "submitted",   label: "Submitted",   color: "#b4725a" },
  { key: "assigned",    label: "Assigned",    color: "#3b82f6" },
  { key: "in_progress", label: "In Progress", color: "#6366f1" },
  { key: "resolved",    label: "Resolved",    color: "#10b981" },
]

type ViewMode = "day" | "week" | "month"

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "day",   label: "Today"      },
  { value: "week",  label: "7 Days"     },
  { value: "month", label: "6 Months"   },
]

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="flex h-52 items-end gap-3 px-2 animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="w-full rounded-t bg-gray-100 dark:bg-gray-800" style={{ height: `${30 + i * 15}px` }} />
          <div className="h-2 w-8 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  )
}

type Props = {
  allTrend: { day: TrendPoint[]; week: TrendPoint[]; month: TrendPoint[] }
  department: string
  loading: boolean
}

export default function AuthorityTrendChart({ allTrend, department, loading }: Props) {
  const [view,     setView]     = useState<ViewMode>("week")
  const [dropOpen, setDropOpen] = useState(false)

  const data         = allTrend[view] ?? []
  const activeOption = VIEW_OPTIONS.find(o => o.value === view)!

  // For day view, skip empty hours to keep chart readable
  const chartData = view === "day"
    ? data.filter((_, i) => {
        // Always show first, last, and non-zero hours
        const d = data[i]
        return i === 0 || i === data.length - 1 ||
          d.submitted > 0 || d.resolved > 0 || d.in_progress > 0 || d.assigned > 0
      })
    : data

  // If day view has no data at all, show a flat line with just the current hour
  const displayData = (view === "day" && chartData.filter(d =>
    d.submitted > 0 || d.resolved > 0
  ).length === 0)
    ? data.slice(0, 12)  // first 12 hours so chart renders
    : chartData

  const xInterval = view === "day" ? 1 :
                    view === "week" ? 0 : "preserveStartEnd"

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Complaint Trend</h2>
          <p className="mt-0.5 text-xs text-gray-400">{department || "All Departments"}</p>
        </div>

        {/* Dropdown selector */}
        <div className="relative">
          <button
            onClick={() => setDropOpen(o => !o)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {activeOption.label}
            <ChevronDown size={12} className={`transition-transform ${dropOpen ? "rotate-180" : ""}`} />
          </button>
          <div className={`absolute right-0 top-full z-50 mt-1 w-32 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 transition-all duration-150 ${dropOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"}`}>
            {VIEW_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => { setView(o.value); setDropOpen(false) }}
                className={`block w-full px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${view === o.value ? "font-bold text-[#b4725a]" : "text-gray-700 dark:text-gray-300"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-gray-400">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={displayData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(156,163,175,0.15)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              interval={xInterval as any}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "rgba(156,163,175,0.2)", strokeWidth: 1 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 14 }}
              iconType="circle"
              iconSize={7}
              formatter={(value) => (
                <span style={{ color: "#6b7280", fontSize: 11 }}>{value}</span>
              )}
            />
            {LINES.map(({ key, label, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
