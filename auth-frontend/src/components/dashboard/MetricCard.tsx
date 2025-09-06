import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { type LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "success" | "warning" | "info";
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
}: MetricCardProps) {
  const getIconBgColor = () => {
    switch (variant) {
      case "success":
        return "bg-success/10 text-success";
      case "warning":
        return "bg-warning/10 text-warning";
      case "info":
        return "bg-info/10 text-info";
      default:
        return "bg-primary/10 text-primary";
    }
  };

  const getTrendColor = () => {
    if (!trend) return "";
    return trend.value > 0 ? "text-success" : "text-destructive";
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${getIconBgColor()}`}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2 text-xs">
            <span className={`font-medium ${getTrendColor()}`}>
              {trend.value > 0 ? "+" : ""}{trend.value}%
            </span>
            <span className="text-muted-foreground ml-1">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}