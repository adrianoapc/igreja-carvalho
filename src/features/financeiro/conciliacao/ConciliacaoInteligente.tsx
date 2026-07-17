import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { QuickCreateTransacaoDialog } from "@/components/financas/QuickCreateTransacaoDialog";
import { TransacaoDetalheDrawer } from "@/components/financas/TransacaoDetalheDrawer";
import { useConciliacaoInteligente } from "./hooks/useConciliacaoInteligente";
import { ConciliacaoInteligenteFiltros } from "./components/ConciliacaoInteligenteFiltros";
import { ConciliacaoInteligenteBalanco } from "./components/ConciliacaoInteligenteBalanco";
import { ExtratoPainel } from "./components/ExtratoPainel";
import { TransacaoPainel } from "./components/TransacaoPainel";
import type { ExtratoItem } from "./hooks/useConciliacaoInteligente";
import type { TransacaoItemComScore } from "./components/TransacaoListItem";

/**
 * Tela de Conciliação Inteligente (F7 sub-frente 2/5 — decomposição +
 * responsivo). Orquestrador enxuto: toda a lógica de dados/mutações mora em
 * `useConciliacaoInteligente`; a UI é composta por subcomponentes focados
 * (`ExtratoPainel`/`TransacaoPainel`/itens/filtros/balanço).
 *
 * Desktop (md+): mantém o layout original de 2 colunas + barra central fixa.
 * Mobile (<768px): painéis viram abas (mesmo padrão já usado em
 * `ConciliacaoManual`) + resumo/confirmar como barra fixa no rodapé (mesmo
 * padrão do `TransacaoDialog` — ações sempre visíveis, independente da aba
 * ativa, já que a confirmação depende de itens selecionados nos DOIS lados).
 */
export function ConciliacaoInteligente() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const data = useConciliacaoInteligente();

  const [activeTab, setActiveTab] = useState<"banco" | "sistema">("banco");
  const [quickCreateDialogOpen, setQuickCreateDialogOpen] = useState(false);
  const [extratoParaQuickCreate, setExtratoParaQuickCreate] =
    useState<ExtratoItem | null>(null);
  const [transacaoDetalheOpen, setTransacaoDetalheOpen] = useState(false);
  const [transacaoSelecionada, setTransacaoSelecionada] =
    useState<TransacaoItemComScore | null>(null);

  const handleOpenQuickCreate = (e: React.MouseEvent, extrato: ExtratoItem) => {
    e.stopPropagation();
    setExtratoParaQuickCreate(extrato);
    setQuickCreateDialogOpen(true);
  };

  const handleQuickCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["extratos-pendentes-inteligente"] });
    queryClient.invalidateQueries({ queryKey: ["transacoes-pendentes-inteligente"] });
  };

  const handleAceitarSugestao = (extratoId: string, transacaoId?: string) => {
    data.setSelectedExtratos([extratoId]);
    if (transacaoId) {
      data.setSelectedTransacoes([transacaoId]);
    }
    toast.success('Sugestão aceita - clique em "Confirmar" para vincular');
    if (isMobile) setActiveTab("sistema");
  };

  const handleAjustarValores = (item: TransacaoItemComScore) => {
    setTransacaoSelecionada(item);
    setTransacaoDetalheOpen(true);
  };

  const balanco = (
    <ConciliacaoInteligenteBalanco
      totalExtratos={data.totalExtratos}
      totalTransacoes={data.totalTransacoes}
      diferenca={data.diferenca}
      hasSelecao={
        data.selectedExtratos.length > 0 || data.selectedTransacoes.length > 0
      }
      confirming={data.confirmarConciliacao.isPending}
      onConfirmar={() => data.confirmarConciliacao.mutate()}
      variant={isMobile ? "footer" : "sidebar"}
    />
  );

  const extratoPainel = (
    <ExtratoPainel
      extratos={data.extratosFiltrados}
      totalExtratosBrutos={data.totalExtratosBrutos}
      loading={data.loadingExtratos}
      selectedExtratos={data.selectedExtratos}
      sugestoesMap={data.sugestoesMap}
      isRejectingSugestao={data.rejeitarSugestao.isPending}
      mesExtratos={data.mesExtratos}
      onMesExtratosChange={data.setMesExtratos}
      extratosCustomRange={data.extratosCustomRange}
      onExtratosCustomRangeChange={data.setExtratosCustomRange}
      onSelect={data.handleSelectExtrato}
      onLimparSelecao={() => data.setSelectedExtratos([])}
      onAceitarSugestao={handleAceitarSugestao}
      onRejeitarSugestao={(id) => data.rejeitarSugestao.mutate(id)}
      onOpenQuickCreate={handleOpenQuickCreate}
      className={
        isMobile
          ? "flex flex-col h-[calc(100vh-360px)]"
          : "flex-1 flex flex-col border rounded-lg overflow-hidden bg-card"
      }
    />
  );

  const transacaoPainel = (
    <TransacaoPainel
      transacoes={data.sortedTransacoes}
      loading={data.loadingTransacoes}
      selectedTransacoes={data.selectedTransacoes}
      contas={data.contas}
      mesTransacoes={data.mesTransacoes}
      onMesTransacoesChange={data.setMesTransacoes}
      transacoesCustomRange={data.transacoesCustomRange}
      onTransacoesCustomRangeChange={data.setTransacoesCustomRange}
      onSelect={data.handleSelectTransacao}
      onLimparSelecao={() => data.setSelectedTransacoes([])}
      onAjustarValores={handleAjustarValores}
      onMarcarConferenciaManual={(id) => data.marcarConferenciaManual.mutate(id)}
      className={
        isMobile
          ? "flex flex-col h-[calc(100vh-360px)]"
          : "flex-1 flex flex-col border rounded-lg overflow-hidden bg-card"
      }
    />
  );

  return (
    <div className="space-y-4">
      <ConciliacaoInteligenteFiltros
        contas={data.contas}
        contaFiltro={data.contaFiltro}
        onContaFiltroChange={data.setContaFiltro}
        tipoFiltro={data.tipoFiltro}
        onTipoFiltroChange={data.setTipoFiltro}
        searchExtrato={data.searchExtrato}
        onSearchExtratoChange={data.setSearchExtrato}
        gerando={data.gerando}
        onRegenerarSugestoes={data.regenerarSugestoes}
      />

      {isMobile ? (
        <div className="pb-20">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "banco" | "sistema")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="banco">
                Banco ({data.extratosFiltrados.length})
              </TabsTrigger>
              <TabsTrigger value="sistema">
                Sistema ({data.sortedTransacoes.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="banco" className="mt-3">
              {extratoPainel}
            </TabsContent>
            <TabsContent value="sistema" className="mt-3">
              {transacaoPainel}
            </TabsContent>
          </Tabs>
          {balanco}
        </div>
      ) : (
        <div className="flex gap-3 h-[calc(100vh-320px)]">
          {extratoPainel}
          {balanco}
          {transacaoPainel}
        </div>
      )}

      <QuickCreateTransacaoDialog
        open={quickCreateDialogOpen}
        onOpenChange={setQuickCreateDialogOpen}
        extratoItem={extratoParaQuickCreate}
        onSuccess={handleQuickCreateSuccess}
      />

      {transacaoSelecionada && (
        <TransacaoDetalheDrawer
          open={transacaoDetalheOpen}
          onOpenChange={setTransacaoDetalheOpen}
          transacao={{
            id: transacaoSelecionada.id,
            descricao: transacaoSelecionada.descricao,
            valor: transacaoSelecionada.valor,
            valor_liquido: transacaoSelecionada.valor_liquido,
            taxas_administrativas: transacaoSelecionada.taxas_administrativas,
            juros: transacaoSelecionada.juros,
            multas: transacaoSelecionada.multas,
            desconto: transacaoSelecionada.desconto,
            data_pagamento: transacaoSelecionada.data_pagamento,
          }}
          onUpdated={() => {
            queryClient.invalidateQueries({
              queryKey: ["transacoes-pendentes-inteligente"],
            });
            toast.success("Valores atualizados");
          }}
        />
      )}
    </div>
  );
}
