import { cn } from "../../lib/utils"

function Shimmer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/60 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/45 before:to-transparent dark:before:via-white/15",
        className
      )}
      {...props}
    />
  )
}

export { Shimmer }
