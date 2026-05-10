import { Navbar }         from '@/components/Navbar'
import { Hero }           from '@/components/Hero'
import { Architecture }   from '@/components/Architecture'
import { SignalPipeline } from '@/components/SignalPipeline'
import { FaultGallery }   from '@/components/FaultGallery'
import { Performance }    from '@/components/Performance'
import { PowerFlow }      from '@/components/PowerFlow'
import { Playground }     from '@/components/Playground'
import { Simulator }      from '@/components/Simulator'
import { Footer }         from '@/components/Footer'
import { Separator }      from '@/components/ui/separator'

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <Navbar />
      <main>
        <Hero />
        <Separator className="opacity-40" />
        <Architecture />
        <Separator className="opacity-40" />
        <SignalPipeline />
        <Separator className="opacity-40" />
        <FaultGallery />
        <Separator className="opacity-40" />
        <Performance />
        <Separator className="opacity-40" />
        <PowerFlow />
        <Separator className="opacity-40" />
        <Playground />
        <Separator className="opacity-40" />
        <Simulator />
      </main>
      <Footer />
    </div>
  )
}
