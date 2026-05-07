import { useEffect, useRef } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Node {
  x: number; y: number; z: number
  vx: number; vy: number
  pulseT: number; pulseColor: string
  energized: boolean   // part of an active power line
}

interface Spark {
  x: number; y: number; vx: number; vy: number
  life: number; color: string; size: number
}

interface Arc {
  x1: number; y1: number; x2: number; y2: number
  life: number; color: string
  segments: { x: number; y: number }[]
}

interface PowerLine {
  aIdx: number; bIdx: number
  color: string
  // animated current: several dots each at different progress along line
  dots: { t: number; speed: number }[]
  sparkT: number   // countdown for endpoint sparks
  id: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const PALETTE       = ['#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#f87171']
const NODE_COUNT    = 72
const MAX_DIST      = 160
const BASE_SPEED    = 0.18
const SNAP_RADIUS   = 48     // px — how close to a node a click must be to select it
const MAX_POWERLINES = 12   // oldest removed when exceeded

// ── Helpers ──────────────────────────────────────────────────────────────────

let _lineId = 0
function nextId() { return ++_lineId }

function makeLightning(x1: number, y1: number, x2: number, y2: number, segs = 8) {
  const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }]
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    pts.push({
      x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 28,
      y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 28,
    })
  }
  pts.push({ x: x2, y: y2 })
  return pts
}

function lerp(a: { sx: number; sy: number }, b: { sx: number; sy: number }, t: number) {
  return { sx: a.sx + (b.sx - a.sx) * t, sy: a.sy + (b.sy - a.sy) * t }
}

// ── Component ────────────────────────────────────────────────────────────────

export function NeuralCanvas() {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const nodesRef       = useRef<Node[]>([])
  const sparksRef      = useRef<Spark[]>([])
  const arcsRef        = useRef<Arc[]>([])
  const powerLinesRef  = useRef<PowerLine[]>([])
  const selectedRef    = useRef<number | null>(null)  // index of first-clicked node
  const mouseRef       = useRef({ x: 0.5, y: 0.5 })
  const frameRef       = useRef(0)
  const rotRef         = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const el  = canvas

    // ── resize ────────────────────────────────────────────────
    function resize() {
      el.width  = el.offsetWidth  * window.devicePixelRatio
      el.height = el.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    function W() { return el.offsetWidth }
    function H() { return el.offsetHeight }

    // ── init nodes ────────────────────────────────────────────
    nodesRef.current = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      z: 0.2 + Math.random() * 0.8,
      vx: (Math.random() - 0.5) * BASE_SPEED,
      vy: (Math.random() - 0.5) * BASE_SPEED,
      pulseT: 0, pulseColor: PALETTE[0], energized: false,
    }))

    // ── ambient fault pulses ──────────────────────────────────
    const ambientInterval = setInterval(() => {
      const n = nodesRef.current[Math.floor(Math.random() * NODE_COUNT)]
      if (!n.energized) {
        n.pulseT    = 0.8
        n.pulseColor = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      }
    }, 900)

    // ── mouse parallax ────────────────────────────────────────
    function onMouse(e: MouseEvent) {
      mouseRef.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
    }
    window.addEventListener('mousemove', onMouse)

    // ── project a node to screen ──────────────────────────────
    function project(n: Node) {
      const w   = W()
      const rad = (rotRef.current * Math.PI) / 180
      const px  = (mouseRef.current.x - 0.5) * 28
      const py  = (mouseRef.current.y - 0.5) * 18
      const cx  = n.x - w / 2
      const rx  = cx * Math.cos(rad) - n.z * 80 * Math.sin(rad)
      return { sx: rx + w / 2 + px * n.z, sy: n.y + py * n.z }
    }

    // ── find nearest node to screen pos ──────────────────────
    function nearestNode(cx: number, cy: number): { idx: number; dist: number } {
      let best = { idx: -1, dist: Infinity }
      nodesRef.current.forEach((n, i) => {
        const p  = project(n)
        const dx = p.sx - cx, dy = p.sy - cy
        const d  = Math.sqrt(dx*dx + dy*dy)
        if (d < best.dist) best = { idx: i, dist: d }
      })
      return best
    }

    // ── spawn sparks at a point ───────────────────────────────
    function spawnSparks(cx: number, cy: number, color: string, count = 22) {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
        const speed = 1.2 + Math.random() * 4
        sparksRef.current.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          color: Math.random() > 0.4 ? color : '#ffffff',
          size: 0.7 + Math.random() * 2,
        })
      }
    }

    // ── CLICK HANDLER ─────────────────────────────────────────
    function onClick(e: MouseEvent) {
      const rect = el.getBoundingClientRect()
      const cx   = e.clientX - rect.left
      const cy   = e.clientY - rect.top

      const { idx, dist } = nearestNode(cx, cy)

      // ── double-click on an existing power line → break it ──
      if (e.detail === 2) {
        const p  = project(nodesRef.current[idx])
        const nearLine = powerLinesRef.current.findIndex(pl => {
          const pa = project(nodesRef.current[pl.aIdx])
          const pb = project(nodesRef.current[pl.bIdx])
          // distance from click to line segment
          const dx = pb.sx - pa.sx, dy = pb.sy - pa.sy
          const len = Math.sqrt(dx*dx + dy*dy)
          if (len === 0) return false
          const t = Math.max(0, Math.min(1, ((cx - pa.sx)*dx + (cy - pa.sy)*dy) / (len*len)))
          const nx = pa.sx + t*dx - cx, ny = pa.sy + t*dy - cy
          return Math.sqrt(nx*nx + ny*ny) < 18
        })
        if (nearLine !== -1) {
          const pl = powerLinesRef.current[nearLine]
          nodesRef.current[pl.aIdx].energized = false
          nodesRef.current[pl.bIdx].energized = false
          spawnSparks(p.sx, p.sy, pl.color, 16)
          powerLinesRef.current.splice(nearLine, 1)
          selectedRef.current = null
          return
        }
      }

      if (dist <= SNAP_RADIUS) {
        // ── clicking a node ───────────────────────────────────
        const node = nodesRef.current[idx]

        if (selectedRef.current === null) {
          // first selection
          selectedRef.current = idx
          node.pulseT = 1.5
          node.pulseColor = '#ffffff'
          spawnSparks(project(node).sx, project(node).sy, '#ffffff', 12)

        } else if (selectedRef.current === idx) {
          // deselect same node
          selectedRef.current = null
          node.pulseT = 0

        } else {
          // second node → create power line
          const aIdx    = selectedRef.current
          const bIdx    = idx
          const color   = PALETTE[Math.floor(Math.random() * PALETTE.length)]

          // remove oldest if at limit
          if (powerLinesRef.current.length >= MAX_POWERLINES) {
            const old = powerLinesRef.current.shift()!
            nodesRef.current[old.aIdx].energized = false
            nodesRef.current[old.bIdx].energized = false
          }

          powerLinesRef.current.push({
            aIdx, bIdx, color,
            dots: Array.from({ length: 5 }, (_, di) => ({
              t: di / 5,
              speed: 0.18 + Math.random() * 0.14,
            })),
            sparkT: 1.0,
            id: nextId(),
          })

          nodesRef.current[aIdx].energized = true
          nodesRef.current[bIdx].energized = true
          nodesRef.current[aIdx].pulseT    = 1.2
          nodesRef.current[aIdx].pulseColor = color
          nodesRef.current[bIdx].pulseT    = 1.2
          nodesRef.current[bIdx].pulseColor = color

          // arc flash along the new connection
          const pa = project(nodesRef.current[aIdx])
          const pb = project(nodesRef.current[bIdx])
          for (let k = 0; k < 3; k++) {
            arcsRef.current.push({
              x1: pa.sx, y1: pa.sy, x2: pb.sx, y2: pb.sy,
              life: 0.6 + k * 0.15, color,
              segments: makeLightning(pa.sx, pa.sy, pb.sx, pb.sy, 8 + k*2),
            })
          }
          spawnSparks(pa.sx, pa.sy, color, 16)
          spawnSparks(pb.sx, pb.sy, color, 16)

          selectedRef.current = null
        }

      } else {
        // ── click in open space → sparks + deselect ──────────
        const color = PALETTE[Math.floor(Math.random() * PALETTE.length)]
        spawnSparks(cx, cy, color, 26)

        // brief lightning arcs to nearest 3 nodes
        const sorted = nodesRef.current
          .map((n, i) => { const p = project(n); const dx=p.sx-cx,dy=p.sy-cy; return { i, dist: Math.sqrt(dx*dx+dy*dy), p } })
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3)

        sorted.forEach(({ i, p }) => {
          nodesRef.current[i].pulseT    = 1.0
          nodesRef.current[i].pulseColor = color
          arcsRef.current.push({
            x1: cx, y1: cy, x2: p.sx, y2: p.sy,
            life: 0.8, color,
            segments: makeLightning(cx, cy, p.sx, p.sy, 6),
          })
        })

        selectedRef.current = null
      }
    }
    el.addEventListener('click', onClick)

    // ── draw ─────────────────────────────────────────────────
    let last = 0
    function draw(ts: number) {
      const dt = Math.min((ts - last) / 1000, 0.05)
      last = ts
      rotRef.current += dt * 3.0

      const w = W(), h = H()
      ctx.clearRect(0, 0, w, h)

      const projected = nodesRef.current.map(n => project(n))

      // ── ambient connections ───────────────────────────────
      for (let i = 0; i < NODE_COUNT; i++) {
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const a = projected[i], b = projected[j]
          const dx = a.sx - b.sx, dy = a.sy - b.sy
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist > MAX_DIST) continue
          const alpha = (1 - dist / MAX_DIST) * 0.16 * Math.min(a.z, b.z)
          const pA = nodesRef.current[i].pulseT, pB = nodesRef.current[j].pulseT
          if (pA > 0.5 || pB > 0.5) {
            const col = (pA > pB ? nodesRef.current[i] : nodesRef.current[j]).pulseColor
            ctx.strokeStyle = col + Math.round(Math.min(1, Math.max(pA,pB)*0.5+alpha)*255).toString(16).padStart(2,'0')
            ctx.lineWidth   = 1.3 * Math.min(a.z, b.z)
          } else {
            ctx.strokeStyle = `rgba(56,189,248,${alpha.toFixed(3)})`
            ctx.lineWidth   = 0.7 * Math.min(a.z, b.z)
          }
          ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
        }
      }

      // ── POWER LINES ───────────────────────────────────────
      for (const pl of powerLinesRef.current) {
        const pa = projected[pl.aIdx], pb = projected[pl.bIdx]

        // outer glow
        ctx.save()
        ctx.strokeStyle = pl.color + '30'
        ctx.lineWidth   = 10
        ctx.shadowBlur  = 18
        ctx.shadowColor = pl.color
        ctx.beginPath(); ctx.moveTo(pa.sx, pa.sy); ctx.lineTo(pb.sx, pb.sy); ctx.stroke()
        ctx.restore()

        // core wire
        ctx.save()
        ctx.strokeStyle = pl.color + 'cc'
        ctx.lineWidth   = 2.5
        ctx.shadowBlur  = 8
        ctx.shadowColor = pl.color
        ctx.beginPath(); ctx.moveTo(pa.sx, pa.sy); ctx.lineTo(pb.sx, pb.sy); ctx.stroke()
        ctx.restore()

        // bright centre
        ctx.save()
        ctx.strokeStyle = '#ffffff55'
        ctx.lineWidth   = 0.8
        ctx.beginPath(); ctx.moveTo(pa.sx, pa.sy); ctx.lineTo(pb.sx, pb.sy); ctx.stroke()
        ctx.restore()

        // flowing current dots
        for (const dot of pl.dots) {
          dot.t = (dot.t + dot.speed * dt) % 1
          const pos = lerp(pa, pb, dot.t)

          ctx.save()
          ctx.beginPath(); ctx.arc(pos.sx, pos.sy, 3.5, 0, Math.PI * 2)
          ctx.fillStyle   = '#ffffff'
          ctx.shadowBlur  = 12
          ctx.shadowColor = pl.color
          ctx.fill()

          // trailing glow
          ctx.beginPath(); ctx.arc(pos.sx, pos.sy, 6, 0, Math.PI * 2)
          ctx.fillStyle = pl.color + '60'
          ctx.fill()
          ctx.restore()
        }

        // occasional endpoint sparks
        pl.sparkT -= dt
        if (pl.sparkT <= 0) {
          pl.sparkT = 0.6 + Math.random() * 1.2
          spawnSparks(pa.sx, pa.sy, pl.color, 5)
          spawnSparks(pb.sx, pb.sy, pl.color, 5)
        }
      }

      // ── lightning arcs ─────────────────────────────────────
      arcsRef.current = arcsRef.current.filter(a => a.life > 0)
      for (const arc of arcsRef.current) {
        arc.life -= dt * 3.5
        const a = Math.max(0, arc.life)
        ctx.save()
        ctx.globalAlpha = a * a
        ctx.strokeStyle = arc.color; ctx.lineWidth = 1.5 + a * 1.5
        ctx.shadowBlur = 12 * a; ctx.shadowColor = arc.color
        ctx.beginPath()
        arc.segments.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        ctx.stroke()
        ctx.globalAlpha = a * 0.35; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5
        ctx.beginPath()
        arc.segments.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y))
        ctx.stroke()
        ctx.restore()
      }

      // ── sparks ────────────────────────────────────────────
      sparksRef.current = sparksRef.current.filter(s => s.life > 0)
      for (const s of sparksRef.current) {
        s.x += s.vx; s.y += s.vy; s.vx *= 0.93; s.vy *= 0.93; s.life -= dt * 2.2
        const a = Math.max(0, s.life)
        ctx.save(); ctx.globalAlpha = a
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size * a, 0, Math.PI * 2)
        ctx.fillStyle = s.color; ctx.shadowBlur = 8; ctx.shadowColor = s.color; ctx.fill()
        ctx.restore()
      }

      // ── nodes ─────────────────────────────────────────────
      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodesRef.current[i]
        const p = projected[i]

        n.x += n.vx; n.y += n.vy
        if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20
        if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20
        if (n.pulseT > 0 && !n.energized) n.pulseT = Math.max(0, n.pulseT - dt * 1.2)

        const isSelected = selectedRef.current === i
        const r = 1.5 + n.z * 2.5

        if (isSelected) {
          // pulsing white ring for selected node
          const ring = Math.sin(Date.now() * 0.008) * 0.3 + 0.7
          ctx.save()
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 4, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255,255,255,${(ring * 0.7).toFixed(2)})`
          ctx.lineWidth = 1.5
          ctx.shadowBlur = 14; ctx.shadowColor = '#fff'
          ctx.stroke()
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 1.8, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'; ctx.fill()
          ctx.restore()

        } else if (n.energized) {
          // energized node — brighter, larger, colour of its power line
          const col = n.pulseColor
          const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 5)
          glow.addColorStop(0, col + 'bb'); glow.addColorStop(1, col + '00')
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 5, 0, Math.PI * 2)
          ctx.fillStyle = glow; ctx.fill()
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 1.6, 0, Math.PI * 2)
          ctx.fillStyle = col; ctx.fill()
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 0.6, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'; ctx.fill()

        } else if (n.pulseT > 0) {
          const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 6 * n.pulseT)
          glow.addColorStop(0, n.pulseColor + 'cc'); glow.addColorStop(1, n.pulseColor + '00')
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 6 * n.pulseT, 0, Math.PI * 2)
          ctx.fillStyle = glow; ctx.fill()
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r * (1 + n.pulseT * 1.8), 0, Math.PI * 2)
          ctx.fillStyle = n.pulseColor; ctx.fill()

        } else {
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(148,163,184,${(0.25 + n.z * 0.55).toFixed(2)})`; ctx.fill()
          ctx.beginPath(); ctx.arc(p.sx, p.sy, r * 0.4, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(224,242,254,${((0.25+n.z*0.55)*1.4).toFixed(2)})`; ctx.fill()
        }
      }

      // ── hint text when node is selected ──────────────────
      if (selectedRef.current !== null) {
        ctx.save()
        ctx.font      = '11px monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.textAlign = 'center'
        ctx.fillText('click another node to connect', w / 2, h - 20)
        ctx.restore()
      }

      frameRef.current = requestAnimationFrame(draw)
    }
    frameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frameRef.current)
      clearInterval(ambientInterval)
      window.removeEventListener('mousemove', onMouse)
      el.removeEventListener('click', onClick)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full cursor-crosshair"
      style={{ opacity: 0.62 }}
      title="Click a node to select · click another to connect · double-click a line to break it"
    />
  )
}
