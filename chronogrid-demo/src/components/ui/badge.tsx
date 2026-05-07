import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:   'bg-sky-400/15 text-sky-300 border border-sky-400/30',
        secondary: 'bg-zinc-800 text-zinc-300 border border-white/8',
        emerald:   'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30',
        purple:    'bg-violet-400/15 text-violet-300 border border-violet-400/30',
        red:       'bg-red-400/15 text-red-300 border border-red-400/30',
        gold:      'bg-amber-400/15 text-amber-300 border border-amber-400/30',
        outline:   'border border-white/10 text-zinc-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
