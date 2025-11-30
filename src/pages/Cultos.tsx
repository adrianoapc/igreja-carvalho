import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";

export default function Cultos() {
  const location = useLocation();
  const navigate = useNavigate();
  const isRootPath = location.pathname === "/cultos";

  useEffect(() => {
    if (isRootPath) {
      navigate("/cultos/geral", { replace: true });
    }
  }, [isRootPath, navigate]);

  const showBackButton = !isRootPath && location.pathname !== "/cultos/geral";

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      {showBackButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/cultos/geral")}
          className="mb-2"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      )}
      <Outlet />
    </div>
  );
}
