import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { FAULT_CLASSES, FAULT_CATEGORIES, type FaultClass } from '@/lib/api'

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const x   = useMotionValue(0)
  const y   = useMotionValue(0)

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]),  { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]),  { stiffness: 300, damping: 30 })
  const glowX   = useTransform(x, [-0.5, 0.5], ['0%',  '100%'])
  const glowY   = useTransform(y, [-0.5, 0.5], ['0%',  '100%'])

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el   = ref.current!
    const rect = el.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width  - 0.5)
    y.set((e.clientY - rect.top)  / rect.height - 0.5)
  }
  function onLeave() { x.set(0); y.set(0) }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 800 }}
      className={className}
    >
      {/* specular highlight that follows cursor */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-xl z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: useTransform(
            [glowX, glowY],
            ([gx, gy]) => `radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,0.06) 0%, transparent 65%)`
          ),
        }}
      />
      {children}
    </motion.div>
  )
}

const FAULT_INFO: Record<FaultClass, { desc: string }> = {
  AG:   { desc: 'Phase A conductor contacts ground. Most common fault type (~70% of all faults).' },
  BG:   { desc: 'Phase B conductor contacts ground. Similar signature to AG, shifted by 120°.' },
  CG:   { desc: 'Phase C conductor contacts ground. Causes asymmetric current surge on phase C.' },
  AB:   { desc: 'Short circuit between phases A and B. No ground involvement, symmetric distortion.' },
  AC:   { desc: 'Short circuit between phases A and C. Creates complex two-phase interference.' },
  BC:   { desc: 'Short circuit between phases B and C. Hardest phase-to-phase case to localize.' },
  ABG:  { desc: 'Phases A and B short and both contact ground. Complex mixed signature.' },
  ACG:  { desc: 'Phases A and C involved with ground. Causes irregular three-phase imbalance.' },
  BCG:  { desc: 'Phases B and C short to ground. Second most energetic fault category.' },
  ABCG: { desc: 'All three phases short to ground. Symmetric but most severe and damaging fault.' },
  NF:   { desc: 'Normal operating conditions. Clean sinusoidal pattern with no distortion.' },
}

function getFaultVariant(fault: FaultClass) {
  const cat = Object.values(FAULT_CATEGORIES).find(c => c.classes.includes(fault))
  if (!cat) return 'secondary'
  if (cat.label.includes('Single'))  return 'default'
  if (cat.label.includes('Phase-to-Phase')) return 'emerald'
  if (cat.label.includes('Two-Phase')) return 'purple'
  if (cat.label.includes('Three'))   return 'red'
  return 'gold'
}

export function FaultGallery() {
  return (
    <section id="faults" className="py-24 px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-6"
      >
        <Badge variant="secondary" className="mb-4 font-mono text-xs">Dataset</Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          11 Fault Classes
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base leading-relaxed">
          3,000 S-transform heatmap images per class (33,000 total) generated from the WSCC 9-bus
          power system simulation. Each image encodes 227 frequency bins × 227 time steps.
        </p>
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        className="flex flex-wrap justify-center gap-3 mb-12"
      >
        {Object.values(FAULT_CATEGORIES).map(cat => (
          <div key={cat.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
            {cat.label}
          </div>
        ))}
      </motion.div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {FAULT_CLASSES.map((fault, i) => {
          const cat = Object.values(FAULT_CATEGORIES).find(c => c.classes.includes(fault))
          const color = cat?.color ?? '#94a3b8'
          const [imgError, setImgError] = useState(false)
          return (
            <motion.div
              key={fault}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: i * 0.05, duration: 0.45 }}
            >
            <TiltCard className="group relative rounded-xl border border-white/7 bg-zinc-900 overflow-hidden cursor-default h-full"
            >
              {/* Heatmap thumbnail */}
              <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center">
                {!imgError ? (
                  <img
                    src={`/api/dataset/${fault}/1.jpg`}
                    alt={`${fault} S-transform heatmap`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="text-center text-zinc-500">
                    <div className="text-3xl mb-2">📊</div>
                    <div className="text-xs">S-transform<br/>heatmap</div>
                  </div>
                )}
                {/* Colour accent bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: color }}
                />
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xl font-black font-mono"
                    style={{ color }}
                  >{fault}</span>
                  <Badge variant={getFaultVariant(fault) as Parameters<typeof Badge>[0]['variant']} className="text-[10px]">
                    {cat?.label.split(' ')[0]}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {FAULT_INFO[fault].desc}
                </p>
              </div>
            </TiltCard>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
