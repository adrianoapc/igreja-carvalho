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
import { useFilialId } from "@/hooks/useFilialId";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, RefreshCw } from "lucide-react";
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
  const { filialId, isAllFiliais } = useFilialId();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  console.log('[Integracoes] Component mounted/updated', {
    igrejaId,
    filialId,
    isAllFiliais,
  });

  // Buscar integrações
  const { data: integracoes, isLoading, error } = useQuery({
    queryKey: ["integracoes_financeiras", igrejaId, filialId],
    queryFn: async () => {
      console.log('[Integracoes] Fetching data...', { igrejaId, filialId, isAllFiliais });
      
      let query = supabase
        .from("integracoes_financeiras")
        .select("*")
        .eq("igreja_id", igrejaId!);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      console.log('[Integracoes] Query result:', { data, error, count: data?.length });

      if (error) {
        console.error('[Integracoes] Query error:', error);
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
        queryKey: ["integracoes_financeiras", igrejaId, filialId],
      });
    } catch (error) {
      console.error("Error deleting integration:", error);
      toast.error("Erro ao deletar integração");
    } finally {
      setIsDeleting(false);
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
              queryKey: ["integracoes_financeiras", igrejaId, filialId],
            })
          }
        >
          Tentar Novamente
        </Button>
      </div>
    );
  }

  console.log('[Integracoes] Render state:', {
    igrejaId,
    filialId,
    isAllFiliais,
    integracoesCount: integracoes?.length,
    integracoes,
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrações Financeiras</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as conexões com provedores de serviços financeiros
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ["integracoes_financeiras", igrejaId, filialId],
              })
            }
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={() => setOpenDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Integração
          </Button>
        </div>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        title="Edição em desenvolvimento"
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
        onOpenChange={setOpenDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ["integracoes_financeiras", igrejaId, filialId],
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
