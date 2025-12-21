import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";

interface CompletarCadastroDialogProps {
  visitanteId: string | null;
  nomeAtual?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CompletarCadastroDialog({
  visitanteId,
  nomeAtual,
  open,
  onOpenChange,
  onSuccess,
}: CompletarCadastroDialogProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(nomeAtual || "");
  const [dataNascimento, setDataNascimento] = useState("");
  const [email, setEmail] = useState("");

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!visitanteId) {
        throw new Error("ID do visitante não informado");
      }

      const updateData: Record<string, any> = {};
      if (nome.trim()) updateData.nome = nome.trim();
      if (email.trim()) updateData.email = email.trim();

      const { error } = await supabase
        .from("visitantes_leads")
        .update(updateData)
        .eq("id", visitanteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      queryClient.invalidateQueries({ queryKey: ["atendimento-pastoral"] });
      toast.success("Cadastro atualizado!");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error("Erro ao atualizar cadastro");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome completo");
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Completar Cadastro
            </DialogTitle>
            <DialogDescription>
              Preencha os dados básicos do visitante para facilitar o acompanhamento.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome-completo">
                Nome Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome-completo"
                placeholder="Nome completo do visitante"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-nascimento">Data de Nascimento</Label>
              <Input
                id="data-nascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
