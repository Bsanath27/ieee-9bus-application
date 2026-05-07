import { Zap } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export function Footer() {
  return (
    <footer className="border-t border-white/7 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-zinc-950" fill="currentColor" />
            </div>
            <span className="font-semibold text-sm">
              <span className="gradient-text">ChronoGrid</span>
              <span className="text-zinc-400 font-normal"> FusionNet</span>
            </span>
          </div>

          <Separator orientation="vertical" className="hidden md:block h-4" />

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-zinc-500">
            <span>CNN + BiLSTM · Fold 5</span>
            <span>WSCC 9-Bus Dataset</span>
            <span>S-Transform Features</span>
            <span>11-Class Classification</span>
          </div>

          <p className="text-xs text-zinc-600">
            IEEE Final Year Project · 2024–25
          </p>
        </div>
      </div>
    </footer>
  )
}
