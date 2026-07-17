import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardConciliacao } from "@/features/financeiro/conciliacao/DashboardConciliacao";
import { ConciliacaoManual } from "@/features/financeiro/conciliacao/ConciliacaoManual";
import { ConciliacaoInteligente } from "@/features/financeiro/conciliacao/ConciliacaoInteligente";
import { HistoricoExtratos } from "@/components/financas/HistoricoExtratos";
import { RelatorioCobertura } from "@/components/financas/RelatorioCobertura";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reconciliacao() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4 md:space-y-6">
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

      <Tabs defaultValue="inteligente" className="w-full">
        {/*
          5 abas não cabem legíveis num TabsList `grid-cols-5` fixo abaixo de
          ~640px (F7 §6.3/§6.5). Sem convenção existente no app para "muitas
          abas" responsivas (grep não achou outro TabsList com scroll
          horizontal) — optamos por scroll horizontal (`overflow-x-auto` +
          `flex w-max` em vez de `grid`) por ser o padrão recomendado do
          próprio Radix/shadcn para esse caso: preserva a semântica de Tabs
          (teclado, ARIA) sem precisar sincronizar um <Select> controlado à
          parte, que duplicaria estado por pouco ganho com só 5 itens.
        */}
        <TabsList className="mb-4 flex w-full justify-start gap-1 overflow-x-auto sm:grid sm:grid-cols-5">
          <TabsTrigger value="dashboard" className="shrink-0 sm:shrink">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="inteligente" className="shrink-0 sm:shrink">
            Modo Inteligente
          </TabsTrigger>
          <TabsTrigger value="manual" className="shrink-0 sm:shrink">
            Modo Clássico
          </TabsTrigger>
          <TabsTrigger value="historico" className="shrink-0 sm:shrink">
            Histórico
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="shrink-0 sm:shrink">
            Relatório
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <DashboardConciliacao />
        </TabsContent>
        <TabsContent value="inteligente">
          <ConciliacaoInteligente />
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
