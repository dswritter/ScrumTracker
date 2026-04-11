import type { PieSectorDataItem } from 'recharts/types/polar/Pie'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const GREEN = '#00B050'
const GREEN_MID = '#3DCC7A'
const GREEN_AXIS = '#0d5c2e'

const tooltipProps = {
  cursor: false as const,
  contentStyle: {
    fontSize: 12,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid rgb(226 232 240)',
    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
  },
  labelStyle: { fontWeight: 600, marginBottom: 4 },
}

const activeBarGlow = {
  stroke: '#00B050',
  strokeWidth: 2,
  filter: 'drop-shadow(0 0 8px rgba(0, 176, 80, 0.65))',
}

function pieActiveShape(props: PieSectorDataItem) {
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill,
  } = props
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={Number(outerRadius) + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#00B050"
        strokeWidth={2}
        style={{
          filter: 'drop-shadow(0 0 10px rgba(0, 176, 80, 0.55))',
        }}
      />
    </g>
  )
}

type PieDatum = { name: string; value: number; fill: string }

export function MetabuildStatusPie({
  data,
  compact = false,
}: {
  data: PieDatum[]
  compact?: boolean
}) {
  const h = compact ? 168 : 220
  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-slate-500 ${
          compact ? 'h-[140px]' : 'h-[200px]'
        }`}
      >
        No scoped items
      </div>
    )
  }
  const innerR = compact ? 36 : 48
  const outerR = compact ? 52 : 68
  return (
    <ResponsiveContainer width="100%" height={h}>
      <PieChart margin={{ top: 8, right: 6, bottom: 8, left: 6 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerR}
          outerRadius={outerR}
          paddingAngle={2}
          activeShape={pieActiveShape}
          labelLine={{ stroke: '#0d5c2e', strokeWidth: 1 }}
          label={(props: Record<string, unknown>) => {
            const cx = Number(props.cx ?? 0)
            const cy = Number(props.cy ?? 0)
            const midAngle = Number(props.midAngle ?? 0)
            const or = Number(props.outerRadius ?? outerR)
            const name = String(props.name ?? '')
            const pct = Number(props.percent ?? 0)
            const RADIAN = Math.PI / 180
            const r = or + (compact ? 14 : 16)
            const x = cx + r * Math.cos(-midAngle * RADIAN)
            const y = cy + r * Math.sin(-midAngle * RADIAN)
            return (
              <text
                x={x}
                y={y}
                fill="#0d5c2e"
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                fontSize={compact ? 9 : 10}
                fontWeight={600}
              >
                {`${name} ${(pct * 100).toFixed(0)}%`}
              </text>
            )
          }}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} stroke="#fff" strokeWidth={1} />
          ))}
        </Pie>
        <Tooltip {...tooltipProps} formatter={(v: number) => [v, 'Items']} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MetabuildSectionBars({
  rows,
  compact = false,
}: {
  rows: { name: string; pct: number }[]
  compact?: boolean
}) {
  const h = compact ? 200 : 240
  if (!rows.length) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-slate-500 ${
          compact ? 'h-[160px]' : 'h-[200px]'
        }`}
      >
        No sections
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
      >
        <XAxis type="number" domain={[0, 100]} tick={{ fill: GREEN_AXIS, fontSize: 10 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={compact ? 76 : 88}
          tick={{ fill: GREEN_AXIS, fontSize: 10 }}
        />
        <Tooltip
          {...tooltipProps}
          formatter={(v: number) => [`${v}%`, 'Done']}
        />
        <Bar
          dataKey="pct"
          radius={[0, 4, 4, 0]}
          name="% done"
          activeBar={activeBarGlow}
          minPointSize={compact ? 4 : 6}
        >
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
  compact = false,
}: {
  rows: { label: string; fullName: string; pct: number }[]
  compact?: boolean
}) {
  const h = compact
    ? Math.min(480, Math.max(200, rows.length * 22 + 48))
    : Math.max(220, rows.length * 24 + 40)
  if (!rows.length) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-slate-500 ${
          compact ? 'h-[120px]' : 'h-[180px]'
        }`}
      >
        No people
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ left: 12, right: 28, top: 8, bottom: 8 }}
      >
        <XAxis type="number" domain={[0, 100]} tick={{ fill: GREEN_AXIS, fontSize: 10 }} />
        <YAxis
          type="category"
          dataKey="label"
          width={compact ? 112 : 100}
          interval={0}
          tick={{ fill: GREEN_AXIS, fontSize: 9 }}
        />
        <Tooltip
          {...tooltipProps}
          formatter={(v: number) => [`${v}%`, 'Done']}
          labelFormatter={(_, payload) => {
            const p = payload?.[0]?.payload as { fullName?: string } | undefined
            return p?.fullName ?? ''
          }}
        />
        <Bar
          dataKey="pct"
          radius={[0, 4, 4, 0]}
          activeBar={activeBarGlow}
          minPointSize={compact ? 4 : 6}
        >
          {rows.map((_, i) => (
            <Cell key={i} fill={GREEN_MID} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
