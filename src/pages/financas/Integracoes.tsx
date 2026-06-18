import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, TestTube2, Loader2, Download, History, FolderSearch, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { IntegracaoCriarDialog } from "@/components/financas/IntegracoesCriarDialog";
import { IntegracaoLogsDialog } from "@/components/financas/IntegracaoLogsDialog";
import { WebhookStatusBadge } from "@/components/financas/IntegracaoWebhookTab";
import { GetnetListFilesDialog } from "@/components/financas/GetnetListFilesDialog";
import { GetnetImportDialog } from "@/components/financas/GetnetImportDialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Integracao = Database["public"]["Tables"]["integracoes_financeiras"]["Row"];

export default function Integracoes() {
  const { igrejaId } = useIgrejaId();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [logsIntegracaoId, setLogsIntegracaoId] = useState<string | null>(null);
  const [listFilesIntegracao, setListFilesIntegracao] = useState<Integracao | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [importDialog, setImportDialog] = useState<{
    integracao: Integracao;
    initialDate?: string;
    initialFileName?: string;
  } | null>(null);


  // Buscar integrações
  const { data: integracoes, isLoading, error } = useQuery({
    queryKey: ["integracoes_financeiras", igrejaId],
    queryFn: async () => {
      // Buscar TODAS as integrações da igreja (não filtrar por filial)
      // Integrações são configurações de infraestrutura, não dependem de filial selecionada
      const { data, error } = await supabase
        .from("integracoes_financeiras")
        .select("*")
        .eq("igreja_id", igrejaId!)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }
      return data || [];
    },
    enabled: !!igrejaId,
  });

  // Buscar último evento de webhook PIX por igreja (apenas Santander hoje)
  const { data: lastPixEvent } = useQuery({
    queryKey: ["pix_webhook_last_event", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return null;
      const { data } = await supabase
        .from("pix_webhook_temp")
        .select("data_recebimento")
        .eq("igreja_id", igrejaId)
        .order("data_recebimento", { ascending: false })
        .limit(1);
      return data?.[0]?.data_recebimento ?? null;
    },
    enabled: !!igrejaId,
    refetchInterval: 60000,
  });

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("integracoes_financeiras")
        .delete()
        .eq("id", deleteId)
        .eq("igreja_id", igrejaId!);

      if (error) throw error;

      toast.success("Integração deletada com sucesso");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["integracoes_financeiras", igrejaId],
      });
    } catch (error) {
      console.error("Error deleting integration:", error);
      toast.error("Erro ao deletar integração");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (integracaoId: string) => {
    console.log('[Integracoes] Editando integração:', integracaoId);
    setEditingId(integracaoId);
    setOpenDialog(true);
  };

  const handleTest = async (integracao: Integracao) => {
    console.log('[Integracoes] Testando integração:', integracao.id, integracao.provedor);

    // Getnet via SFTP: usa edge function getnet-sftp
    if (
      integracao.provedor === "getnet" &&
      (integracao as { tipo_auth?: string }).tipo_auth === "sftp"
    ) {
      setTestingId(integracao.id);
      try {
        const { data, error } = await supabase.functions.invoke("getnet-sftp", {
          body: { action: "test_connection", integracao_id: integracao.id },
        });
        if (error) {
          toast.error(`Erro no teste: ${error.message}`);
          return;
        }
        if (data?.success) {
          toast.success("Conexão SFTP OK!", {
            description: `${data.host}:${data.port} — ${data.files_count} arquivo(s) em ${data.path}`,
          });
        } else {
          toast.error("Falha na conexão SFTP", {
            description: data?.error || "Verifique credenciais e endereço",
          });
        }
      } catch (err) {
        console.error("SFTP test exception:", err);
        toast.error("Erro ao testar conexão SFTP");
      } finally {
        setTestingId(null);
      }
      return;
    }

    if (integracao.provedor !== "santander") {
      toast.info("Teste disponível apenas para Santander e Getnet (SFTP) no momento");
      return;
    }


    setTestingId(integracao.id);
    try {
      // Buscar conta vinculada pelo CNPJ do Santander
      const { data: contaVinculada, error: contaError } = await supabase
        .from("contas")
        .select("id, agencia, conta_numero, cnpj_banco")
        .eq("igreja_id", igrejaId!)
        .eq("cnpj_banco", "90400888000142")
        .eq("ativo", true)
        .maybeSingle();

      if (contaError) {
        console.error("Erro ao buscar conta:", contaError);
        toast.error("Erro ao buscar conta vinculada");
        setTestingId(null);
        return;
      }

      if (!contaVinculada) {
        toast.error("Nenhuma conta Santander configurada", {
          description: "Configure uma conta bancária com CNPJ do Santander para testar",
        });
        setTestingId(null);
        return;
      }

      if (!contaVinculada.agencia || !contaVinculada.conta_numero) {
        toast.error("Dados da conta incompletos", {
          description: "Preencha agência e número da conta",
        });
        setTestingId(null);
        return;
      }

      // Usar nova edge function santander-api com action: 'saldo'
      const { data, error } = await supabase.functions.invoke("santander-api", {
        body: {
          action: "saldo",
          integracao_id: integracao.id,
          conta_id: contaVinculada.id,
        },
      });

      if (error) {
        console.error("Test error:", error);
        toast.error(`Erro no teste: ${error.message}`);
        return;
      }

      console.log("Test result:", data);

      if (data.success) {
        const saldo = data.balance?.available ?? data.balance?.current ?? "N/A";
        toast.success("Conexão testada com sucesso!", {
          description: `Saldo: ${typeof saldo === 'number' ? saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : saldo}`,
        });
      } else if (data.tokenSuccess) {
        toast.warning("Autenticação OK, erro no saldo", {
          description: data.balanceError || "Verifique os logs",
        });
      } else {
        toast.error("Falha na conexão", {
          description: data.error || "Verifique os logs",
        });
      }
    } catch (err) {
      console.error("Test exception:", err);
      toast.error("Erro ao testar conexão");
    } finally {
      setTestingId(null);
    }
  };

  const handleImport = (integracao: Integracao) => {
    setImportDialog({ integracao });
  };

  const handleImportFile = (integracao: Integracao, fileName: string, dataReferencia: string) => {
    setImportDialog({ integracao, initialDate: dataReferencia, initialFileName: fileName });
  };

  const handleSync = async (integracao: Integracao) => {
    setSyncingId(integracao.id);
    try {
      const { data, error } = await supabase.functions.invoke("getnet-sftp", {
        body: { action: "sync", integracao_id: integracao.id },
      });
      if (error) {
        toast.error(`Erro na sincronização: ${error.message}`);
        return;
      }
      if (data?.success || data?.status === "partial") {
        const desc = data.new_found === 0
          ? "Nenhum arquivo novo encontrado"
          : `${data.processed} de ${data.new_found} arquivo(s) importado(s)`;
        toast.success("Sincronização concluída", { description: desc });
      } else {
        toast.error("Falha na sincronização", {
          description: data?.errors > 0
            ? `${data.errors} erro(s) ao processar arquivos`
            : data?.error || "Verifique os logs",
        });
      }
    } catch (err) {
      console.error("Sync exception:", err);
      toast.error("Erro ao sincronizar");
    } finally {
      setSyncingId(null);
    }
  };

  const getProviderLabel = (provedor: string) => {
    const labels: Record<string, string> = {
      santander: "Santander",
      getnet: "Getnet",
      api_generico: "API Genérica",
    };
    return labels[provedor] || provedor;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "outline"> = {
      ativo: "default",
      inativo: "outline",
      erro: "destructive",
    };
    const labels: Record<string, string> = {
      ativo: "Ativo",
      inativo: "Inativo",
      erro: "Erro",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando integrações...</p>
      </div>
    );
  }

  if (error) {
    console.error('[Integracoes] Query error:', error);
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive font-semibold">Erro ao carregar integrações</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Erro desconhecido'}
        </p>
        <Button
          onClick={() =>
            queryClient.invalidateQueries({
              queryKey: ["integracoes_financeiras", igrejaId],
            })
          }
        >
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrações Financeiras</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as conexões com provedores de serviços financeiros
          </p>
        </div>
        <Button onClick={() => setOpenDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Integração
        </Button>
      </div>

      {integracoes && integracoes.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provedor</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Webhook</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integracoes.map((integracao: Integracao) => (
                <TableRow key={integracao.id}>
                  <TableCell className="font-medium">
                    {getProviderLabel(integracao.provedor)}
                  </TableCell>
                  <TableCell>{integracao.cnpj}</TableCell>
                  <TableCell>{getStatusBadge(integracao.status)}</TableCell>
                  <TableCell>
                    {integracao.provedor === "santander" ? (
                      <WebhookStatusBadge ultimoEvento={lastPixEvent ?? null} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {integracao.filial_id ? "Específica" : "Geral"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(integracao.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {(integracao.provedor === "santander" ||
                        (integracao as { tipo_auth?: string }).tipo_auth === "sftp") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTest(integracao);
                          }}
                          disabled={testingId === integracao.id}
                          title="Testar conexão"
                        >
                          {testingId === integracao.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <TestTube2 className="w-4 h-4 text-blue-500" />
                          )}
                        </Button>
                      )}
                      {(integracao as { tipo_auth?: string }).tipo_auth === "sftp" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setListFilesIntegracao(integracao);
                            }}
                            title="Listar arquivos disponíveis no SFTP"
                          >
                            <FolderSearch className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSync(integracao);
                            }}
                            disabled={syncingId === integracao.id}
                            title="Sincronizar arquivos pendentes automaticamente"
                          >
                            {syncingId === integracao.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                            ) : (
                              <RefreshCw className="w-4 h-4 text-purple-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleImport(integracao);
                            }}
                            title="Importar extrato por data"
                          >
                            <Download className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setLogsIntegracaoId(integracao.id);
                            }}
                            title="Histórico de execuções"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                        </>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('[Integracoes] Botão Editar clicado:', integracao.id);
                          handleEdit(integracao.id);
                        }}
                        title="Editar integração"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('[Integracoes] Botão Deletar clicado:', integracao.id);
                          setDeleteId(integracao.id);
                        }}
                        title="Deletar integração"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Nenhuma integração configurada ainda
          </p>
          <Button onClick={() => setOpenDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Criar primeira integração
          </Button>
        </div>
      )}

      <IntegracaoCriarDialog
        open={openDialog}
        onOpenChange={(open) => {
          setOpenDialog(open);
          if (!open) setEditingId(null);
        }}
        integracaoId={editingId}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ["integracoes_financeiras", igrejaId],
          });
        }}
      />

      <IntegracaoLogsDialog
        open={!!logsIntegracaoId}
        onOpenChange={(open) => !open && setLogsIntegracaoId(null)}
        integracaoId={logsIntegracaoId}
      />

      <GetnetListFilesDialog
        open={!!listFilesIntegracao}
        onOpenChange={(open) => !open && setListFilesIntegracao(null)}
        integracao={listFilesIntegracao}
        onImportFile={handleImportFile}
      />

      <GetnetImportDialog
        open={!!importDialog}
        onOpenChange={(open) => !open && setImportDialog(null)}
        integracao={importDialog?.integracao ?? null}
        initialDate={importDialog?.initialDate}
        initialFileName={importDialog?.initialFileName}
      />



      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Integração?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A integração e todos os seus
              dados criptografados serão permanentemente removidos.
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
