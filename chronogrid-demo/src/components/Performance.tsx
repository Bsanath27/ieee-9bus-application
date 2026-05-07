import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getMetrics, type Metrics, FAULT_CLASSES, FAULT_CATEGORIES, type FaultClass } from '@/lib/api'
import { ConfusionMatrix } from '@/components/ConfusionMatrix'

function getBarColor(fault: FaultClass) {
  const cat = Object.values(FAULT_CATEGORIES).find(c => c.classes.includes(fault))
  return cat?.color ?? '#94a3b8'
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <Card className="bg-zinc-900 border-white/7">
      <CardContent className="pt-5">
        <div className="text-2xl font-black font-mono mb-0.5" style={{ color }}>{value}</div>
        <div className="text-sm font-medium text-zinc-200">{label}</div>
        {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  )
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs">
        <div className="font-mono font-bold text-white mb-0.5">{label}</div>
        <div className="text-zinc-300">{(payload[0].value * 100).toFixed(1)}% accuracy</div>
      </div>
    )
  }
  return null
}

export function Performance() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [polling, setPolling] = useState(true)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    async function fetch() {
      try {
        const m = await getMetrics()
        setMetrics(m)
        if (m.ready) { setPolling(false); return }
      } catch { /* server not up yet */ }
      if (polling) timer = setTimeout(fetch, 3000)
    }
    fetch()
    return () => clearTimeout(timer)
  }, [polling])

  const chartData = metrics?.per_class_accuracy
    ? FAULT_CLASSES.map(f => ({ name: f, acc: metrics.per_class_accuracy![f] ?? 0 }))
    : FAULT_CLASSES.map(f => ({ name: f, acc: 0 }))

  const macroAcc  = metrics?.macro_accuracy  ? `${(metrics.macro_accuracy  * 100).toFixed(1)}%` : '—'
  const macroF1   = metrics?.macro_f1        ? `${(metrics.macro_f1        * 100).toFixed(1)}%` : '—'
  const latencyMs = metrics?.latency_ms      ? `${metrics.latency_ms.toFixed(1)}ms`             : '—'
  const params    = metrics?.params          ? `${(metrics.params / 1e6).toFixed(2)}M`           : '~1.01M'

  return (
    <section id="performance" className="py-24 px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <Badge variant="secondary" className="mb-4 font-mono text-xs">Evaluation</Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Performance Metrics</h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base leading-relaxed">
          Evaluated on 50 held-out samples per class from the WSCC 9-bus dataset.
          {!metrics?.ready && (
            <span className="text-amber-400/80"> Computing on server startup…</span>
          )}
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <StatCard label="Macro Accuracy"  value={macroAcc}   sub="All 11 classes"         color="#38bdf8" />
        <StatCard label="Macro F1 Score"  value={macroF1}    sub="Weighted average"        color="#34d399" />
        <StatCard label="Inference Speed" value={latencyMs}  sub="Per sample on CPU"       color="#fbbf24" />
        <StatCard label="Model Size"      value={params}     sub="Trainable parameters"    color="#a78bfa" />
      </div>

      {/* Per-class bar chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="rounded-xl bg-zinc-900 border border-white/7 p-6 mb-8"
      >
        <CardHeader className="p-0 mb-6">
          <CardTitle className="text-base">Per-Class Accuracy</CardTitle>
        </CardHeader>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'monospace' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
              domain={[0, 1]}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="acc" radius={[4, 4, 0, 0]}>
              {chartData.map(entry => (
                <Cell key={entry.name} fill={getBarColor(entry.name as FaultClass)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {!metrics?.ready && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
            <div className="w-3 h-3 rounded-full border border-zinc-500 border-t-sky-400 animate-spin" />
            Evaluating model on 550 samples…
          </div>
        )}
      </motion.div>

      {/* Confusion Matrix */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="rounded-xl bg-zinc-900 border border-white/7 p-6"
      >
        <CardHeader className="p-0 mb-6">
          <CardTitle className="text-base">Confusion Matrix</CardTitle>
          <p className="text-xs text-zinc-500 mt-1">
            Each cell shows how many samples of the actual class (row) were predicted as each class (column).
          </p>
        </CardHeader>
        {metrics?.confusion_matrix ? (
          <ConfusionMatrix matrix={metrics.confusion_matrix} />
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 py-16">
            <div className="w-3 h-3 rounded-full border border-zinc-500 border-t-sky-400 animate-spin" />
            {metrics?.ready ? 'Confusion matrix unavailable' : 'Computing…'}
          </div>
        )}
      </motion.div>

    </section>
  )
}
