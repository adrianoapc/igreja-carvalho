import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useIgrejaId } from "@/hooks/useIgrejaId";

interface FormaPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formaPagamento?: { id: string | number; nome: string };
}

export function FormaPagamentoDialog({ open, onOpenChange, formaPagamento }: FormaPagamentoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const { igrejaId } = useIgrejaId();

  useEffect(() => {
    if (formaPagamento) {
      setNome(formaPagamento.nome);
    } else {
      setNome("");
    }
  }, [formaPagamento, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!igrejaId) {
        throw new Error("Igreja não identificada.");
      }
      if (formaPagamento) {
        const { error } = await supabase
          .from('formas_pagamento')
          .update({ nome })
          .eq('id', String(formaPagamento.id))
          .eq('igreja_id', igrejaId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('formas_pagamento')
          .insert({ nome, igreja_id: igrejaId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: formaPagamento ? "Forma de pagamento atualizada" : "Forma de pagamento criada",
        description: "A operação foi concluída com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast({
        title: "Erro",
        description: "O nome é obrigatório",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  };

  const title = formaPagamento ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento";

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{
        className: "max-w-lg max-h-[90vh] overflow-hidden flex flex-col",
      }}
      drawerContentProps={{
        className: "max-h-[95vh]",
      }}
    >
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: PIX, Dinheiro, Cartão"
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          </form>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
