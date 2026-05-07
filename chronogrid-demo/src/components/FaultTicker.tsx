import { useEffect, useRef, useState } from 'react'
import { FAULT_CLASSES, FAULT_CATEGORIES, type FaultClass } from '@/lib/api'

const BUS_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function randomEvent() {
  const fault = FAULT_CLASSES[Math.floor(Math.random() * FAULT_CLASSES.length)] as FaultClass
  const bus   = BUS_IDS[Math.floor(Math.random() * BUS_IDS.length)]
  const conf  = (96 + Math.random() * 3.9).toFixed(2)
  const ms    = (18 + Math.random() * 14).toFixed(1)
  const cat   = Object.values(FAULT_CATEGORIES).find(c => c.classes.includes(fault))
  return { fault, bus, conf, ms, color: cat?.color ?? '#94a3b8', id: Math.random() }
}

export function FaultTicker() {
  const [events, setEvents] = useState(() => Array.from({ length: 6 }, randomEvent))
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setEvents(prev => [randomEvent(), ...prev.slice(0, 7)])
    }, 1800)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  return (
    <div className="w-full overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">
          Live Fault Event Feed — WSCC 9-Bus
        </span>
      </div>

      {/* scrolling rows */}
      <div className="flex flex-col gap-1 relative">
        {/* fade mask top */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-zinc-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-zinc-950 to-transparent z-10 pointer-events-none" />

        {events.slice(0, 5).map((ev, i) => (
          <div
            key={ev.id}
            className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-white/5 bg-zinc-900/40 backdrop-blur-sm font-mono text-[11px] transition-all duration-500"
            style={{ opacity: 1 - i * 0.15 }}
          >
            <span
              className="font-bold min-w-[36px]"
              style={{ color: ev.color }}
            >{ev.fault}</span>
            <span className="text-zinc-600">Bus {ev.bus}</span>
            <span className="text-zinc-500 flex-1 text-left">·</span>
            <span className="text-zinc-400">{ev.conf}% conf</span>
            <span className="text-zinc-600">{ev.ms}ms</span>
            {i === 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-400 border border-emerald-400/20">
                NEW
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
