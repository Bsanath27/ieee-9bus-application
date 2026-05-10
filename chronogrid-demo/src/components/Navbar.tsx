import { useScrollSpy } from '@/hooks/useScrollSpy'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Zap } from 'lucide-react'

const NAV_LINKS = [
  { id: 'about',        label: 'About' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'faults',       label: 'Fault Types' },
  { id: 'performance',  label: 'Performance' },
  { id: 'powerflow',    label: 'Power Flow' },
  { id: 'playground',   label: 'Playground' },
  { id: 'simulator',    label: 'Simulator' },
]

export function Navbar() {
  const active = useScrollSpy(NAV_LINKS.map(l => l.id))

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-white/7 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center">
            <Zap className="w-4 h-4 text-zinc-950" fill="currentColor" />
          </div>
          <span className="font-bold text-sm tracking-tight">
            <span className="gradient-text">ChronoGrid</span>
            <span className="text-zinc-400 font-normal"> FusionNet</span>
          </span>
        </a>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(link => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors duration-150',
                active === link.id
                  ? 'text-white bg-white/8'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <Button
          size="sm"
          onClick={() => document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })}
        >
          Try the Demo
        </Button>
      </div>
    </header>
  )
}
