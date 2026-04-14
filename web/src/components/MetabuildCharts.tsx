import { useId, useMemo } from 'react'
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
const MUTED_SLICE = '#B8E6CC'

const tooltipProps = {
  cursor: false as const,
  contentStyle: {
    fontSize: 12,
    padding: '8px 12px',
    borderRadius: 8,
    backgroundColor: 'var(--chart-tooltip-bg)',
    color: 'var(--chart-tooltip-fg)',
    border: '1px solid var(--chart-tooltip-border)',
    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
  },
  labelStyle: { fontWeight: 600, marginBottom: 4, color: 'var(--chart-tooltip-fg)' },
}

const activeBarGlow = {
  stroke: '#00B050',
  strokeWidth: 2,
  filter: 'drop-shadow(0 0 8px rgba(0, 176, 80, 0.65))',
}

export type TeamPieSlice = {
  name: string
  value: number
  /** Done = solid brand green; in-progress = striped green; todo/blocked = soft mint. */
  variant: 'solid' | 'striped' | 'muted'
  filter: 'done' | 'inProgress' | 'blockedTodo'
}

type PieRow = TeamPieSlice & { fill: string }

export function MetabuildStatusPie({
  data,
  compact = false,
  totalItems,
  onSliceClick,
  onTotalClick,
}: {
  data: TeamPieSlice[]
  compact?: boolean
  totalItems?: number
  onSliceClick?: (filter: 'done' | 'inProgress' | 'blockedTodo') => void
  onTotalClick?: () => void
}) {
  const stripedPatternId = useId().replace(/:/g, '')
  const chartData: PieRow[] = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        fill:
          d.variant === 'solid'
            ? GREEN
            : d.variant === 'striped'
              ? `url(#${stripedPatternId})`
              : MUTED_SLICE,
      })),
    [data, stripedPatternId],
  )

  const h = compact ? 168 : 232
  if (!chartData.length || chartData.every((d) => d.value === 0)) {
    return (
      <div
        className={`relative flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 ${
          compact ? 'min-h-[140px]' : 'min-h-[200px]'
        }`}
      >
        {typeof totalItems === 'number' && onTotalClick ? (
          <button
            type="button"
            className="absolute right-0 top-0 z-10 rounded-md border border-slate-200/90 bg-white/95 px-2 py-1 text-[10px] font-semibold tabular-nums text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Open all scoped work items"
            onClick={onTotalClick}
          >
            {totalItems} items
          </button>
        ) : null}
        No scoped items
      </div>
    )
  }
  const innerR = compact ? 36 : 50
  const outerR = compact ? 52 : 72

  const chart = (
    <ResponsiveContainer
      width="100%"
      height={h}
      className="pie-status-chart [&_.recharts-layer]:outline-none [&_path]:outline-none [&_path:focus]:outline-none"
    >
      <PieChart margin={{ top: 8, right: 6, bottom: 8, left: 6 }}>
        <defs>
          <pattern
            id={stripedPatternId}
            width={3}
            height={3}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={3} height={3} fill="#EEF8F2" />
            <rect width={0.9} height={3} fill={GREEN} />
          </pattern>
        </defs>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerR}
          outerRadius={outerR}
          paddingAngle={2}
          isAnimationActive={false}
          onMouseDown={(e) => {
            e.preventDefault()
          }}
          onClick={(slice) => {
            const row = slice as PieRow
            if (row?.filter && onSliceClick) onSliceClick(row.filter)
          }}
          labelLine={{ stroke: 'var(--chart-label)', strokeWidth: 1 }}
          label={(props: Record<string, unknown>) => {
            const cx = Number(props.cx ?? 0)
            const cy = Number(props.cy ?? 0)
            const midAngle = Number(props.midAngle ?? 0)
            const or = Number(props.outerRadius ?? outerR)
            const name = String(props.name ?? '')
            const pct = Number(props.percent ?? 0)
            const RADIAN = Math.PI / 180
            const r = or + (compact ? 14 : 18)
            const x = cx + r * Math.cos(-midAngle * RADIAN)
            const y = cy + r * Math.sin(-midAngle * RADIAN)
            return (
              <text
                x={x}
                y={y}
                fill="var(--chart-label)"
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
          {chartData.map((entry) => (
            <Cell
              key={entry.name}
              fill={entry.fill}
              stroke="var(--chart-tooltip-bg)"
              strokeWidth={1}
              style={{
                cursor: onSliceClick ? 'pointer' : 'default',
                outline: 'none',
              }}
            />
          ))}
        </Pie>
        <Tooltip {...tooltipProps} formatter={(v: number) => [v, 'Items']} />
      </PieChart>
    </ResponsiveContainer>
  )

  if (typeof totalItems === 'number' && onTotalClick) {
    return (
      <div className="relative w-full">
        <button
          type="button"
          className="absolute right-0 top-0 z-10 rounded-md border border-slate-200/90 bg-white/95 px-2 py-1 text-[10px] font-semibold tabular-nums text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Open all scoped work items"
          onClick={onTotalClick}
        >
          {totalItems} items
        </button>
        {chart}
      </div>
    )
  }

  return chart
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
        className={`flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 ${
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
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: 'var(--chart-label)', fontSize: 10 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={compact ? 76 : 88}
          tick={{ fill: 'var(--chart-label)', fontSize: 10 }}
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
        className={`flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 ${
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
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: 'var(--chart-label)', fontSize: 10 }}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={compact ? 112 : 100}
          interval={0}
          tick={{ fill: 'var(--chart-label)', fontSize: 9 }}
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
