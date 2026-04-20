import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Elite Progress Component
 * 
 * Optimized for:
 * - Performance: No external heavy-weight dependencies (Radix-less)
 * - Accessibility: aria-valuenow/min/max support
 * - Design: Monochromatic Elite Workbench aesthetics
 */
const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number }
>(({ className, value, ...props }, ref) => (
  <div
    ref={ref}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-slate-100",
      className
    )}
    {...props}
  >
    <div
      className="h-full w-full flex-1 bg-slate-900 transition-all duration-300 ease-in-out"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
