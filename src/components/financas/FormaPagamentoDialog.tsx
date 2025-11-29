import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface FormaPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formaPagamento?: any;
}

export function FormaPagamentoDialog({ open, onOpenChange, formaPagamento }: FormaPagamentoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");

  useEffect(() => {
    if (formaPagamento) {
      setNome(formaPagamento.nome);
    } else {
      setNome("");
    }
  }, [formaPagamento, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (formaPagamento) {
        const { error } = await supabase
          .from('formas_pagamento')
          .update({ nome })
          .eq('id', formaPagamento.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('formas_pagamento')
          .insert({ nome });
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
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {formaPagamento ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
          </DialogTitle>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
