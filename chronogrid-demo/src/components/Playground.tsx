import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  loadSample, FAULT_CLASSES, FAULT_CATEGORIES,
  type FaultClass, type SampleResult,
} from '@/lib/api'

// ─── 9-bus topology ─────────────────────────────────────────────────────────
// Ring buses 4,5,7,8,9,6 placed at hexagon vertices
const BUS = {
  1: { x: 130, y:  80, kind: 'gen',  label: 'G1' },   // generator
  2: { x: 670, y:  80, kind: 'gen',  label: 'G2' },
  3: { x: 400, y: 480, kind: 'gen',  label: 'G3' },
  4: { x: 130, y: 200, kind: 'bus',  label: '4'  },   // step-up
  5: { x: 280, y: 280, kind: 'load', label: '5'  },   // load
  6: { x: 130, y: 360, kind: 'load', label: '6'  },   // load
  7: { x: 670, y: 200, kind: 'bus',  label: '7'  },   // step-up
  8: { x: 520, y: 280, kind: 'load', label: '8'  },   // load
  9: { x: 400, y: 360, kind: 'bus',  label: '9'  },   // step-up
} as const
type BusId = keyof typeof BUS

// Transformer connections (gen → bus) — not faultable
const XFORMER: { from: BusId; to: BusId }[] = [
  { from: 1, to: 4 },
  { from: 2, to: 7 },
  { from: 3, to: 9 },
]

// Transmission lines — these ARE faultable
const LINES: { id: string; from: BusId; to: BusId }[] = [
  { id: 'L4-5', from: 4, to: 5 },
  { id: 'L4-6', from: 4, to: 6 },
  { id: 'L5-7', from: 5, to: 7 },
  { id: 'L7-8', from: 7, to: 8 },
  { id: 'L8-9', from: 8, to: 9 },
  { id: 'L6-9', from: 6, to: 9 },
]

// ─── Component ──────────────────────────────────────────────────────────────
export function Playground() {
  const [hoverLine, setHoverLine]   = useState<string | null>(null)
  const [activeLine, setActiveLine] = useState<string | null>(null)
  const [fault, setFault]           = useState<FaultClass | null>(null)
  const [result, setResult]         = useState<SampleResult | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const lineMidpoint = (id: string) => {
    const ln = LINES.find(l => l.id === id)!
    return {
      x: (BUS[ln.from].x + BUS[ln.to].x) / 2,
      y: (BUS[ln.from].y + BUS[ln.to].y) / 2,
    }
  }

  async function injectFault(faultType: FaultClass) {
    if (!activeLine) return
    setFault(faultType)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await loadSample(faultType)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inference failed')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setActiveLine(null)
    setFault(null)
    setResult(null)
    setError(null)
  }

  const correct = result && fault ? result.predicted_class === fault : null
  const activeLineObj = activeLine ? LINES.find(l => l.id === activeLine) : null
  const activeMid     = activeLine ? lineMidpoint(activeLine) : null

  return (
    <section id="playground" className="py-24 px-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <Badge variant="secondary" className="mb-4 font-mono text-xs">Playground</Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          IEEE 9-Bus Fault Simulator
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base leading-relaxed">
          Click any transmission line to inject a fault. Watch the model classify the
          resulting S-transform signature in real time.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ─── LEFT: 9-bus topology SVG (3 cols) ─────────────────── */}
        <div className="lg:col-span-3 rounded-xl bg-zinc-900 border border-white/7 p-4">
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-xs text-zinc-500 font-mono">WSCC IEEE 9-Bus System</span>
            {activeLine && (
              <button
                onClick={reset}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                ✕ Clear fault
              </button>
            )}
          </div>

          <svg viewBox="0 0 800 540" className="w-full h-auto select-none">
            <defs>
              <radialGradient id="busGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f87171" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
              </radialGradient>
              <filter id="redGlow">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Transformers (gray, non-clickable) */}
            {XFORMER.map(({ from, to }) => {
              const a = BUS[from], b = BUS[to]
              return (
                <g key={`xf-${from}-${to}`}>
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="#52525b" strokeWidth={2} strokeDasharray="4 3"
                  />
                  {/* Transformer symbol — two overlapping circles */}
                  <circle cx={(a.x+b.x)/2-6} cy={(a.y+b.y)/2} r={5}
                          fill="none" stroke="#71717a" strokeWidth={1.5} />
                  <circle cx={(a.x+b.x)/2+6} cy={(a.y+b.y)/2} r={5}
                          fill="none" stroke="#71717a" strokeWidth={1.5} />
                </g>
              )
            })}

            {/* Transmission lines (interactive) */}
            {LINES.map(line => {
              const a = BUS[line.from], b = BUS[line.to]
              const isHover  = hoverLine === line.id
              const isActive = activeLine === line.id
              const midX = (a.x + b.x) / 2
              const midY = (a.y + b.y) / 2

              return (
                <g key={line.id}>
                  {/* Wide invisible hit target */}
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="transparent" strokeWidth={20}
                    onMouseEnter={() => setHoverLine(line.id)}
                    onMouseLeave={() => setHoverLine(null)}
                    onClick={() => { setActiveLine(line.id); setFault(null); setResult(null); setError(null); }}
                    style={{ cursor: 'pointer' }}
                  />
                  {/* Visible line */}
                  <motion.line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={isActive ? '#f87171' : isHover ? '#38bdf8' : '#a1a1aa'}
                    strokeWidth={isActive ? 4 : isHover ? 3 : 2}
                    filter={isActive ? 'url(#redGlow)' : undefined}
                    style={{ pointerEvents: 'none' }}
                    animate={isActive ? {
                      strokeDasharray: ['0 1', '8 4', '0 1'],
                      strokeDashoffset: [0, -20, -40],
                    } : { strokeDasharray: '0 0' }}
                    transition={isActive ? { duration: 1.2, repeat: Infinity, ease: 'linear' } : {}}
                  />
                  {/* Line label */}
                  <text
                    x={midX} y={midY - 8}
                    fontSize={10} fontFamily="monospace"
                    fill={isActive ? '#fca5a5' : '#71717a'}
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {line.id}
                  </text>
                </g>
              )
            })}

            {/* Buses & generators */}
            {(Object.entries(BUS) as [string, typeof BUS[BusId]][]).map(([id, b]) => {
              const isGen  = b.kind === 'gen'
              const isLoad = b.kind === 'load'
              return (
                <g key={id}>
                  {isGen ? (
                    <>
                      {/* Generator: circle with G */}
                      <circle cx={b.x} cy={b.y} r={22} fill="#18181b"
                              stroke="#34d399" strokeWidth={2} />
                      <text x={b.x} y={b.y+4} fontSize={13} fontFamily="monospace"
                            fill="#34d399" textAnchor="middle" fontWeight="bold">
                        {b.label}
                      </text>
                    </>
                  ) : isLoad ? (
                    <>
                      {/* Bus bar with arrow indicating load */}
                      <rect x={b.x-18} y={b.y-9} width={36} height={18} rx={3}
                            fill="#18181b" stroke="#fbbf24" strokeWidth={1.5} />
                      <text x={b.x} y={b.y+4} fontSize={11} fontFamily="monospace"
                            fill="#fbbf24" textAnchor="middle" fontWeight="bold">
                        {b.label}
                      </text>
                      {/* downward arrow showing load */}
                      <path d={`M ${b.x} ${b.y+10} l 0 8 m -4 -4 l 4 4 l 4 -4`}
                            stroke="#fbbf24" strokeWidth={1.5} fill="none" />
                    </>
                  ) : (
                    <>
                      {/* Plain bus */}
                      <rect x={b.x-18} y={b.y-9} width={36} height={18} rx={3}
                            fill="#18181b" stroke="#71717a" strokeWidth={1.5} />
                      <text x={b.x} y={b.y+4} fontSize={11} fontFamily="monospace"
                            fill="#a1a1aa" textAnchor="middle" fontWeight="bold">
                        {b.label}
                      </text>
                    </>
                  )}
                </g>
              )
            })}

            {/* Active fault marker */}
            <AnimatePresence>
              {activeLine && activeMid && (
                <motion.g
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                >
                  <motion.circle
                    cx={activeMid.x} cy={activeMid.y} r={20}
                    fill="url(#busGlow)"
                    animate={{ r: [15, 30, 15], opacity: [0.8, 0.3, 0.8] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <text
                    x={activeMid.x} y={activeMid.y + 5}
                    fontSize={16} textAnchor="middle"
                  >⚡</text>
                </motion.g>
              )}
            </AnimatePresence>
          </svg>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-2 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border-2 border-emerald-400" />
              Generator
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2 rounded-sm border border-amber-400" />
              Load Bus
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-zinc-400" />
              Transmission
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 border-t-2 border-dashed border-zinc-500" />
              Transformer
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Control panel + result (2 cols) ──────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Step 1: Pick line */}
          <div className="rounded-xl bg-zinc-900 border border-white/7 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                activeLine ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
              }`}>1</div>
              <span className="text-sm font-medium">Select a transmission line</span>
            </div>
            <div className="text-xs text-zinc-500 ml-8">
              {activeLine
                ? <span className="text-emerald-400">✓ Line {activeLineObj?.id} (Bus {activeLineObj?.from} ↔ Bus {activeLineObj?.to})</span>
                : 'Click any solid line in the diagram'}
            </div>
          </div>

          {/* Step 2: Pick fault */}
          <div className={`rounded-xl bg-zinc-900 border p-5 transition-opacity ${
            activeLine ? 'border-white/7 opacity-100' : 'border-white/5 opacity-50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                fault ? 'bg-emerald-500/20 text-emerald-400' : activeLine ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-800 text-zinc-500'
              }`}>2</div>
              <span className="text-sm font-medium">Inject fault type</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 ml-8">
              {FAULT_CLASSES.filter(f => f !== 'NF').map(f => {
                const cat = Object.values(FAULT_CATEGORIES).find(c => c.classes.includes(f))
                const isActive = fault === f
                return (
                  <button
                    key={f}
                    disabled={!activeLine || loading}
                    onClick={() => injectFault(f)}
                    className={`px-1.5 py-1.5 rounded-md text-xs font-mono font-bold border transition-all ${
                      isActive
                        ? 'border-red-400 bg-red-500/10 text-red-300'
                        : activeLine
                          ? 'border-white/10 bg-zinc-800/50 text-zinc-300 hover:border-white/20 hover:bg-zinc-800'
                          : 'border-white/5 bg-zinc-900 text-zinc-600 cursor-not-allowed'
                    }`}
                    style={{ borderColor: isActive ? cat?.color : undefined }}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2 ml-8 leading-relaxed">
              AG/BG/CG = single-phase to ground · AB/AC/BC = phase-to-phase ·
              ABG/ACG/BCG = double-phase to ground · ABCG = three-phase
            </p>
          </div>

          {/* Step 3: Result */}
          <div className={`rounded-xl bg-zinc-900 border p-5 transition-opacity ${
            fault ? 'border-white/7 opacity-100' : 'border-white/5 opacity-50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                result ? 'bg-emerald-500/20 text-emerald-400' : fault ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-800 text-zinc-500'
              }`}>3</div>
              <span className="text-sm font-medium">Model classification</span>
            </div>

            <div className="ml-8">
              {loading && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 py-3">
                  <div className="w-3 h-3 rounded-full border border-zinc-500 border-t-sky-400 animate-spin" />
                  Running CNN+BiLSTM inference…
                </div>
              )}

              {error && (
                <div className="text-xs text-red-400 py-3">{error}</div>
              )}

              {result && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black font-mono"
                          style={{ color: correct ? '#34d399' : '#f87171' }}>
                      {result.predicted_class}
                    </span>
                    <span className="text-sm text-zinc-400 font-mono">
                      {(result.confidence * 100).toFixed(1)}%
                    </span>
                    {correct !== null && (
                      <Badge variant={correct ? 'emerald' : 'red'} className="ml-auto">
                        {correct ? '✓ correct' : '✗ misclassified'}
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-zinc-500">
                    Inference: <span className="text-zinc-300 font-mono">{result.inference_ms} ms</span>
                    {' · '}
                    Injected: <span className="text-zinc-300 font-mono">{fault}</span>
                  </div>

                  {/* Confidence bars for top-3 */}
                  <div className="space-y-1 pt-1">
                    {Object.entries(result.probabilities)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 3)
                      .map(([cls, p]) => (
                        <div key={cls} className="flex items-center gap-2 text-[11px] font-mono">
                          <span className="w-10 text-zinc-400">{cls}</span>
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-sky-400 to-emerald-400"
                              initial={{ width: 0 }}
                              animate={{ width: `${p * 100}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <span className="w-10 text-right text-zinc-500">{(p * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}

              {!loading && !result && !error && (
                <div className="text-xs text-zinc-600 py-3">
                  {fault ? 'Loading…' : 'Pick a fault type above'}
                </div>
              )}
            </div>
          </div>

          {activeLine && (
            <Button variant="outline" size="sm" className="w-full" onClick={reset}>
              Reset simulation
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
