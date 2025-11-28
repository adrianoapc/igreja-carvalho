import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EditarStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  statusAtual: "visitante" | "frequentador" | "membro";
  nome: string;
  onSuccess: () => void;
}

export function EditarStatusDialog({
  open,
  onOpenChange,
  pessoaId,
  statusAtual,
  nome,
  onSuccess,
}: EditarStatusDialogProps) {
  const [loading, setLoading] = useState(false);
  const [novoStatus, setNovoStatus] = useState<"visitante" | "frequentador" | "membro">(statusAtual);
  const [observacoes, setObservacoes] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setNovoStatus(statusAtual);
      setObservacoes("");
    }
  }, [open, statusAtual]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "visitante":
        return "Visitante";
      case "frequentador":
        return "Frequentador";
      case "membro":
        return "Membro";
      default:
        return status;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (novoStatus === statusAtual) {
      toast({
        title: "Nenhuma mudança",
        description: "Selecione um status diferente do atual",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const updateData: any = {
        status: novoStatus,
      };

      // Se está promovendo para membro, registrar data
      if (novoStatus === "membro" && statusAtual !== "membro") {
        updateData.data_cadastro_membro = new Date().toISOString();
      }

      // Atualizar observações se houver
      if (observacoes.trim()) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("observacoes")
          .eq("id", pessoaId)
          .single();

        const observacoesAtuais = profileData?.observacoes || "";
        const timestamp = new Date().toLocaleString("pt-BR");
        const novaObservacao = `[${timestamp}] Mudança de status de ${getStatusLabel(statusAtual)} para ${getStatusLabel(novoStatus)}: ${observacoes}`;
        
        updateData.observacoes = observacoesAtuais 
          ? `${observacoesAtuais}\n\n${novaObservacao}`
          : novaObservacao;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", pessoaId);

      if (error) throw error;

      // Notificar admins sobre a mudança
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", pessoaId)
        .single();

      if (profileData?.user_id) {
        await supabase.rpc("notify_admins", {
          p_title: "Mudança de Status",
          p_message: `${nome} foi promovido de ${getStatusLabel(statusAtual)} para ${getStatusLabel(novoStatus)}`,
          p_type: "promocao_status",
          p_related_user_id: profileData.user_id,
          p_metadata: {
            nome,
            status_anterior: statusAtual,
            status_novo: novoStatus,
          },
        });
      }

      toast({
        title: "Sucesso",
        description: `Status atualizado de ${getStatusLabel(statusAtual)} para ${getStatusLabel(novoStatus)}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Status</DialogTitle>
          <DialogDescription>
            Mudança de status de {nome}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Status atual: <strong>{getStatusLabel(statusAtual)}</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="novoStatus">Novo Status *</Label>
            <Select
              value={novoStatus}
              onValueChange={(value: "visitante" | "frequentador" | "membro") =>
                setNovoStatus(value)
              }
              disabled={loading}
            >
              <SelectTrigger id="novoStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visitante">Visitante</SelectItem>
                <SelectItem value="frequentador">Frequentador</SelectItem>
                <SelectItem value="membro">Membro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Motivo da mudança (opcional)</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Descreva o motivo da mudança de status..."
              disabled={loading}
              className="min-h-[80px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {observacoes.length}/500 caracteres
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || novoStatus === statusAtual}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Alterar Status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
