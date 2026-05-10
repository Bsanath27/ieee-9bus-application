const BASE = import.meta.env.VITE_API_URL ?? '/api'

// Static samples bundled with the Netlify deploy
const SAMPLE_COUNT = 3

export const FAULT_CLASSES = [
  'AG','BG','CG','AB','AC','BC','ABG','ACG','BCG','ABCG','NF',
] as const
export type FaultClass = typeof FAULT_CLASSES[number]

export const FAULT_CATEGORIES: Record<string, { classes: FaultClass[]; color: string; label: string }> = {
  single:  { classes: ['AG','BG','CG'],     color: '#38bdf8', label: 'Single-Phase to Ground' },
  phase:   { classes: ['AB','AC','BC'],     color: '#34d399', label: 'Phase-to-Phase' },
  dlg:     { classes: ['ABG','ACG','BCG'],  color: '#a78bfa', label: 'Two-Phase to Ground' },
  three:   { classes: ['ABCG'],             color: '#f87171', label: 'Three-Phase to Ground' },
  nofault: { classes: ['NF'],               color: '#fbbf24', label: 'No Fault' },
}

export function getFaultCategory(fault: FaultClass) {
  return Object.values(FAULT_CATEGORIES).find(c => c.classes.includes(fault))
}

export interface PredictionResult {
  predicted_class: FaultClass
  predicted_index: number
  confidence: number
  probabilities: Record<FaultClass, number>
  inference_ms: number
  heatmap_rows: number[][]
  image_path: string
  noise_applied: boolean
}

export interface SampleResult extends PredictionResult {
  image_base64: string
  fault_type: FaultClass
}

export interface Metrics {
  ready: boolean
  per_class_accuracy?: Record<FaultClass, number>
  macro_accuracy?: number
  macro_f1?: number
  latency_ms?: number
  params?: number
  baseline_accuracy?: number
  baseline_f1?: number
  confusion_matrix?: number[][]
}

export async function predictUpload(file: File | Blob, filename = 'image.jpg'): Promise<PredictionResult> {
  const form = new FormData()
  form.append('file', file, filename)
  const r = await fetch(`${BASE}/predict/upload`, { method: 'POST', body: form })
  if (!r.ok) throw new Error(`Prediction failed: ${r.status}`)
  return r.json()
}

/**
 * Load a sample from the static Netlify-hosted files, then run real inference
 * via /predict/upload. No backend dataset needed.
 */
export async function loadSample(faultType: FaultClass): Promise<SampleResult> {
  const idx = Math.floor(Math.random() * SAMPLE_COUNT) + 1
  const imgUrl = `/samples/${faultType}/${idx}.jpg`

  // Fetch static image from Netlify
  const imgResp = await fetch(imgUrl)
  if (!imgResp.ok) throw new Error(`Sample image not found: ${imgUrl}`)
  const blob = await imgResp.blob()

  // Convert to base64 for preview
  const image_base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

  // Run real inference on the Render backend
  const result = await predictUpload(blob, `${faultType}_${idx}.jpg`)

  return { ...result, image_base64, fault_type: faultType }
}

export async function getMetrics(): Promise<Metrics> {
  const r = await fetch(`${BASE}/metrics`)
  if (!r.ok) throw new Error('Metrics unavailable')
  return r.json()
}

export async function checkHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`)
    return r.ok
  } catch {
    return false
  }
}
