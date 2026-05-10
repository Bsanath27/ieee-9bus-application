import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FAULT_CLASSES, FAULT_CATEGORIES, type FaultClass } from '@/lib/api'

// ── Physics data types ────────────────────────────────────────────────────────
interface BusState   { [busId: string]: number }       // voltage pu
interface LineState  { [lineId: string]: number }      // current kA
interface Scenario {
  bus_voltages:     BusState
  line_currents:    LineState
  fault_current_ka: number
  affected_lines:   string[]
}
interface PhysicsData {
  pre_fault: { bus_voltages: BusState; line_currents: LineState }
  faults:    Record<string, Record<string, Scenario>>
}

// ── 9-bus topology (mirrors Playground.tsx) ───────────────────────────────────
const BUS_POS: Record<number, { x: number; y: number; kind: 'gen' | 'bus' | 'load'; label: string }> = {
  1: { x: 130, y:  80, kind: 'gen',  label: 'G1' },
  2: { x: 670, y:  80, kind: 'gen',  label: 'G2' },
  3: { x: 400, y: 480, kind: 'gen',  label: 'G3' },
  4: { x: 130, y: 200, kind: 'bus',  label: '4'  },
  5: { x: 280, y: 280, kind: 'load', label: '5'  },
  6: { x: 130, y: 360, kind: 'load', label: '6'  },
  7: { x: 670, y: 200, kind: 'bus',  label: '7'  },
  8: { x: 520, y: 280, kind: 'load', label: '8'  },
  9: { x: 400, y: 360, kind: 'bus',  label: '9'  },
}

const XFORMERS = [{ from: 1, to: 4 }, { from: 2, to: 7 }, { from: 3, to: 9 }]
const LINES: { id: string; from: number; to: number }[] = [
  { id: 'L4-5', from: 4, to: 5 },
  { id: 'L4-6', from: 4, to: 6 },
  { id: 'L5-7', from: 5, to: 7 },
  { id: 'L6-9', from: 6, to: 9 },
  { id: 'L7-8', from: 7, to: 8 },
  { id: 'L8-9', from: 8, to: 9 },
]
const RATED_I_KA = 0.9

// ── Colour helpers ────────────────────────────────────────────────────────────
function voltageColor(v: number): string {
  if (v < 0.5)  return '#ef4444'   // red — severe
  if (v < 0.85) return '#f97316'   // orange — warning
  if (v < 0.95) return '#fbbf24'   // amber — marginal
  if (v > 1.05) return '#fbbf24'
  return '#34d399'                  // green — normal
}

function currentColor(i: number): string {
  const ratio = i / RATED_I_KA
  if (ratio > 2.0) return '#ef4444'
  if (ratio > 1.5) return '#f97316'
  if (ratio > 1.0) return '#fbbf24'
  return '#38bdf8'
}

// ── Animated value display ────────────────────────────────────────────────────
function AnimVal({ target, unit, decimals = 3 }: { target: number; unit: string; decimals?: number }) {
  const [displayed, setDisplayed] = useState(target)
  const rafRef = useRef<number>(0)
  const startRef = useRef({ from: target, to: target, t0: 0 })

  useEffect(() => {
    const from = displayed
    startRef.current = { from, to: target, t0: performance.now() }
    const duration = 400
    const animate = (now: number) => {
      const elapsed = now - startRef.current.t0
      const p = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplayed(startRef.current.from + (startRef.current.to - startRef.current.from) * ease)
      if (p < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return <span>{displayed.toFixed(decimals)}{unit}</span>
}

// ── Main component ────────────────────────────────────────────────────────────
export function PowerFlow() {
  const [physics, setPhysics]     = useState<PhysicsData | null>(null)
  const [loadErr, setLoadErr]     = useState(false)
  const [hoverLine, setHoverLine] = useState<string | null>(null)
  const [activeLine, setActiveLine] = useState<string | null>(null)
  const [faultType, setFaultType] = useState<FaultClass | null>(null)

  useEffect(() => {
    fetch('/physics.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setPhysics)
      .catch(() => setLoadErr(true))
  }, [])

  function reset() {
    setActiveLine(null)
    setFaultType(null)
  }

  const scenario: Scenario | null = activeLine && faultType && physics
    ? physics.faults[activeLine]?.[faultType] ?? null
    : null

  const busV: BusState   = scenario?.bus_voltages  ?? physics?.pre_fault.bus_voltages  ?? {}
  const lineI: LineState = scenario?.line_currents  ?? physics?.pre_fault.line_currents ?? {}

  // Animated midpoint for active fault marker
  const activeLineObj = activeLine ? LINES.find(l => l.id === activeLine) : null
  const activeMid = activeLineObj ? {
    x: (BUS_POS[activeLineObj.from].x + BUS_POS[activeLineObj.to].x) / 2,
    y: (BUS_POS[activeLineObj.from].y + BUS_POS[activeLineObj.to].y) / 2,
  } : null

  return (
    <section id="powerflow" className="py-24 px-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <Badge variant="secondary" className="mb-4 font-mono text-xs">Power Systems Physics</Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Live Power Flow Analysis
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base leading-relaxed">
          Precomputed using pandapower Z-bus fault analysis on the WSCC 9-bus benchmark.
          Click a transmission line, select a fault type, and watch bus voltages and line currents
          respond in real time.
        </p>
      </motion.div>

      {loadErr && (
        <div className="text-center text-sm text-red-400 mb-8">
          physics.json not found — run <code className="bg-zinc-800 px-1 rounded">make precompute</code> and redeploy.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── LEFT: SVG diagram (3 cols) ── */}
        <div className="lg:col-span-3 rounded-xl bg-zinc-900 border border-white/7 p-4">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-xs text-zinc-500 font-mono">
              {scenario ? `Fault: ${activeLine}/${faultType} — ${scenario.fault_current_ka.toFixed(2)} kA` : 'WSCC 9-Bus — Steady State'}
            </span>
            {activeLine && (
              <button onClick={reset} className="text-xs text-zinc-400 hover:text-zinc-200">
                ✕ Reset
              </button>
            )}
          </div>

          <svg viewBox="0 0 800 540" className="w-full h-auto select-none">
            <defs>
              <filter id="pfGlow">
                <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Transformers */}
            {XFORMERS.map(({ from, to }) => {
              const a = BUS_POS[from], b = BUS_POS[to]
              return (
                <g key={`xf${from}`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke="#3f3f46" strokeWidth={2} strokeDasharray="4 3" />
                  <circle cx={(a.x+b.x)/2-6} cy={(a.y+b.y)/2} r={5}
                          fill="none" stroke="#52525b" strokeWidth={1.5} />
                  <circle cx={(a.x+b.x)/2+6} cy={(a.y+b.y)/2} r={5}
                          fill="none" stroke="#52525b" strokeWidth={1.5} />
                </g>
              )
            })}

            {/* Transmission lines */}
            {LINES.map(line => {
              const a = BUS_POS[line.from], b = BUS_POS[line.to]
              const isHover    = hoverLine === line.id
              const isActive   = activeLine === line.id
              const isOverload = scenario?.affected_lines.includes(line.id) ?? false
              const i_ka       = lineI[line.id] ?? 0
              const lColor     = currentColor(i_ka)
              const midX = (a.x + b.x) / 2
              const midY = (a.y + b.y) / 2

              return (
                <g key={line.id}>
                  {/* Wide invisible hit target */}
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="transparent" strokeWidth={22}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoverLine(line.id)}
                    onMouseLeave={() => setHoverLine(null)}
                    onClick={() => { setActiveLine(line.id); setFaultType(null) }}
                  />
                  {/* Visible line */}
                  <motion.line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={isOverload ? '#ef4444' : isActive ? '#f97316' : isHover ? '#38bdf8' : lColor}
                    strokeWidth={isActive || isOverload ? 4 : isHover ? 3 : 2}
                    filter={isOverload || isActive ? 'url(#pfGlow)' : undefined}
                    style={{ pointerEvents: 'none' }}
                    animate={isActive ? {
                      strokeDasharray: ['0 0', '8 4', '0 0'],
                      strokeDashoffset: [0, -20, -40],
                    } : {}}
                    transition={isActive ? { duration: 1.2, repeat: Infinity, ease: 'linear' } : {}}
                  />
                  {/* Current label */}
                  <text x={midX} y={midY - 9} fontSize={9} fontFamily="monospace"
                        fill={lColor} textAnchor="middle" style={{ pointerEvents: 'none' }}>
                    {i_ka > 0 ? `${i_ka.toFixed(2)}kA` : line.id}
                  </text>
                  {/* Overload badge */}
                  {isOverload && (
                    <text x={midX} y={midY + 16} fontSize={8} fontFamily="monospace"
                          fill="#ef4444" textAnchor="middle" fontWeight="bold">
                      OVERLOAD
                    </text>
                  )}
                </g>
              )
            })}

            {/* Buses + voltage labels */}
            {(Object.entries(BUS_POS) as [string, typeof BUS_POS[number]][]).map(([id, b]) => {
              const v     = busV[id] ?? 1.0
              const vColor = voltageColor(v)
              const isGen  = b.kind === 'gen'
              const isLoad = b.kind === 'load'
              return (
                <g key={id}>
                  {isGen ? (
                    <>
                      <circle cx={b.x} cy={b.y} r={22} fill="#18181b"
                              stroke="#34d399" strokeWidth={2} />
                      <text x={b.x} y={b.y+4} fontSize={13} fontFamily="monospace"
                            fill="#34d399" textAnchor="middle" fontWeight="bold">{b.label}</text>
                    </>
                  ) : isLoad ? (
                    <>
                      <rect x={b.x-20} y={b.y-10} width={40} height={20} rx={3}
                            fill="#18181b" stroke={vColor} strokeWidth={1.5} />
                      <text x={b.x} y={b.y+4} fontSize={11} fontFamily="monospace"
                            fill={vColor} textAnchor="middle" fontWeight="bold">{b.label}</text>
                      <path d={`M ${b.x} ${b.y+11} l 0 7 m -4 -3 l 4 3 l 4 -3`}
                            stroke={vColor} strokeWidth={1.5} fill="none" />
                    </>
                  ) : (
                    <>
                      <rect x={b.x-18} y={b.y-9} width={36} height={18} rx={3}
                            fill="#18181b" stroke={vColor} strokeWidth={1.5} />
                      <text x={b.x} y={b.y+4} fontSize={11} fontFamily="monospace"
                            fill={vColor} textAnchor="middle" fontWeight="bold">{b.label}</text>
                    </>
                  )}
                  {/* Voltage label */}
                  <text x={b.x} y={b.y + (isGen ? 34 : 30)} fontSize={9} fontFamily="monospace"
                        fill={vColor} textAnchor="middle">
                    {v.toFixed(3)} pu
                  </text>
                </g>
              )
            })}

            {/* Fault marker */}
            <AnimatePresence>
              {activeMid && faultType && (
                <motion.g
                  key={`${activeLine}-${faultType}`}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                >
                  <motion.circle
                    cx={activeMid.x} cy={activeMid.y} r={18}
                    fill="#ef444420"
                    animate={{ r: [12, 26, 12], opacity: [0.9, 0.3, 0.9] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <text x={activeMid.x} y={activeMid.y+5} fontSize={16} textAnchor="middle">⚡</text>
                </motion.g>
              )}
            </AnimatePresence>
          </svg>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 justify-center mt-2 text-[10px] text-zinc-500">
            <span><span className="text-emerald-400">■</span> Normal (0.95–1.05 pu)</span>
            <span><span className="text-amber-400">■</span> Warning (&lt;0.95 / &gt;1.05)</span>
            <span><span className="text-orange-400">■</span> Alert (&lt;0.85)</span>
            <span><span className="text-red-400">■</span> Critical (&lt;0.5)</span>
            <span><span className="text-sky-400">─</span> Normal current</span>
            <span><span className="text-red-400">─</span> Overcurrent</span>
          </div>
        </div>

        {/* ── RIGHT: Controls + data panel (2 cols) ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Step 1 */}
          <div className="rounded-xl bg-zinc-900 border border-white/7 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                activeLine ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
              }`}>1</div>
              <span className="text-sm font-medium">Select transmission line</span>
            </div>
            <p className="text-xs text-zinc-500 ml-8">
              {activeLine
                ? <span className="text-emerald-400">✓ {activeLine}</span>
                : 'Click a solid line in the diagram'}
            </p>
          </div>

          {/* Step 2 */}
          <div className={`rounded-xl bg-zinc-900 border p-5 transition-opacity ${activeLine ? 'border-white/7 opacity-100' : 'border-white/5 opacity-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                faultType ? 'bg-emerald-500/20 text-emerald-400' : activeLine ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-800 text-zinc-500'
              }`}>2</div>
              <span className="text-sm font-medium">Apply fault type</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 ml-8">
              {FAULT_CLASSES.filter(f => f !== 'NF').map(f => {
                const cat = Object.values(FAULT_CATEGORIES).find(c => c.classes.includes(f))
                return (
                  <button
                    key={f}
                    disabled={!activeLine}
                    onClick={() => setFaultType(f)}
                    className={`px-1 py-1.5 rounded-md text-xs font-mono font-bold border transition-all ${
                      faultType === f
                        ? 'text-white'
                        : activeLine
                          ? 'border-white/10 bg-zinc-800/50 text-zinc-300 hover:border-white/20'
                          : 'border-white/5 bg-zinc-900 text-zinc-600 cursor-not-allowed'
                    }`}
                    style={faultType === f ? { borderColor: cat?.color, backgroundColor: cat?.color + '20', color: cat?.color } : {}}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 3: Live readings */}
          <div className={`rounded-xl bg-zinc-900 border p-5 transition-opacity ${physics ? 'border-white/7 opacity-100' : 'border-white/5 opacity-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center bg-zinc-800 text-zinc-400">3</div>
              <span className="text-sm font-medium">Live readings</span>
            </div>

            <div className="ml-8 space-y-3">
              {scenario && (
                <motion.div
                  key={`${activeLine}-${faultType}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-500/8 border border-red-500/20 mb-3"
                >
                  <div className="text-xs text-red-300 font-mono font-bold mb-1">
                    ⚡ {activeLine} · {faultType} fault
                  </div>
                  <div className="text-2xl font-black font-mono text-red-400">
                    {scenario.fault_current_ka.toFixed(2)} kA
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">fault current</div>
                  {scenario.affected_lines.length > 0 && (
                    <div className="text-[10px] text-orange-400 mt-1">
                      Overcurrent: {scenario.affected_lines.join(', ')}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Bus voltage table */}
              <div>
                <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Bus Voltages</div>
                <div className="grid grid-cols-3 gap-1">
                  {Object.entries(busV)
                    .filter(([id]) => ![1,2,3].includes(+id))   // skip gen buses for readability
                    .map(([id, v]) => (
                      <div key={id} className="flex items-baseline gap-1 text-xs font-mono">
                        <span className="text-zinc-500 w-5">B{id}</span>
                        <span style={{ color: voltageColor(v) }}>
                          <AnimVal target={v} unit="" decimals={3} />
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Line current table */}
              <div>
                <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Line Currents</div>
                <div className="space-y-0.5">
                  {Object.entries(lineI).map(([id, i]) => (
                    <div key={id} className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="text-zinc-500 w-10">{id}</span>
                      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: currentColor(i) }}
                          animate={{ width: `${Math.min((i / (RATED_I_KA * 2)) * 100, 100)}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                      <span style={{ color: currentColor(i) }} className="w-16 text-right">
                        <AnimVal target={i} unit=" kA" decimals={3} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {activeLine && (
            <Button variant="outline" size="sm" className="w-full" onClick={reset}>
              Restore steady state
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
