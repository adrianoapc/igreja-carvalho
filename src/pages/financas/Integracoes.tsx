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
import { Plus, Edit2, Trash2, TestTube2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IntegracaoCriarDialog } from "@/components/financas/IntegracoesCriarDialog";
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
    setEditingId(integracaoId);
    setOpenDialog(true);
  };

  const handleTest = async (integracao: Integracao) => {
    if (integracao.provedor !== "santander") {
      toast.info("Teste disponível apenas para Santander no momento");
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
                  <TableCell className="text-sm text-muted-foreground">
                    {integracao.filial_id ? "Específica" : "Geral"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(integracao.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {integracao.provedor === "santander" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(integracao)}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(integracao.id)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(integracao.id)}
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
