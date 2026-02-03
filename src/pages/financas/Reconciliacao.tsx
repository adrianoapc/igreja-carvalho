import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardConciliacao } from "@/components/financas/DashboardConciliacao";
import { ConciliacaoManual } from "@/components/financas/ConciliacaoManual";
import { HistoricoExtratos } from "@/components/financas/HistoricoExtratos";
import { RelatorioCobertura } from "@/components/financas/RelatorioCobertura";
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

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="manual">Avançado</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <DashboardConciliacao />
        </TabsContent>
        <TabsContent value="manual">
          <ConciliacaoManual />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoExtratos />
        </TabsContent>
        <TabsContent value="relatorio">
          <RelatorioCobertura />
        </TabsContent>
      </Tabs>
    </div>
  );
}
