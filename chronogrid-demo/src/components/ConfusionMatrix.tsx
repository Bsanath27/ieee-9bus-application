import { useState } from 'react'
import { motion } from 'framer-motion'
import { FAULT_CLASSES, FAULT_CATEGORIES, type FaultClass } from '@/lib/api'

interface Props {
  matrix: number[][]
}

function getFaultColor(fault: FaultClass) {
  const cat = Object.values(FAULT_CATEGORIES).find(c => c.classes.includes(fault))
  return cat?.color ?? '#94a3b8'
}

export function ConfusionMatrix({ matrix }: Props) {
  const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null)

  const maxVal = Math.max(...matrix.flatMap(row => row))
  const CELL = 36
  const LABEL_W = 48
  const LABEL_H = 48

  const totalWidth  = LABEL_W + FAULT_CLASSES.length * CELL
  const totalHeight = LABEL_H + FAULT_CLASSES.length * CELL

  function cellColor(r: number, c: number) {
    const val = matrix[r][c]
    const t   = maxVal > 0 ? val / maxVal : 0
    if (r === c) {
      // correct prediction — green tones
      const g = Math.round(30 + t * 180)
      const alpha = 0.15 + t * 0.75
      return `rgba(52,211,153,${alpha})`
    }
    if (val === 0) return 'transparent'
    // misclassification — red tones
    return `rgba(251,113,133,${0.1 + t * 0.8})`
  }

  const hoveredFault = hovered
    ? { actual: FAULT_CLASSES[hovered.r], pred: FAULT_CLASSES[hovered.c], count: matrix[hovered.r][hovered.c] }
    : null

  return (
    <div className="flex flex-col items-center gap-4">
      {/* legend */}
      <div className="flex items-center gap-6 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(52,211,153,0.7)' }} />
          Correct
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(251,113,133,0.7)' }} />
          Misclassified
        </span>
        <span className="text-zinc-600">Hover a cell for details</span>
      </div>

      <div className="overflow-x-auto w-full">
        <div style={{ minWidth: totalWidth + CELL }} className="flex justify-center">
          <svg
            width={totalWidth + CELL}
            height={totalHeight + 24}
            className="font-mono"
          >
            {/* axis labels */}
            <text
              x={LABEL_W + (FAULT_CLASSES.length * CELL) / 2}
              y={totalHeight + 20}
              textAnchor="middle"
              fill="#52525b"
              fontSize={10}
            >
              Predicted Class
            </text>
            <text
              x={-totalHeight / 2}
              y={12}
              textAnchor="middle"
              fill="#52525b"
              fontSize={10}
              transform="rotate(-90)"
            >
              Actual Class
            </text>

            {/* column headers */}
            {FAULT_CLASSES.map((f, ci) => (
              <text
                key={`ch-${ci}`}
                x={LABEL_W + ci * CELL + CELL / 2}
                y={LABEL_H - 6}
                textAnchor="middle"
                fill={getFaultColor(f)}
                fontSize={9}
                fontWeight={600}
              >
                {f}
              </text>
            ))}

            {/* row headers */}
            {FAULT_CLASSES.map((f, ri) => (
              <text
                key={`rh-${ri}`}
                x={LABEL_W - 6}
                y={LABEL_H + ri * CELL + CELL / 2 + 4}
                textAnchor="end"
                fill={getFaultColor(f)}
                fontSize={9}
                fontWeight={600}
              >
                {f}
              </text>
            ))}

            {/* cells */}
            {matrix.map((row, ri) =>
              row.map((val, ci) => {
                const isHov = hovered?.r === ri && hovered?.c === ci
                return (
                  <g key={`${ri}-${ci}`}>
                    <rect
                      x={LABEL_W + ci * CELL + 1}
                      y={LABEL_H + ri * CELL + 1}
                      width={CELL - 2}
                      height={CELL - 2}
                      rx={3}
                      fill={cellColor(ri, ci)}
                      stroke={isHov ? '#fff' : ri === ci ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.04)'}
                      strokeWidth={isHov ? 1.5 : 0.5}
                      className="cursor-pointer transition-all duration-100"
                      onMouseEnter={() => setHovered({ r: ri, c: ci })}
                      onMouseLeave={() => setHovered(null)}
                    />
                    {val > 0 && (
                      <text
                        x={LABEL_W + ci * CELL + CELL / 2}
                        y={LABEL_H + ri * CELL + CELL / 2 + 4}
                        textAnchor="middle"
                        fill={isHov ? '#fff' : ri === ci ? '#fff' : 'rgba(255,255,255,0.7)'}
                        fontSize={val > 9 ? 9 : 10}
                        fontWeight={ri === ci ? 700 : 400}
                        className="pointer-events-none select-none"
                      >
                        {val}
                      </text>
                    )}
                  </g>
                )
              })
            )}
          </svg>
        </div>
      </div>

      {/* hover tooltip strip */}
      <motion.div
        animate={{ opacity: hoveredFault ? 1 : 0, y: hoveredFault ? 0 : 4 }}
        transition={{ duration: 0.15 }}
        className="h-8 flex items-center gap-3 text-xs"
      >
        {hoveredFault && (
          <>
            <span className="text-zinc-400">Actual:</span>
            <span className="font-mono font-bold" style={{ color: getFaultColor(hoveredFault.actual) }}>
              {hoveredFault.actual}
            </span>
            <span className="text-zinc-600">→</span>
            <span className="text-zinc-400">Predicted:</span>
            <span className="font-mono font-bold" style={{ color: getFaultColor(hoveredFault.pred) }}>
              {hoveredFault.pred}
            </span>
            <span className="text-zinc-600">|</span>
            <span className={hoveredFault.actual === hoveredFault.pred ? 'text-emerald-400' : 'text-red-400'}>
              {hoveredFault.count} sample{hoveredFault.count !== 1 ? 's' : ''}
              {hoveredFault.actual === hoveredFault.pred ? ' ✓' : ' ✗'}
            </span>
          </>
        )}
      </motion.div>
    </div>
  )
}
