import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Trash2,
  Link2,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { toast } from "sonner";
import { buscarPixRecebidos, getSantanderIntegracaoId } from "@/hooks/useSantanderPix";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PixWebhookItem {
  id: string;
  pix_id: string;
  valor: number;
  pagador_nome?: string;
  pagador_cpf_cnpj?: string;
  descricao?: string;
  data_pix: string;
  status: "recebido" | "processado" | "vinculado" | "erro";
  erro_mensagem?: string;
  created_at: string;
}

export function PixWebhookReceiver() {
  const { formatValue } = useHideValues();
  const { igrejaId } = useAuthContext();
  const queryClient = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<
    "todos" | "recebido" | "processado" | "vinculado" | "erro"
  >("recebido");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Query para buscar PIX recebidos
  const {
    data: pixRecebidos = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["pix-webhook-temp", igrejaId, filtroStatus],
    queryFn: async () => {
      if (!igrejaId) return [];

      console.log('[PixWebhook] Buscando PIX - Igreja:', igrejaId, 'Filtro:', filtroStatus);

      let query = supabase
        .from("pix_webhook_temp")
        .select("*")
        .eq("igreja_id", igrejaId)
        .order("data_pix", { ascending: false });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[PixWebhook] Erro ao buscar:', error);
        throw error;
      }
      
      console.log('[PixWebhook] PIX encontrados:', data?.length || 0);
      return data as PixWebhookItem[];
    },
    enabled: !!igrejaId,
    refetchOnWindowFocus: false,
  });

  // Handler para vincular PIX com oferta
  const handleVincular = (pix: PixWebhookItem) => {
    console.log('[PixWebhook] Vinculando PIX:', pix.pix_id);
    toast.info("Função de vinculação em desenvolvimento", {
      description: `PIX de ${formatValue(pix.valor)} será vinculado ao relatório de ofertas`,
    });
    // TODO: Implementar navegação para RelatorioOferta com PIX pré-selecionado
  };

  // Handler para deletar PIX
  const handleDelete = async () => {
    if (!deleteId || !igrejaId) return;

    setIsDeleting(true);
    console.log('[PixWebhook] Iniciando deleção - ID:', deleteId, 'Igreja:', igrejaId);
    
    try {
      // Usar service role através de uma Edge Function ou fazer direto com auth
      const { data: deleteResult, error } = await supabase
        .from("pix_webhook_temp")
        .delete()
        .eq("id", deleteId)
        .eq("igreja_id", igrejaId)
        .select();

      console.log('[PixWebhook] Resultado da deleção:', { deleteResult, error });

      if (error) {
        console.error('[PixWebhook] Erro ao deletar:', error);
        throw error;
      }

      if (!deleteResult || deleteResult.length === 0) {
        console.warn('[PixWebhook] Nenhum registro foi deletado. Pode ser problema de permissão RLS.');
        toast.warning("PIX não encontrado ou sem permissão para deletar");
        setDeleteId(null);
        setIsDeleting(false);
        return;
      }

      console.log('[PixWebhook] PIX deletado com sucesso:', deleteResult);
      toast.success("PIX deletado com sucesso");
      
      // Limpar estado
      setDeleteId(null);
      
      // Invalidar cache e refetch
      queryClient.setQueryData(
        ["pix-webhook-temp", igrejaId, filtroStatus],
        (old: PixWebhookItem[] = []) => old.filter((item) => item.id !== deleteId)
      );
      
      // Aguardar refetch completar
      setTimeout(() => {
        refetch();
      }, 100);
      
    } catch (error: any) {
      console.error("[PixWebhook] Exceção ao deletar PIX:", error);
      toast.error(`Erro ao deletar PIX: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler para sincronizar PIX via API (polling)
  const handleSyncPix = async () => {
    if (!igrejaId) return;

    setIsSyncing(true);
    try {
      console.log('[PixWebhook] Sincronizando PIX via API Santander...');
      
      // Buscar integração ativa
      const integracaoId = await getSantanderIntegracaoId(igrejaId);
      if (!integracaoId) {
        toast.error("Integração Santander não encontrada", {
          description: "Configure a integração em Finanças > Integrações",
        });
        return;
      }

      // Buscar PIX dos últimos 7 dias
      const hoje = new Date();
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(hoje.getDate() - 7);

      const resultado = await buscarPixRecebidos({
        integracaoId,
        igrejaId,
        dataInicio: seteDiasAtras.toISOString(),
        dataFim: hoje.toISOString(),
      });

      console.log('[PixWebhook] Resultado da sincronização:', resultado);

      toast.success("PIX sincronizados com sucesso!", {
        description: `${resultado.importados || 0} novos PIX importados, ${resultado.duplicados || 0} já existentes`,
      });

      // Refetch para atualizar a lista
      await refetch();
    } catch (error: any) {
      console.error("[PixWebhook] Erro ao sincronizar PIX:", error);
      toast.error("Erro ao buscar PIX via API", {
        description: error.message || "Verifique a integração com Santander",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Calcular totais
  const totalRecebidos = pixRecebidos.reduce(
    (sum, item) => sum + item.valor,
    0
  );
  const quantidadeRecebida = pixRecebidos.length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "recebido":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "processado":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "vinculado":
        return <Link2 className="w-4 h-4 text-purple-500" />;
      case "erro":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "recebido":
        return (
          <Badge variant="outline" className="bg-blue-50">
            Recebido
          </Badge>
        );
      case "processado":
        return (
          <Badge variant="outline" className="bg-green-50">
            Processado
          </Badge>
        );
      case "vinculado":
        return (
          <Badge variant="outline" className="bg-purple-50">
            Vinculado
          </Badge>
        );
      case "erro":
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">PIX Recebidos (Webhook)</h2>
          <p className="text-sm text-muted-foreground">
            Transações recebidas em tempo real via webhook do banco
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSyncPix}
            variant="outline"
            size="sm"
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sincronizar via API
          </Button>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <TrendingUp className="w-4 h-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Recebido</p>
              <p className="text-2xl font-bold">
                {formatValue(totalRecebidos)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quantidade</p>
              <p className="text-2xl font-bold">{quantidadeRecebida}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex gap-1 mt-1">
                {filtroStatus === "recebido" && (
                  <Badge className="bg-blue-100 text-blue-800">
                    Aguardando processamento
                  </Badge>
                )}
                {filtroStatus === "processado" && (
                  <Badge className="bg-green-100 text-green-800">
                    Processado
                  </Badge>
                )}
                {filtroStatus === "vinculado" && (
                  <Badge className="bg-purple-100 text-purple-800">
                    Vinculado
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtro de Status */}
      <div className="flex gap-2 flex-wrap">
        {(
          ["todos", "recebido", "processado", "vinculado", "erro"] as const
        ).map((status) => (
          <Button
            key={status}
            variant={filtroStatus === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroStatus(status)}
          >
            {status === "todos" && "Todos"}
            {status === "recebido" && "Recebidos"}
            {status === "processado" && "Processados"}
            {status === "vinculado" && "Vinculados"}
            {status === "erro" && "Erros"}
          </Button>
        ))}
      </div>

      {/* Lista de PIX */}
      <Card>
        <CardHeader>
          <CardTitle>PIX Recebidos</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] border rounded-lg">
            {isLoading || isFetching ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pixRecebidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum PIX recebido neste filtro
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {pixRecebidos.map((pix) => (
                  <div
                    key={pix.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Ícone Status */}
                        <div className="flex-shrink-0 mt-0.5">
                          {getStatusIcon(pix.status)}
                        </div>

                        {/* Informações */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate">
                              {pix.pagador_nome || "PIX Anônimo"}
                            </p>
                            {getStatusBadge(pix.status)}
                          </div>

                          <p className="text-sm text-muted-foreground truncate">
                            {pix.descricao || "Sem descrição"}
                          </p>

                          {pix.pagador_cpf_cnpj && (
                            <p className="text-xs text-muted-foreground">
                              {pix.pagador_cpf_cnpj}
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground mt-1">
                            Recebido em{" "}
                            {format(
                              new Date(pix.data_pix),
                              "dd/MM/yyyy HH:mm",
                              {
                                locale: ptBR,
                              }
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Valor e Ações */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-green-600 mb-2">
                          {formatValue(pix.valor)}
                        </p>

                        <div className="flex gap-1">
                          {pix.status === "recebido" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              title="Vincular com oferta"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVincular(pix);
                              }}
                            >
                              <Link2 className="w-3 h-3" />
                            </Button>
                          )}

                          {pix.erro_mensagem && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              title={pix.erro_mensagem}
                            >
                              <AlertCircle className="w-3 h-3 text-red-500" />
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-destructive hover:text-destructive"
                            title="Deletar PIX"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('[PixWebhook] Deletando PIX:', pix.pix_id);
                              setDeleteId(pix.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30">
        <CardContent className="pt-6 text-sm text-muted-foreground space-y-2">
          <p>
            💡 <strong>Como funciona:</strong> Os PIX são recebidos via webhook
            do banco em tempo real. Cada transação fica aguardando processamento
            para ser vinculada com o relatório de ofertas e classificada por
            culto.
          </p>
          <p>
            🔄 <strong>Webhook não funcionando?</strong> Use o botão "Sincronizar via API" 
            para buscar PIX recebidos dos últimos 7 dias diretamente da API do Santander. 
            Ideal para resgatar transações que não chegaram via webhook.
          </p>
        </CardContent>
      </Card>

      {/* Alert Dialog para confirmação de deleção */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar PIX Recebido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro do PIX será permanentemente removido da tabela temporária.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
