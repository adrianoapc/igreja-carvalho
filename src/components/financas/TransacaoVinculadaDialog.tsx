import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransacaoVinculadaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacaoId: string | null;
}

export function TransacaoVinculadaDialog({
  open,
  onOpenChange,
  transacaoId,
}: TransacaoVinculadaDialogProps) {
  const navigate = useNavigate();

  const { data: transacao, isLoading } = useQuery({
    queryKey: ["transacao-vinculada", transacaoId],
    queryFn: async () => {
      if (!transacaoId) return null;
      const { data, error } = await supabase
        .from("transacoes_financeiras")
        .select(`
          id,
          descricao,
          valor,
          tipo,
          status,
          data_vencimento,
          data_pagamento,
          categoria:categorias_financeiras(nome, cor),
          conta:contas(nome, banco),
          fornecedor:fornecedores(nome)
        `)
        .eq("id", transacaoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!transacaoId && open,
  });

  const handleNavigate = () => {
    if (!transacao) return;
    const route = transacao.tipo === "entrada" ? "/financas/entradas" : "/financas/saidas";
    navigate(route);
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentação Vinculada</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : transacao ? (
          <div className="mb-6">
            <div className="flex flex-col gap-1 text-sm">
              <span><b>Descrição:</b> {transacao.descricao}</span>
              <span><b>Valor:</b> {formatCurrency(transacao.valor)}</span>
              <span><b>Data:</b> {formatDate(transacao.data_pagamento || transacao.data_vencimento)}</span>
              <span className="flex items-center gap-1"><b>ID:</b> <span className="font-mono text-xs">{transacao.id}</span></span>
            </div>
            {transacao.conta && (
              <div>
                <label className="text-sm text-muted-foreground">Conta</label>
                <p>
                  {transacao.conta.nome}
                  {transacao.conta.banco ? (
                    <> - {transacao.conta.banco}</>
                  ) : null}
                </p>
              </div>
            )}
            {transacao.fornecedor && (
              <div>
                <label className="text-sm text-muted-foreground">
                  {transacao.tipo === "entrada" ? "Pagador" : "Fornecedor"}
                </label>
                <p>{transacao.fornecedor.nome}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Transação não encontrada
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {transacao && (
            <Button onClick={handleNavigate}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir {transacao.tipo === "entrada" ? "Entradas" : "Saídas"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
