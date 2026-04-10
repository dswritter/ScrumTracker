import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const GREEN = '#00B050'
const GREEN_MID = '#3DCC7A'
const GREEN_AXIS = '#0d5c2e'

type PieDatum = { name: string; value: number; fill: string }

export function MetabuildStatusPie({ data }: { data: PieDatum[] }) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <div className="flex h-[200px] items-center justify-center text-xs text-slate-500">
        No scoped items
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={48}
          outerRadius={72}
          paddingAngle={2}
          label={(props: {
            name?: string
            percent?: number
          }) =>
            `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} stroke="#fff" strokeWidth={1} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => [v, 'Items']} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MetabuildSectionBars({
  rows,
}: {
  rows: { name: string; pct: number }[]
}) {
  if (!rows.length) {
    return (
      <div className="flex h-[200px] items-center justify-center text-xs text-slate-500">
        No sections
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
      >
        <XAxis type="number" domain={[0, 100]} tick={{ fill: GREEN_AXIS, fontSize: 10 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={88}
          tick={{ fill: GREEN_AXIS, fontSize: 10 }}
        />
        <Tooltip formatter={(v: number) => [`${v}%`, 'Done']} />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]} name="% done">
          {rows.map((_, i) => (
            <Cell key={i} fill={GREEN} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MetabuildAssigneeBars({
  rows,
}: {
  rows: { shortName: string; pct: number }[]
}) {
  if (!rows.length) {
    return (
      <div className="flex h-[180px] items-center justify-center text-xs text-slate-500">
        No people
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ left: 8, right: 28, top: 8, bottom: 8 }}
      >
        <XAxis type="number" domain={[0, 100]} tick={{ fill: GREEN_AXIS, fontSize: 10 }} />
        <YAxis
          type="category"
          dataKey="shortName"
          width={72}
          tick={{ fill: GREEN_AXIS, fontSize: 10 }}
        />
        <Tooltip formatter={(v: number) => [`${v}%`, 'Complete']} />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
          {rows.map((_, i) => (
            <Cell key={i} fill={GREEN_MID} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

