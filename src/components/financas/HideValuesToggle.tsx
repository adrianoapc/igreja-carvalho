import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHideValues } from "@/hooks/useHideValues";
import { cn } from "@/lib/utils";

interface HideValuesToggleProps {
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
}

export function HideValuesToggle({ className, size = "icon" }: HideValuesToggleProps) {
  const { hideValues, toggleHideValues } = useHideValues();

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggleHideValues}
      className={cn("h-9 w-9", className)}
      title={hideValues ? "Exibir valores" : "Ocultar valores"}
    >
      {hideValues ? (
        <EyeOff className="w-4 h-4 text-muted-foreground" />
      ) : (
        <Eye className="w-4 h-4 text-muted-foreground" />
      )}
    </Button>
  );
}
