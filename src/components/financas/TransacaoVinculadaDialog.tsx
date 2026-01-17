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
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, ArrowUpRight, ArrowDownLeft } from "lucide-react";
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
          <DialogTitle className="flex items-center gap-2">
            {transacao?.tipo === "entrada" ? (
              <ArrowDownLeft className="w-5 h-5 text-green-600" />
            ) : (
              <ArrowUpRight className="w-5 h-5 text-red-600" />
            )}
            Lançamento Vinculado
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : transacao ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Descrição</label>
              <p className="font-medium">{transacao.descricao}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Valor</label>
                <p
                  className={`font-semibold text-lg ${
                    transacao.tipo === "entrada" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {transacao.tipo === "entrada" ? "+" : "-"}
                  {formatCurrency(transacao.valor)}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge
                    variant={transacao.status === "pago" ? "default" : "secondary"}
                    className={
                      transacao.status === "pago"
                        ? "bg-green-500/10 text-green-600 border-green-200"
                        : ""
                    }
                  >
                    {transacao.status === "pago" ? "Pago" : "Pendente"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Vencimento</label>
                <p>{formatDate(transacao.data_vencimento)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Pagamento</label>
                <p>{formatDate(transacao.data_pagamento)}</p>
              </div>
            </div>

            {transacao.categoria && (
              <div>
                <label className="text-sm text-muted-foreground">Categoria</label>
                <div className="flex items-center gap-2 mt-1">
                  {transacao.categoria.cor && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: transacao.categoria.cor }}
                    />
                  )}
                  <span>{transacao.categoria.nome}</span>
                </div>
              </div>
            )}

            {transacao.conta && (
              <div>
                <label className="text-sm text-muted-foreground">Conta</label>
                <p>
                  {transacao.conta.nome}
                  {transacao.conta.banco && ` • ${transacao.conta.banco}`}
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
