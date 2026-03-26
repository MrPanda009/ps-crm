import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from "lucide-react"

type AuthoritiesHeaderProps = {
  now: Date
  totalAuthorities: number
  operationalCount: number
  attentionCount: number
  averageResolutionDays: number
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <article className="rounded-2xl border border-[#d6cdbf] bg-white p-4 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:shadow-none">
      <div className="mb-2 flex items-center gap-2 text-sm text-[#6b6258] dark:text-gray-400">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-4xl font-semibold leading-none text-[#211c17] dark:text-gray-100">{value}</p>
    </article>
  )
}

export default function AuthoritiesHeader({
  now,
  totalAuthorities,
  operationalCount,
  attentionCount,
  averageResolutionDays,
}: AuthoritiesHeaderProps) {
  const formattedDate = now.toLocaleString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-[#d6cdbf] bg-[#efe7d8] px-4 py-3 text-[#231f1a] shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:text-gray-100 dark:shadow-none">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[2rem] font-bold leading-none">JanSamadhan</p>
            <h1 className="mt-2 text-xl font-semibold">Authorities Management | Departmental Oversight</h1>
          </div>
          <p className="text-right text-sm font-medium text-[#4f463d] dark:text-gray-300">
            {formattedDate}
            <br />
            India
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Authorities"
          value={String(totalAuthorities)}
          icon={<ShieldCheck size={16} className="text-[#5f554a] dark:text-gray-300" />}
        />
        <MetricCard
          label="Operational"
          value={String(operationalCount)}
          icon={<CheckCircle2 size={16} className="text-[#267045] dark:text-emerald-300" />}
        />
        <MetricCard
          label="Requires Attention"
          value={String(attentionCount)}
          icon={<AlertTriangle size={16} className="text-[#a16207] dark:text-amber-300" />}
        />
        <MetricCard
          label="Avg. Resolution Time"
          value={`${averageResolutionDays.toFixed(1)}d`}
          icon={<Clock3 size={16} className="text-[#334155] dark:text-sky-300" />}
        />
      </div>
    </div>
  )
}
