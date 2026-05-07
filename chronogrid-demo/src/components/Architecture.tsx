import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Play, RotateCcw } from 'lucide-react'

const LAYERS = [
  { id: 'input',  label: 'Input',          sub: '227×227',           color: '#94a3b8', bg: '#1e293b', group: 'input'  },
  { id: 'cnn1',   label: 'Conv1D',         sub: '227→64 k=3',        color: '#38bdf8', bg: '#0c1a2e', group: 'cnn'   },
  { id: 'cnn2',   label: 'Conv1D',         sub: '64→128 k=5',        color: '#60c8f5', bg: '#0c1a2e', group: 'cnn'   },
  { id: 'cnn3',   label: 'Conv1D',         sub: '128→256 k=3',       color: '#93d8f9', bg: '#0c1a2e', group: 'cnn'   },
  { id: 'bilstm', label: 'BiLSTM',         sub: '256→128 ×2 (↔)',    color: '#34d399', bg: '#052e1e', group: 'bi'    },
  { id: 'attn',   label: 'Self-Attention', sub: 'd=256, h=4',        color: '#f472b6', bg: '#2a0a1e', group: 'attn'  },
  { id: 'pool',   label: 'AvgPool',        sub: '[56,256]→[256]',    color: '#a78bfa', bg: '#1a0e2e', group: 'pool'  },
  { id: 'fc',     label: 'FC Head',        sub: '256→128→11',        color: '#fbbf24', bg: '#1f1500', group: 'fc'    },
  { id: 'output', label: 'Output',         sub: '11 classes',        color: '#fb923c', bg: '#1a0a00', group: 'out'   },
]

const GROUP_LABELS: Record<string, string> = {
  input: 'Input',
  cnn:   '1D CNN ×3',
  bi:    'BiLSTM',
  attn:  'Self-Attention',
  pool:  'Pooling',
  fc:    'FC Head',
  out:   'Output',
}

const CARDS = [
  {
    title: '1D CNN Backbone',
    color: '#38bdf8',
    desc: 'Three Conv1d blocks extract multi-scale frequency features from the 227-row S-transform heatmap, treating each row as a channel over 227 time steps.',
    specs: ['Conv1d(227→64, k=3)', 'Conv1d(64→128, k=5) + MaxPool', 'Conv1d(128→256, k=3) + MaxPool', 'Output: [B, 256, 56]'],
  },
  {
    title: 'Bidirectional LSTM',
    color: '#34d399',
    desc: 'Two-layer BiLSTM processes the CNN feature sequence in forward and backward directions simultaneously, capturing long-range temporal dependencies across the 56 time steps.',
    specs: ['LSTM hidden=128 × 2 directions', '2 stacked layers, dropout=0.3', 'Fwd + Bwd outputs concatenated', 'Output: [B, 56, 256]'],
  },
  {
    title: 'Self-Attention',
    color: '#f472b6',
    desc: 'Multi-head self-attention reweights the 56-step BiLSTM sequence so the network can focus on the most diagnostic time-frequency regions of each fault signature.',
    specs: ['Multi-head attention (h=4)', 'd_model = 256', 'Residual + LayerNorm', 'Output: [B, 56, 256]'],
  },
  {
    title: 'Classification Head',
    color: '#fbbf24',
    desc: 'Global average pooling collapses the attended sequence, then a two-layer FC head maps to 11 fault-class logits for final softmax prediction.',
    specs: ['Global AvgPool → [B, 256]', 'Dropout(0.3)', 'Linear(256→128) + ReLU', 'Linear(128→11) → Softmax'],
  },
]

// ── per-block delay in the forward pass animation (ms) ────────────────────
const PULSE_DELAYS = [0, 700, 1350, 2000, 2750, 3450, 4200, 5000, 5800]
const PULSE_DUR    = 900

function PipelineBlock({
  layer, index, total, pulsing,
}: {
  layer: typeof LAYERS[0]
  index: number
  total: number
  pulsing: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ delay: index * 0.07, duration: 0.45, ease: 'easeOut' as const }}
        whileHover={{ scale: 1.06, y: -3 }}
        className="relative flex flex-col items-center px-3 py-2.5 rounded-lg border text-center cursor-default min-w-[80px] transition-shadow duration-300"
        style={{
          background: layer.bg,
          borderColor: pulsing ? layer.color + 'cc' : layer.color + '40',
          boxShadow: pulsing
            ? `0 0 24px ${layer.color}80, 0 0 6px ${layer.color}40`
            : `0 0 10px ${layer.color}15`,
        }}
      >
        {/* animated top border sweep */}
        <AnimatePresence>
          {pulsing && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' as const }}
              className="absolute top-0 left-0 right-0 h-0.5 rounded-t-lg origin-left"
              style={{ background: layer.color }}
            />
          )}
        </AnimatePresence>

        <span
          className="text-[10px] font-semibold leading-tight transition-colors duration-200"
          style={{ color: pulsing ? '#fff' : layer.color }}
        >
          {layer.label}
        </span>
        <span className="text-[9px] text-zinc-500 mt-0.5 font-mono leading-tight">{layer.sub}</span>

        {/* pulse glow dot */}
        <AnimatePresence>
          {pulsing && (
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{}}
              transition={{ duration: 0.5, ease: 'easeOut' as const }}
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{ background: layer.color + '30' }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* connector arrow */}
      {index < total - 1 && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.07 + 0.12, duration: 0.28 }}
          className="relative h-px w-6 shrink-0 overflow-visible"
          style={{
            background: `linear-gradient(90deg, ${LAYERS[index].color}50, ${LAYERS[index+1]?.color ?? '#fff'}20)`,
          }}
        >
          {/* data token travels along this connector */}
          <AnimatePresence>
            {pulsing && (
              <motion.div
                key={`token-${index}`}
                initial={{ left: 0, opacity: 1, scale: 1 }}
                animate={{ left: '100%', opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.35, ease: 'easeIn' as const, delay: 0.2 }}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{
                  background: LAYERS[index].color,
                  boxShadow: `0 0 8px ${LAYERS[index].color}`,
                  position: 'absolute',
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

export function Architecture() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const inView     = useInView(sectionRef, { once: true, margin: '-80px' })

  const [pulsingIdx, setPulsingIdx] = useState<number | null>(null)
  const [animating,  setAnimating]  = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }

  const runAnimation = useCallback(() => {
    if (animating) return
    clearTimers()
    setAnimating(true)
    setPulsingIdx(null)

    LAYERS.forEach((_, idx) => {
      const t = setTimeout(() => {
        setPulsingIdx(idx)
        const clear = setTimeout(() => setPulsingIdx(p => p === idx ? null : p), PULSE_DUR)
        timersRef.current.push(clear)
      }, PULSE_DELAYS[idx])
      timersRef.current.push(t)
    })

    // done
    const total = PULSE_DELAYS[LAYERS.length - 1] + PULSE_DUR + 300
    const done = setTimeout(() => setAnimating(false), total)
    timersRef.current.push(done)
  }, [animating])

  const resetAnimation = () => {
    clearTimers()
    setPulsingIdx(null)
    setAnimating(false)
  }

  return (
    <section id="architecture" className="py-24 px-6 max-w-7xl mx-auto">

      {/* section header */}
      <motion.div
        ref={sectionRef}
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <Badge variant="secondary" className="mb-4 font-mono text-xs">Model Architecture</Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          1D CNN + BiLSTM + Self-Attention
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base leading-relaxed">
          The ChronoGrid FusionNet architecture integrates a 1D Convolutional Neural Network,
          a Bidirectional LSTM, and a Self-Attention mechanism. S-transform heatmaps flow through
          the CNN for local feature extraction, the BiLSTM for forward + backward temporal context,
          and self-attention to weight the most diagnostic time-frequency regions before classification.
        </p>
      </motion.div>

      {/* ── pipeline diagram ─────────────────────────────────────────── */}
      <div className="mb-5 rounded-2xl bg-zinc-900/50 border border-white/5 overflow-hidden">

        {/* group labels bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex items-center gap-px px-6 pt-4 pb-2 border-b border-white/5 overflow-x-auto"
        >
          {/* rough alignment labels */}
          {(['input','cnn','cnn','cnn','bi','attn','pool','fc','out'] as const).map((g, i) => (
            <div key={i} className="min-w-[80px] flex justify-center">
              {i === 0 || LAYERS[i].group !== LAYERS[i-1].group ? (
                <span
                  className="text-[9px] uppercase tracking-widest font-medium"
                  style={{ color: LAYERS[i].color + 'aa' }}
                >
                  {GROUP_LABELS[g]}
                </span>
              ) : null}
            </div>
          ))}
          {/* spacers for connectors */}
          {Array.from({ length: 8 }).map((_, i) => <div key={`sp${i}`} className="w-7 shrink-0" />)}
        </motion.div>

        {/* blocks row */}
        <div className="px-6 py-6 overflow-x-auto">
          <div className="flex items-center justify-start gap-1 min-w-max mx-auto w-fit">
            {LAYERS.map((layer, i) => (
              <PipelineBlock
                key={layer.id}
                layer={layer}
                index={i}
                total={LAYERS.length}
                pulsing={pulsingIdx === i}
              />
            ))}
          </div>
        </div>

        {/* controls + annotation */}
        <div className="px-6 pb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div className="w-3 h-px bg-emerald-400/50" />
            <span>BiLSTM runs forward + backward in parallel · Self-Attention reweights the sequence</span>
            <div className="w-3 h-px bg-pink-400/50" />
          </div>
          <div className="flex gap-2">
            {animating ? (
              <Button size="sm" variant="ghost" onClick={resetAnimation}>
                <RotateCcw className="w-3.5 h-3.5" />Reset
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={runAnimation}>
                <Play className="w-3.5 h-3.5" />Animate Data Flow
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* step-by-step caption */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="flex flex-wrap justify-center gap-2 mb-16 px-2"
      >
        {LAYERS.map((l, i) => (
          <div key={l.id} className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: pulsingIdx === i ? l.color : l.color + '60' }}
            />
            <span
              className="text-[10px] font-mono transition-colors duration-200"
              style={{ color: pulsingIdx === i ? l.color : '#52525b' }}
            >
              {l.label}
            </span>
            {i < LAYERS.length - 1 && <span className="text-zinc-700 text-[10px]">→</span>}
          </div>
        ))}
      </motion.div>

      {/* ── detail cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {CARDS.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            whileHover={{ y: -4 }}
          >
            <Card className="h-full bg-zinc-900 border-white/7 hover:border-white/12 transition-all duration-300 hover:shadow-lg"
              style={{ ['--hover-shadow' as string]: `0 8px 30px ${card.color}15` }}
            >
              <CardHeader className="pb-3">
                <motion.div
                  className="w-10 h-1 rounded-full mb-3"
                  style={{ background: card.color }}
                  whileHover={{ width: '100%' }}
                  transition={{ duration: 0.4 }}
                />
                <CardTitle className="text-base">{card.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">{card.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {card.specs.map((s, si) => (
                    <motion.li
                      key={s}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 + si * 0.06, duration: 0.35 }}
                      className="flex items-start gap-2 text-xs text-zinc-500 font-mono"
                    >
                      <span style={{ color: card.color }} className="mt-0.5 shrink-0">›</span>
                      {s}
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
