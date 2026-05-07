import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  predictUpload, loadSample,
  FAULT_CLASSES, FAULT_CATEGORIES,
  type FaultClass, type PredictionResult,
} from '@/lib/api'
import {
  Upload, Zap, CheckCircle2, XCircle,
  RefreshCw, ImageIcon, ChevronRight, Waves,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Canvas-based Gaussian noise injection ────────────────────────────────────
function applyNoiseToBase64(base64: string, std: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas  = document.createElement('canvas')
      canvas.width  = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d    = data.data
      for (let i = 0; i < d.length; i += 4) {
        // scale by 60 (not 255) so σ=0.10 ≈ 6px std — subtle but visible;
        // σ=0.50 ≈ 30px std — heavy noise that still lets the model partially classify
        const n = gaussianRand() * std * 60
        d[i]     = Math.max(0, Math.min(255, d[i]     + n))
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
      }
      ctx.putImageData(data, 0, 0)
      canvas.toBlob(b => b ? resolve(b) : reject('toBlob failed'), 'image/jpeg', 0.95)
    }
    img.onerror = reject
    img.src = base64
  })
}

function gaussianRand() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function getColor(fault: FaultClass) {
  const cat = Object.values(FAULT_CATEGORIES).find(c => c.classes.includes(fault))
  return cat?.color ?? '#94a3b8'
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

const ConfTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs">
        <div className="font-mono font-bold text-white mb-0.5">{label}</div>
        <div className="text-zinc-300">{(payload[0].value * 100).toFixed(2)}%</div>
      </div>
    )
  }
  return null
}

export function Simulator() {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [sampleFault, setSampleFault] = useState<FaultClass | null>(null)
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'upload' | 'sample'>('upload')
  const resultRef = useRef<HTMLDivElement>(null)

  // Noise injection
  const [noiseLevel, setNoiseLevel] = useState(0)
  const [originalBase64, setOriginalBase64] = useState<string | null>(null)
  const [applyingNoise, setApplyingNoise] = useState(false)
  const noiseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    setCurrentFile(file)
    setSampleFault(null)
    setResult(null)
    setError(null)
    setNoiseLevel(0)
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    // Read as data URL so noise injection can use it
    const reader = new FileReader()
    reader.onload = e => setOriginalBase64(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
    maxFiles: 1,
    multiple: false,
  })

  async function runPrediction() {
    if (!currentFile && !sampleFault) return
    setLoading(true)
    setError(null)
    try {
      const res = currentFile
        ? await predictUpload(currentFile)
        : await (() => { throw new Error('No file') })()
      setResult(res)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prediction failed. Is the API server running? (`make api`)')
    } finally {
      setLoading(false)
    }
  }

  async function handleSample(fault: FaultClass) {
    setSampleFault(fault)
    setCurrentFile(null)
    setResult(null)
    setError(null)
    setNoiseLevel(0)
    setOriginalBase64(null)
    setLoading(true)
    try {
      const res = await loadSample(fault)
      const b64 = `data:image/jpeg;base64,${res.image_base64}`
      setImagePreview(b64)
      setOriginalBase64(b64)
      setResult(res)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sample. Is the API server running?')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setImagePreview(null)
    setCurrentFile(null)
    setSampleFault(null)
    setResult(null)
    setError(null)
    setNoiseLevel(0)
    setOriginalBase64(null)
  }

  // Re-run inference whenever noise level changes (debounced)
  useEffect(() => {
    if (!originalBase64 || noiseLevel === 0) return
    if (noiseDebounce.current) clearTimeout(noiseDebounce.current)
    noiseDebounce.current = setTimeout(async () => {
      setApplyingNoise(true)
      try {
        const blob         = await applyNoiseToBase64(originalBase64, noiseLevel)
        const noisyDataUrl = URL.createObjectURL(blob)
        setImagePreview(noisyDataUrl)
        const res = await predictUpload(blob)
        setResult(res)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Noise inference failed')
      } finally {
        setApplyingNoise(false)
      }
    }, 350)
  }, [noiseLevel, originalBase64])

  const chartData = result
    ? FAULT_CLASSES.map(f => ({ name: f, conf: result.probabilities[f] }))
    : []

  const isCorrect = result && sampleFault ? result.predicted_class === sampleFault : null

  return (
    <section id="simulator" className="py-24 px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <Badge variant="secondary" className="mb-4 font-mono text-xs">Interactive Demo</Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Fault Detection Simulator
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base leading-relaxed">
          Upload a 227×227 S-transform heatmap or load a sample from the dataset.
          The model will classify the fault type in real time.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ─── LEFT: INPUT ─────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Tab switcher */}
          <div className="flex rounded-lg bg-zinc-900 border border-white/7 p-1 gap-1">
            {(['upload', 'sample'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-2 text-sm rounded-md font-medium transition-all duration-200',
                  activeTab === tab
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {tab === 'upload' ? '↑ Upload Image' : '⚡ Try a Sample'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'upload' ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  {...getRootProps()}
                  className={cn(
                    'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
                    isDragActive
                      ? 'border-sky-400 bg-sky-400/5 scale-[1.01]'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/3'
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-3">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                      isDragActive ? 'bg-sky-400/20' : 'bg-zinc-800'
                    )}>
                      <Upload className={cn('w-5 h-5', isDragActive ? 'text-sky-400' : 'text-zinc-400')} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        {isDragActive ? 'Drop it here' : 'Drop a heatmap or click to browse'}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        JPEG only · 227×227 S-transform heatmap
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="sample"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl bg-zinc-900 border border-white/7 p-5"
              >
                <p className="text-xs text-zinc-500 mb-4">
                  Click any fault class to load a real sample from the WSCC 9-bus dataset and run inference:
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {FAULT_CLASSES.map(fault => (
                    <button
                      key={fault}
                      onClick={() => { setActiveTab('sample'); handleSample(fault) }}
                      disabled={loading}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono font-semibold transition-all duration-150',
                        sampleFault === fault
                          ? 'border-sky-400/60 bg-sky-400/10 text-sky-300'
                          : 'border-white/8 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white hover:border-white/15',
                        loading && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span>{fault}</span>
                      <ChevronRight className="w-3 h-3 opacity-50" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preview + Run */}
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-zinc-900 border border-white/7 p-4 flex flex-col gap-4"
            >
              <div className="flex items-start gap-4">
                <img
                  src={imagePreview}
                  alt="Heatmap preview"
                  className="w-20 h-20 rounded-lg object-cover border border-white/10 shrink-0"
                  style={{ filter: noiseLevel > 0 ? `contrast(${1 + noiseLevel * 0.3})` : undefined }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 mb-1">
                    {currentFile ? currentFile.name : `Sample: ${sampleFault}`}
                  </p>
                  <p className="text-xs text-zinc-500 mb-3">
                    {currentFile
                      ? `${(currentFile.size / 1024).toFixed(1)} KB · JPEG`
                      : 'Random sample from dataset'}
                  </p>
                  {activeTab === 'upload' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={runPrediction} disabled={loading || !currentFile}>
                        {loading ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Predicting…</>
                        ) : (
                          <><Zap className="w-3.5 h-3.5" />Run Prediction</>
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={reset}>
                        Clear
                      </Button>
                    </div>
                  )}
                  {activeTab === 'sample' && loading && !applyingNoise && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <RefreshCw className="w-3 h-3 animate-spin" />Running inference…
                    </div>
                  )}
                </div>
              </div>

              {/* Noise injection slider — only shown once a sample/image is loaded */}
              {(sampleFault || currentFile) && (
                <div className="border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Waves className="w-3.5 h-3.5 text-pink-400" />
                      <span>Gaussian Noise</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {applyingNoise && (
                        <RefreshCw className="w-3 h-3 animate-spin text-pink-400" />
                      )}
                      <span
                        className="text-xs font-mono tabular-nums"
                        style={{ color: noiseLevel > 0 ? '#f472b6' : '#52525b' }}
                      >
                        σ = {noiseLevel.toFixed(2)}
                      </span>
                      {noiseLevel > 0 && (
                        <button
                          onClick={() => {
                            setNoiseLevel(0)
                            if (originalBase64) {
                              setImagePreview(originalBase64)
                            }
                          }}
                          className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors ml-1"
                        >
                          reset
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.01}
                    value={noiseLevel}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      setNoiseLevel(v)
                      if (v === 0 && originalBase64) setImagePreview(originalBase64)
                    }}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(90deg, #f472b6 ${noiseLevel / 0.5 * 100}%, rgba(255,255,255,0.1) ${noiseLevel / 0.5 * 100}%)`,
                    }}
                  />
                  <div className="flex justify-between text-[9px] text-zinc-700 mt-1">
                    <span>No noise</span>
                    <span>Heavy noise</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-lg bg-red-500/8 border border-red-500/20 px-4 py-3 text-xs text-red-400"
            >
              {error}
            </motion.div>
          )}
        </div>

        {/* ─── RIGHT: RESULTS ──────────────────────────────── */}
        <div ref={resultRef}>
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[360px] rounded-xl border-2 border-dashed border-white/8 flex flex-col items-center justify-center gap-3 text-center p-8"
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500">
                  Results will appear here after prediction.
                </p>
                <p className="text-xs text-zinc-600">
                  Upload a heatmap or click a sample class →
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-4"
              >
                {/* Prediction badge */}
                <Card
                  className={cn(
                    'border transition-all duration-500',
                    isCorrect === true  && 'border-emerald-400/30 shadow-lg shadow-emerald-400/10',
                    isCorrect === false && 'border-red-400/30 shadow-lg shadow-red-400/10',
                    isCorrect === null  && 'border-sky-400/20'
                  )}
                >
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Predicted Class</div>
                        <motion.div
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          className="text-5xl font-black font-mono"
                          style={{ color: getColor(result.predicted_class) }}
                        >
                          {result.predicted_class}
                        </motion.div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={getFaultVariant(result.predicted_class) as Parameters<typeof Badge>[0]['variant']} className="text-[10px]">
                            {Object.values(FAULT_CATEGORIES).find(c => c.classes.includes(result.predicted_class))?.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold font-mono text-white">
                          {(result.confidence * 100).toFixed(2)}%
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">confidence</div>
                        <div className="text-xs font-mono text-zinc-600 mt-2">
                          {result.inference_ms}ms
                        </div>

                        {isCorrect !== null && (
                          <div className={cn(
                            'flex items-center gap-1 text-xs mt-2 justify-end',
                            isCorrect ? 'text-emerald-400' : 'text-red-400'
                          )}>
                            {isCorrect
                              ? <><CheckCircle2 className="w-3.5 h-3.5" />Correct</>
                              : <><XCircle className="w-3.5 h-3.5" />Misclassified</>
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Confidence chart */}
                <Card className="bg-zinc-900 border-white/7">
                  <CardContent className="pt-4 pb-3">
                    <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">All Class Confidences</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                        <XAxis
                          type="number"
                          domain={[0, 1]}
                          tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                          tick={{ fill: '#52525b', fontSize: 9 }}
                          axisLine={false} tickLine={false}
                        />
                        <YAxis
                          type="category" dataKey="name" width={36}
                          tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                          axisLine={false} tickLine={false}
                        />
                        <Tooltip content={<ConfTooltip />} />
                        <Bar dataKey="conf" radius={[0, 3, 3, 0]}>
                          {chartData.map(entry => (
                            <Cell
                              key={entry.name}
                              fill={entry.name === result.predicted_class
                                ? getColor(entry.name as FaultClass)
                                : `${getColor(entry.name as FaultClass)}40`}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Button variant="outline" size="sm" onClick={reset} className="w-full">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Run Another Prediction
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </section>
  )
}
