import { cn, formatCurrency } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  variant?: "default" | "gold" | "emerald" | "danger";
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) {
  const variants = {
    default: "border-border",
    gold: "border-gold/30 bg-gradient-to-br from-gold/5 to-transparent",
    emerald: "border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent",
    danger: "border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent",
  };

  return (
    <div className={cn("rounded-xl border p-5 shadow-sm transition-all hover:shadow-md", variants[variant])}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">
            {typeof value === "number" ? formatCurrency(value) : value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && <p className="text-xs text-emerald-600 font-medium">{trend}</p>}
        </div>
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          variant === "gold" ? "bg-gold/20 text-gold-dark" : "bg-emerald-500/10 text-emerald-600"
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
