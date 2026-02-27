import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function GlassCard({ children, className, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "bg-card/60 backdrop-blur-md border border-border/50 rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
