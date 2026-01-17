import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReconciliacaoBancaria } from "@/components/financas/ReconciliacaoBancaria";
import { ConciliacaoManual } from "@/components/financas/ConciliacaoManual";
import { HistoricoExtratos } from "@/components/financas/HistoricoExtratos";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reconciliacao() {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/financas")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Reconciliação Bancária
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Concilie movimentos bancários com lançamentos internos
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="saldos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="saldos">Saldos</TabsTrigger>
          <TabsTrigger value="extratos">Conciliação Manual</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Extratos</TabsTrigger>
        </TabsList>
        <TabsContent value="saldos">
          <ReconciliacaoBancaria />
        </TabsContent>
        <TabsContent value="extratos">
          <ConciliacaoManual />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoExtratos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
