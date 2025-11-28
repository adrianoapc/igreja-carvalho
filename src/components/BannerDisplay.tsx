import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import * as React from "react";

interface Banner {
  id: number;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "urgent";
}

interface BannerDisplayProps {
  banners: Banner[];
}

export function BannerDisplay({ banners }: BannerDisplayProps) {
  const [dismissed, setDismissed] = React.useState<number[]>([]);

  const activeBanners = banners.filter(b => !dismissed.includes(b.id));

  if (activeBanners.length === 0) return null;

  const getTypeStyles = (type: Banner["type"]) => {
    switch (type) {
      case "urgent":
        return "bg-destructive/10 border-destructive/30 text-destructive-foreground";
      case "warning":
        return "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100";
      case "success":
        return "bg-green-500/10 border-green-500/30 text-green-900 dark:text-green-100";
      default:
        return "bg-primary/10 border-primary/30 text-primary-foreground";
    }
  };

  const getIcon = (type: Banner["type"]) => {
    switch (type) {
      case "urgent":
        return <AlertCircle className="w-4 h-4 md:w-5 md:h-5" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />;
      case "success":
        return <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />;
      default:
        return <Info className="w-4 h-4 md:w-5 md:h-5" />;
    }
  };

  return (
    <div className="space-y-2 md:space-y-3 animate-fade-in">
      {activeBanners.map((banner) => (
        <Card
          key={banner.id}
          className={`${getTypeStyles(banner.type)} border-2 shadow-sm hover-scale`}
        >
          <div className="p-3 md:p-4 flex items-start gap-2 md:gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {getIcon(banner.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-xs md:text-sm mb-1 truncate">{banner.title}</h3>
              <p className="text-xs md:text-sm opacity-90 line-clamp-2 md:line-clamp-none">{banner.message}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 md:h-8 md:w-8 shrink-0"
              onClick={() => setDismissed([...dismissed, banner.id])}
            >
              <X className="w-3 h-3 md:w-4 md:h-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
