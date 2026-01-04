import { useNavigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SuperAdminIndicator() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useSuperAdmin();

  if (loading || !isSuperAdmin) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary hover:bg-primary/10"
          onClick={() => navigate("/superadmin")}
        >
          <Shield className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Ir para Painel SaaS</p>
      </TooltipContent>
    </Tooltip>
  );
}
