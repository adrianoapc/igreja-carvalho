import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import React from "react";

const IntercessoresManager = React.lazy(() => import("@/components/pedidos/IntercessoresManager").then(m => ({ default: m.IntercessoresManager })));

export default function Intercessores() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/intercessao")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Intercessores</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie a equipe de intercessão e distribuição de pedidos
          </p>
        </div>
      </div>

      <React.Suspense fallback={
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Carregando...</p>
        </Card>
      }>
        <IntercessoresManager />
      </React.Suspense>
    </div>
  );
}
