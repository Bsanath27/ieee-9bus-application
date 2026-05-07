import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, Cpu, Layers, Activity } from 'lucide-react'
import { NeuralCanvas } from '@/components/NeuralCanvas'
import { FaultTicker }  from '@/components/FaultTicker'

const STATS = [
  { icon: Layers,   value: '11',   label: 'Fault Classes',     color: 'text-sky-400' },
  { icon: Cpu,      value: '~1M',  label: 'Parameters',        color: 'text-emerald-400' },
  { icon: Activity, value: '227²', label: 'S-Transform Input', color: 'text-amber-400' },
]

const RESEARCHERS = [
  { name: 'Mariam Ghani',    id: 'RA2211042020017', initials: 'MG', color: '#38bdf8' },
  { name: 'Sanath B S',      id: 'RA2211042020020', initials: 'SB', color: '#34d399' },
  { name: 'Swathika Murugan',id: 'RA2211042020045', initials: 'SM', color: '#a78bfa' },
]

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.55, ease: 'easeOut' as const },
  }),
}

export function Hero() {
  return (
    <section
      id="about"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-14"
    >
      {/* ── 3D interactive background ── */}
      <NeuralCanvas />

      {/* soft radial gradient over the canvas */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-sky-950/60 blur-[100px]" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-zinc-950 to-transparent" />
      </div>

      {/* ── content ── */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">

        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible">
          <Badge variant="secondary" className="mb-6 text-xs px-3 py-1 font-mono">
            IEEE 9-Bus Transmission Line Fault Detection
          </Badge>
        </motion.div>

        <motion.h1
          variants={fadeUp} custom={1} initial="hidden" animate="visible"
          className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6"
        >
          <span className="gradient-text">ChronoGrid</span>
          <br />
          <span className="text-white">FusionNet</span>
        </motion.h1>

        <motion.p
          variants={fadeUp} custom={2} initial="hidden" animate="visible"
          className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          A 1D CNN + BiLSTM + Self-Attention deep learning model that classifies transmission
          line faults from S-transform time-frequency heatmaps with high accuracy.
        </motion.p>

        {/* stat cards */}
        <motion.div
          variants={fadeUp} custom={3} initial="hidden" animate="visible"
          className="flex flex-wrap justify-center gap-4 mb-10"
        >
          {STATS.map(({ icon: Icon, value, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-zinc-900/80 backdrop-blur-sm border border-white/7"
            >
              <Icon className={`w-4 h-4 ${color}`} />
              <div className="text-left">
                <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
                <div className="text-xs text-zinc-500">{label}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          variants={fadeUp} custom={4} initial="hidden" animate="visible"
          className="flex gap-3 justify-center mb-16"
        >
          <Button
            size="lg"
            onClick={() => document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Run a Prediction
          </Button>
          <Button
            size="lg" variant="outline"
            onClick={() => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Explore Architecture
          </Button>
        </motion.div>

        {/* ── Research team ── */}
        <motion.div
          variants={fadeUp} custom={5} initial="hidden" animate="visible"
        >
          <p className="text-xs text-zinc-600 uppercase tracking-widest mb-4">Research Team · SRM Institute of Science and Technology</p>
          <div className="flex flex-wrap justify-center gap-3">
            {RESEARCHERS.map(({ name, id, initials, color }, i) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 + i * 0.1, duration: 0.4, ease: 'easeOut' }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-900/70 backdrop-blur-sm border border-white/7 hover:border-white/15 transition-colors duration-200"
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-zinc-950 shrink-0"
                  style={{ background: color }}
                >
                  {initials}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-zinc-200 leading-tight">{name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{id}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

        {/* ── live fault ticker ── */}
        <motion.div
          variants={fadeUp} custom={6} initial="hidden" animate="visible"
          className="mt-12 w-full max-w-lg mx-auto"
        >
          <FaultTicker />
        </motion.div>

      {/* scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-zinc-600"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
      >
        <span className="text-xs tracking-widest uppercase">Scroll</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </motion.div>
    </section>
  )
}
