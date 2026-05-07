import { useCallback, useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Play, RotateCcw } from 'lucide-react'

type FaultType = 'AG' | 'AB' | 'ABG' | 'NF'

// ── Constants ────────────────────────────────────────────────────────────────
const N        = 300
const F_CYCLES = 5
const FAULT_T  = 0.5
const STFT_W   = 72
const STFT_H   = 56
const ROW_DC   = 0
const ROW_F0   = 10
const ROW_2F   = 20
const ROW_3F   = 30
const ROW_5F   = 44

// ── Physics helpers ──────────────────────────────────────────────────────────

function gen3Phase(ft: FaultType) {
  const faultIdx = Math.floor(N * FAULT_T)
  const Va: number[] = [], Vb: number[] = [], Vc: number[] = []
  for (let i = 0; i < N; i++) {
    const t  = (i / N) * F_CYCLES * 2 * Math.PI
    const va = Math.sin(t)
    const vb = Math.sin(t - (2 * Math.PI) / 3)
    const vc = Math.sin(t + (2 * Math.PI) / 3)
    if (i < faultIdx) { Va.push(va); Vb.push(vb); Vc.push(vc) }
    else {
      const p = (i - faultIdx) / (N - faultIdx)
      if (ft === 'AG') {
        Va.push(0.12 * va + 0.05 * Math.sin(t * 3)); Vb.push(1.15 * vb); Vc.push(1.15 * vc)
      } else if (ft === 'AB') {
        const avg = 0.45 * (va + vb); Va.push(avg); Vb.push(avg); Vc.push(vc)
      } else if (ft === 'ABG') {
        Va.push(0.08 * va); Vb.push(0.08 * vb)
        Vc.push(Math.min(1.4, 1.3 * vc + 0.1 * Math.sin(t * 2) * (1 - p)))
      } else { Va.push(va); Vb.push(vb); Vc.push(vc) }
    }
  }
  return { Va, Vb, Vc, faultIdx }
}

function genSpectrum(ft: FaultType): number[] {
  if (ft === 'AG')  return [0.40, 0.85, 0.05, 0.35, 0.03, 0.18]
  if (ft === 'AB')  return [0.05, 0.80, 0.40, 0.08, 0.22, 0.04]
  if (ft === 'ABG') return [0.35, 0.78, 0.32, 0.28, 0.18, 0.14]
  return [0.01, 1.0, 0.04, 0.04, 0.01, 0.01]
}

function genHeatmap(ft: FaultType): number[][] {
  const faultCol = Math.floor(STFT_W * FAULT_T)
  const cells: number[][] = Array.from({ length: STFT_H }, () => new Array(STFT_W).fill(0))
  const addBand = (rowCenter: number, sigma: number, strength: number, c0 = 0, c1 = STFT_W) => {
    for (let r = 0; r < STFT_H; r++) {
      const e = strength * Math.exp(-((r - rowCenter) ** 2) / (2 * sigma ** 2))
      for (let c = c0; c < c1; c++) cells[r][c] = Math.min(1, cells[r][c] + e + 0.02 * Math.random())
    }
  }
  for (let r = 0; r < STFT_H; r++)
    for (let c = 0; c < STFT_W; c++) cells[r][c] = 0.04 + 0.03 * Math.random()
  addBand(ROW_F0, 1.8, 0.90)
  for (let r = 0; r < STFT_H; r++)
    cells[r][faultCol] = Math.min(1, cells[r][faultCol] + 0.6 * Math.random())
  if (ft === 'AG')  { addBand(ROW_DC, 1.5, 0.80, faultCol); addBand(ROW_3F, 1.8, 0.55, faultCol); addBand(ROW_5F, 1.5, 0.35, faultCol) }
  if (ft === 'AB')  { addBand(ROW_2F, 1.8, 0.65, faultCol); addBand(ROW_DC, 1.2, 0.20, faultCol) }
  if (ft === 'ABG') { addBand(ROW_DC, 1.5, 0.75, faultCol); addBand(ROW_2F, 1.8, 0.50, faultCol); addBand(ROW_3F, 1.8, 0.40, faultCol) }
  return cells
}

function toColor(v: number): [number, number, number] {
  v = Math.max(0, Math.min(1, v))
  if (v < 0.2)  { const t=v/0.2;       return [Math.round(t*10), Math.round(t*80),  Math.round(160+t*80)] }
  if (v < 0.45) { const t=(v-0.2)/0.25; return [Math.round(10+t*30), Math.round(80+t*170), Math.round(240-t*60)] }
  if (v < 0.65) { const t=(v-0.45)/0.2; return [Math.round(40+t*200), Math.round(250-t*30), Math.round(180-t*130)] }
  if (v < 0.85) { const t=(v-0.65)/0.2; return [Math.round(240+t*15), Math.round(220-t*110), Math.round(50-t*40)] }
  const t=(v-0.85)/0.15;                return [255, Math.round(110-t*100), Math.round(10-t*10)]
}
function toCSS(v: number, a=1) { const [r,g,b]=toColor(v); return `rgba(${r},${g},${b},${a})` }

// ── Pre-render heatmap to ImageData ──────────────────────────────────────────
function buildHeatmapImage(cells: number[][]): ImageData {
  const img = new ImageData(STFT_W, STFT_H)
  cells.forEach((row, ri) => row.forEach((v, ci) => {
    const [r,g,b] = toColor(v)
    const idx = (ri * STFT_W + ci) * 4
    img.data[idx]=r; img.data[idx+1]=g; img.data[idx+2]=b; img.data[idx+3]=255
  }))
  return img
}

// ── Panel: Raw Waveform — oscilloscope-style scan dots on each phase ──────────
function WaveformPanel({ active, ft }: { active: boolean; ft: FaultType }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf       = useRef(0)
  const dataRef   = useRef(gen3Phase(ft))

  useEffect(() => { dataRef.current = gen3Phase(ft) }, [ft])

  useEffect(() => {
    let t0: number | null = null

    const loop = (ts: number) => {
      if (!t0) t0 = ts
      const elapsed = (ts - t0) / 1000

      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) { raf.current = requestAnimationFrame(loop); return }

      const W = canvasRef.current!.width
      const H = canvasRef.current!.height
      const { Va, Vb, Vc, faultIdx } = dataRef.current
      const scaleY = (v: number) => H / 2 - v * (H / 2 - 5)
      const xOf    = (i: number) => (i / N) * W
      const faultX = xOf(faultIdx)

      ctx.clearRect(0, 0, W, H)

      // Fault zone tint
      ctx.fillStyle = 'rgba(251,113,133,0.07)'
      ctx.fillRect(faultX, 0, W - faultX, H)

      // Zero line
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke()

      // Fault onset dashed
      ctx.setLineDash([3,3])
      ctx.strokeStyle = 'rgba(251,113,133,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(faultX, 0); ctx.lineTo(faultX, H-12); ctx.stroke()
      ctx.setLineDash([])

      // Scan position: cycles left-to-right over 4 s
      const scanFrac = (elapsed * 0.22) % 1.0
      const scanIdx  = Math.round(scanFrac * (N - 1))
      const scanX    = xOf(scanIdx)

      const phases: [number[], string, string][] = [
        [Va, '#38bdf8', 'Va'],
        [Vb, '#34d399', 'Vb'],
        [Vc, '#fbbf24', 'Vc'],
      ]

      phases.forEach(([pts, color, label]) => {
        // ── dim base line ──────────────────────────────────────────────────
        ctx.strokeStyle = color + '50'
        ctx.lineWidth = 1
        ctx.beginPath()
        pts.forEach((v, i) => {
          const x = xOf(i), y = scaleY(v)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()

        // ── bright trail segment behind scan dot ──────────────────────────
        const trailLen = Math.round(N * 0.10)
        const trailStart = Math.max(0, scanIdx - trailLen)
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = trailStart; i <= scanIdx; i++) {
          const alpha = (i - trailStart) / (scanIdx - trailStart + 1)
          // Use shadow for glow on the last portion
          if (i === trailStart) ctx.moveTo(xOf(i), scaleY(pts[i]))
          else ctx.lineTo(xOf(i), scaleY(pts[i]))
        }
        ctx.shadowColor = color
        ctx.shadowBlur  = 6
        ctx.stroke()
        ctx.shadowBlur = 0

        // ── glowing dot at scan tip ────────────────────────────────────────
        const dotY = scaleY(pts[scanIdx])
        const grd = ctx.createRadialGradient(scanX, dotY, 0, scanX, dotY, 7)
        grd.addColorStop(0, color + 'ff')
        grd.addColorStop(0.4, color + 'aa')
        grd.addColorStop(1, color + '00')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(scanX, dotY, 7, 0, 2 * Math.PI)
        ctx.fill()

        // Phase label on right edge
        ctx.fillStyle = color
        ctx.font = 'bold 9px monospace'
        ctx.fillText(label, W - 20, scaleY(pts[N - 1]) + 3)
      })

      // fault label
      ctx.fillStyle = 'rgba(251,113,133,0.65)'
      ctx.font = '8px monospace'
      ctx.fillText('fault', faultX + 3, 10)

      raf.current = requestAnimationFrame(loop)
    }

    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  return (
    <canvas ref={canvasRef} width={280} height={120} className="w-full rounded-lg"
      style={{ opacity: active ? 1 : 0.22, transition: 'opacity 0.5s' }} />
  )
}

// ── Panel: FFT Spectrum — bars breathe with per-bar jitter ────────────────────
function SpectrumPanel({ active, ft }: { active: boolean; ft: FaultType }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const raf        = useRef(0)
  const targetRef  = useRef(genSpectrum(ft))

  useEffect(() => { targetRef.current = genSpectrum(ft) }, [ft])

  useEffect(() => {
    let t0: number | null = null

    const loop = (ts: number) => {
      if (!t0) t0 = ts
      const elapsed = (ts - t0) / 1000

      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) { raf.current = requestAnimationFrame(loop); return }

      const W = canvasRef.current!.width
      const H = canvasRef.current!.height
      ctx.clearRect(0, 0, W, H)

      const labels  = ['DC', 'f₀', '2f₀', '3f₀', '4f₀', '5f₀']
      const BASE_H  = 18
      const PLOT_H  = H - BASE_H - 4
      const barW    = W / labels.length
      const targets = targetRef.current

      targets.forEach((mag, i) => {
        // Per-bar oscillation: fundamentally stable, others flutter more
        const jitter = i === 1 ? 0.015 : 0.04
        const speed  = i === 1 ? 1.2   : 2.5 + i * 0.4
        const animMag = Math.max(0, mag * (1 + jitter * Math.sin(elapsed * speed + i * 1.1)))
        const barH   = Math.max(2, animMag * PLOT_H)
        const isNormal = mag < 0.07

        // Bar fill
        const color = i === 1 ? '#38bdf8' : isNormal ? 'rgba(56,189,248,0.22)' : '#f472b6'
        const x = i * barW + 3, y = PLOT_H - barH + 2, bw = barW - 6

        ctx.fillStyle = color + '33'
        ctx.fillRect(x, y, bw, barH)

        // Bright cap on top
        const capGrd = ctx.createLinearGradient(0, y, 0, y + 4)
        capGrd.addColorStop(0, color)
        capGrd.addColorStop(1, color + '00')
        ctx.fillStyle = capGrd
        ctx.fillRect(x, y, bw, 4)

        // Glow for prominent bars
        if (animMag > 0.12) {
          ctx.shadowColor = color
          ctx.shadowBlur  = 12
          ctx.fillStyle   = color + '55'
          ctx.fillRect(x, y, bw, barH)
          ctx.shadowBlur  = 0
        }

        // X label
        ctx.fillStyle = i === 1 ? '#38bdf8' : isNormal ? '#3f3f46' : '#f472b6'
        ctx.font = '8px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(labels[i], i * barW + barW / 2, H - 4)
      })

      ctx.textAlign = 'left'
      ctx.fillStyle = '#3f3f46'
      ctx.font = '7px monospace'
      ctx.fillText('|X(f)|', 2, 10)

      raf.current = requestAnimationFrame(loop)
    }

    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  return (
    <canvas ref={canvasRef} width={280} height={120} className="w-full rounded-lg"
      style={{ opacity: active ? 1 : 0.22, transition: 'opacity 0.5s' }} />
  )
}

// ── Panel: S-Transform — vertical scan cursor sweeps across the heatmap ───────
function HeatmapPanel({ active, ft, heatmap }: { active: boolean; ft: FaultType; heatmap: number[][] }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const raf        = useRef(0)
  const imgRef     = useRef<ImageData | null>(null)
  const offRef     = useRef<HTMLCanvasElement | null>(null)

  // Rebuild cached heatmap image when ft changes
  useEffect(() => {
    const img = buildHeatmapImage(heatmap)
    imgRef.current = img
    // Draw to tiny offscreen canvas for drawImage scaling
    const off = document.createElement('canvas')
    off.width  = STFT_W
    off.height = STFT_H
    off.getContext('2d')!.putImageData(img, 0, 0)
    offRef.current = off
  }, [heatmap])

  useEffect(() => {
    let t0: number | null = null

    const loop = (ts: number) => {
      if (!t0) t0 = ts
      const elapsed = (ts - t0) / 1000

      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx || !offRef.current) { raf.current = requestAnimationFrame(loop); return }

      const W = canvasRef.current!.width
      const H = canvasRef.current!.height
      const LABEL_W = 22, LABEL_H = 12
      const plotW   = W - LABEL_W
      const plotH   = H - LABEL_H
      const cW      = plotW / STFT_W
      const cH      = plotH / STFT_H

      ctx.clearRect(0, 0, W, H)

      // ── Draw heatmap via scaled offscreen canvas ───────────────────────
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(offRef.current, LABEL_W, 0, plotW, plotH)

      // ── Frequency row tick lines + labels ─────────────────────────────
      const freqLabels: [number, string][] = [
        [ROW_DC, 'DC'], [ROW_F0, 'f₀'], [ROW_2F, '2f₀'], [ROW_3F, '3f₀'],
      ]
      freqLabels.forEach(([row, lbl]) => {
        const y = row * cH + cH / 2 + 3
        ctx.fillStyle = '#71717a'
        ctx.font = '7px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(lbl, LABEL_W - 2, y)
        ctx.strokeStyle = 'rgba(255,255,255,0.10)'
        ctx.lineWidth = 0.5
        ctx.beginPath(); ctx.moveTo(LABEL_W, row * cH); ctx.lineTo(W, row * cH); ctx.stroke()
      })

      // ── Fault onset static dashed line ─────────────────────────────────
      const faultCol = Math.floor(STFT_W * FAULT_T)
      const faultX   = LABEL_W + faultCol * cW
      ctx.setLineDash([2, 2])
      ctx.strokeStyle = 'rgba(251,113,133,0.6)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(faultX, 0); ctx.lineTo(faultX, plotH); ctx.stroke()
      ctx.setLineDash([])

      // ── Animated scan cursor ───────────────────────────────────────────
      // sweeps full width in 3.5 s, pauses 0.5 s at fault column then resets
      const period    = 4.0
      const rawFrac   = (elapsed % period) / period
      // pause at fault_t for 10% of the period
      const pauseEnd  = FAULT_T + 0.10
      let   cursorFrac: number
      if (rawFrac < FAULT_T) {
        cursorFrac = rawFrac / FAULT_T * FAULT_T       // normal sweep to fault
      } else if (rawFrac < pauseEnd) {
        cursorFrac = FAULT_T                            // pause at fault
      } else {
        cursorFrac = FAULT_T + (rawFrac - pauseEnd) / (1 - pauseEnd) * (1 - FAULT_T)
      }

      const cursorCol = Math.floor(cursorFrac * STFT_W)
      const cursorX   = LABEL_W + cursorCol * cW

      // Dim "upcoming" area to the right of cursor (not yet scanned)
      ctx.fillStyle = 'rgba(0,0,0,0.40)'
      ctx.fillRect(cursorX + cW, 0, W - cursorX - cW, plotH)

      // Cursor glow
      const cursorGrd = ctx.createLinearGradient(cursorX - 5, 0, cursorX + 5, 0)
      cursorGrd.addColorStop(0,   'rgba(255,255,255,0.00)')
      cursorGrd.addColorStop(0.4, 'rgba(255,255,255,0.85)')
      cursorGrd.addColorStop(0.6, 'rgba(255,255,255,0.85)')
      cursorGrd.addColorStop(1,   'rgba(255,255,255,0.00)')
      ctx.fillStyle = cursorGrd
      ctx.fillRect(cursorX - 5, 0, 10, plotH)

      // Extra glow at fault onset when cursor is near
      if (Math.abs(cursorCol - faultCol) < 2) {
        ctx.fillStyle = 'rgba(251,113,133,0.25)'
        ctx.fillRect(LABEL_W, 0, plotW, plotH)
      }

      // Axis labels
      ctx.fillStyle = '#52525b'
      ctx.font = '8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('time →', LABEL_W + 2, H - 2)

      raf.current = requestAnimationFrame(loop)
    }

    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  return (
    <canvas ref={canvasRef} width={280} height={120} className="w-full rounded-lg"
      style={{ opacity: active ? 1 : 0.22, transition: 'opacity 0.5s' }} />
  )
}

// ── Panel: Model Input — horizontal channel scan sweeps top→bottom ────────────
function ModelInputPanel({ active, heatmap }: { active: boolean; heatmap: number[][] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf       = useRef(0)
  const offRef    = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const GRID_ROWS = 16, GRID_COLS = 24
    const off = document.createElement('canvas')
    off.width  = GRID_COLS
    off.height = GRID_ROWS
    const octx = off.getContext('2d')!

    for (let gr = 0; gr < GRID_ROWS; gr++) {
      const srcRow = Math.round((gr / GRID_ROWS) * (STFT_H - 1))
      for (let gc = 0; gc < GRID_COLS; gc++) {
        const srcCol = Math.round((gc / GRID_COLS) * (STFT_W - 1))
        const [r,g,b] = toColor(heatmap[srcRow]?.[srcCol] ?? 0)
        octx.fillStyle = `rgb(${r},${g},${b})`
        octx.fillRect(gc, gr, 1, 1)
      }
    }
    offRef.current = off
  }, [heatmap])

  useEffect(() => {
    let t0: number | null = null

    const loop = (ts: number) => {
      if (!t0) t0 = ts
      const elapsed = (ts - t0) / 1000

      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx || !offRef.current) { raf.current = requestAnimationFrame(loop); return }

      const W = canvasRef.current!.width
      const H = canvasRef.current!.height
      const GRID_ROWS = 16
      const GRID_COLS = 24
      const LABEL_R   = 38
      const cW = (W - LABEL_R) / GRID_COLS
      const cH = H / GRID_ROWS

      ctx.clearRect(0, 0, W, H)

      // Draw pixel grid from offscreen
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(offRef.current, 0, 0, W - LABEL_R, H)

      // Grid lines
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'
      ctx.lineWidth = 0.5
      for (let c = 0; c <= GRID_COLS; c++) {
        ctx.beginPath(); ctx.moveTo(c * cW, 0); ctx.lineTo(c * cW, H); ctx.stroke()
      }
      for (let r = 0; r <= GRID_ROWS; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * cH); ctx.lineTo(GRID_COLS * cW, r * cH); ctx.stroke()
      }

      // Channel annotations on right margin
      const annotRows: [number, number][] = [[0, 0], [4, 56], [8, 113], [12, 170]]
      annotRows.forEach(([gr, ch]) => {
        ctx.fillStyle = '#f472b640'
        ctx.fillRect(0, gr * cH, GRID_COLS * cW, cH)
        ctx.fillStyle = '#f472b6'
        ctx.font = '7px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`ch.${ch}`, GRID_COLS * cW + 2, gr * cH + cH / 2 + 3)
      })

      // Animated channel scan line: sweeps top → bottom in 2.5 s
      const scanFrac = (elapsed * 0.4) % 1.0
      const scanY    = scanFrac * H

      // Glow ahead of scan (the upcoming channels are slightly brighter as they're "read")
      const grdH = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8)
      grdH.addColorStop(0,   'rgba(250,204,21,0.00)')
      grdH.addColorStop(0.45,'rgba(250,204,21,0.70)')
      grdH.addColorStop(0.55,'rgba(250,204,21,0.70)')
      grdH.addColorStop(1,   'rgba(250,204,21,0.00)')
      ctx.fillStyle = grdH
      ctx.fillRect(0, scanY - 8, GRID_COLS * cW, 16)

      // Leading edge indicator on right
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.moveTo(GRID_COLS * cW + 2, scanY - 3)
      ctx.lineTo(GRID_COLS * cW + 8, scanY)
      ctx.lineTo(GRID_COLS * cW + 2, scanY + 3)
      ctx.fill()

      // Dimension label
      ctx.fillStyle = '#3f3f46'
      ctx.font = '7px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('227 ch × 227 steps', 2, H - 1)

      raf.current = requestAnimationFrame(loop)
    }

    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  return (
    <canvas ref={canvasRef} width={280} height={120} className="w-full rounded-lg"
      style={{ opacity: active ? 1 : 0.22, transition: 'opacity 0.5s', imageRendering: 'pixelated' }} />
  )
}

// ── Main component ───────────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: 'Raw Waveform',  sub: '3-phase voltage · time domain',                  color: '#38bdf8' },
  { id: 1, label: 'FFT Spectrum',  sub: 'Frequency magnitude · fault-induced harmonics',  color: '#34d399' },
  { id: 2, label: 'S-Transform',   sub: 'Time-frequency heatmap · freq rows, time cols',  color: '#f472b6' },
  { id: 3, label: 'Model Input',   sub: '227×227 tensor · each row = one Conv1D channel', color: '#fbbf24' },
]

const FAULT_OPTIONS: FaultType[] = ['AG', 'AB', 'ABG', 'NF']
const FAULT_DESC: Record<FaultType, string> = {
  AG:  'Phase A to Ground — single-phase fault, DC offset + odd harmonics',
  AB:  'Phase A to Phase B — inter-phase fault, even harmonics dominate',
  ABG: 'Phases A & B to Ground — mixed DC, odd + even harmonics',
  NF:  'No Fault — balanced 3-phase, only fundamental frequency',
}

export function SignalPipeline() {
  const [activeStep, setActiveStep] = useState(-1)
  const [running, setRunning]       = useState(false)
  const [fault, setFault]           = useState<FaultType>('AG')
  const [heatmap, setHeatmap]       = useState<number[][]>(() => genHeatmap('AG'))
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => { setHeatmap(genHeatmap(fault)) }, [fault])

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  const play = useCallback(() => {
    if (running) return
    clear()
    setRunning(true)
    setActiveStep(-1)
    STEPS.forEach((_, i) => {
      const t = setTimeout(() => setActiveStep(i), i * 950)
      timers.current.push(t)
    })
    const done = setTimeout(() => setRunning(false), STEPS.length * 950 + 400)
    timers.current.push(done)
  }, [running])

  const reset = () => { clear(); setActiveStep(-1); setRunning(false) }
  useEffect(() => () => clear(), [])

  return (
    <section id="pipeline" className="py-24 px-6 max-w-7xl mx-auto">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <Badge variant="secondary" className="mb-4 font-mono text-xs">Signal Processing</Badge>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Waveform → Heatmap Pipeline
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base leading-relaxed">
          A raw 3-phase voltage signal is converted into a 2D time-frequency image
          via the S-transform — then fed as a 227×227 pixel tensor to the model.
        </p>
      </motion.div>

      {/* fault selector */}
      <div className="flex justify-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-zinc-500 self-center mr-1">Fault type:</span>
        {FAULT_OPTIONS.map(f => (
          <button key={f} onClick={() => { setFault(f); reset() }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all duration-150 ${
              fault === f
                ? 'bg-sky-400/15 border-sky-400/50 text-sky-300'
                : 'bg-zinc-900 border-white/8 text-zinc-500 hover:text-white hover:border-white/20'
            }`}
          >{f}</button>
        ))}
      </div>
      <p className="text-center text-[11px] text-zinc-600 mb-10">{FAULT_DESC[fault]}</p>

      {/* pipeline panels */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {STEPS.map((step, i) => (
          <motion.div key={step.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.45 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300"
                style={{
                  background:  activeStep >= i ? step.color + '25' : 'rgba(255,255,255,0.04)',
                  border:     `1.5px solid ${activeStep >= i ? step.color + '80' : 'rgba(255,255,255,0.1)'}`,
                  color:       activeStep >= i ? step.color : '#52525b',
                }}
              >{i + 1}</div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px transition-all duration-500"
                  style={{ background: activeStep > i ? step.color + '50' : 'rgba(255,255,255,0.07)' }} />
              )}
            </div>

            <div className="rounded-xl border p-3 transition-all duration-300"
              style={{
                background:  activeStep >= i ? step.color + '07' : 'rgba(24,24,27,0.8)',
                borderColor: activeStep >= i ? step.color + '40' : 'rgba(255,255,255,0.07)',
                boxShadow:   activeStep >= i ? `0 0 18px ${step.color}12` : 'none',
              }}
            >
              {i === 0 && <WaveformPanel   active={activeStep >= 0} ft={fault} />}
              {i === 1 && <SpectrumPanel   active={activeStep >= 1} ft={fault} />}
              {i === 2 && <HeatmapPanel    active={activeStep >= 2} ft={fault} heatmap={heatmap} />}
              {i === 3 && <ModelInputPanel active={activeStep >= 3} heatmap={heatmap} />}
            </div>

            <div>
              <div className="text-sm font-semibold transition-colors duration-300"
                style={{ color: activeStep >= i ? step.color : '#71717a' }}
              >{step.label}</div>
              <div className="text-[11px] text-zinc-600 mt-0.5">{step.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* controls */}
      <div className="flex justify-center mb-16">
        <AnimatePresence mode="wait">
          {running ? (
            <motion.div key="stop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button size="sm" variant="ghost" onClick={reset}>
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
            </motion.div>
          ) : (
            <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button size="sm" onClick={play}>
                <Play className="w-3.5 h-3.5" /> Animate Pipeline
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Pipeline explanation ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl bg-zinc-900/60 border border-white/7 p-8 max-w-4xl mx-auto"
      >
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-5">How it works — plain language</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { step: '① Raw waveform', color: '#38bdf8',
              text: 'The power grid produces three balanced sine waves at 60 Hz, offset by 120°. During a fault, one or more phases immediately distort — Phase A to Ground collapses that phase to near zero; Phase A–B merges both toward their average; ABG zeros two phases while the third picks up extra voltage.' },
            { step: '② Frequency spectrum (FFT)', color: '#34d399',
              text: 'A healthy system has a single tall spike at the fundamental f₀. Faults inject new components: DC offset (0 Hz) from half-wave asymmetry, odd harmonics (3f₀, 5f₀) for ground faults, even harmonics (2f₀, 4f₀) for phase-to-phase faults. This harmonic fingerprint is unique per fault type.' },
            { step: '③ S-Transform heatmap', color: '#f472b6',
              text: 'The S-transform computes the frequency spectrum at every instant in time — like a musical spectrogram. Time runs left to right; frequency top to bottom (DC at top). A healthy line shows one bright horizontal stripe at f₀. A fault lights up additional frequency bands exactly at the fault onset moment.' },
            { step: '④ Model input (227×227 tensor)', color: '#fbbf24',
              text: 'The S-transform is resized to 227×227 pixels and fed directly to the neural network. The 1D CNN treats each of the 227 pixel rows as a separate input channel — one per frequency band — and slides kernels across the 227 time steps. The model learns that the spatial pattern of bright and dark bands encodes the fault class.' },
          ].map(({ step, color, text }) => (
            <div key={step} className="flex gap-3">
              <div className="w-1 rounded-full shrink-0 mt-1" style={{ background: color, minHeight: '100%' }} />
              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color }}>{step}</div>
                <p className="text-sm text-zinc-400 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
