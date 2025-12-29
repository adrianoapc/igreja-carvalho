import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
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
      const updateData: {
        status: string;
        data_cadastro_membro?: string;
        observacoes?: string;
      } = {
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
        .update(updateData as { status: "visitante" | "frequentador" | "membro"; data_cadastro_membro?: string; observacoes?: string })
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
    } catch (error: unknown) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : String(error) || "Não foi possível atualizar o status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title="Alterar Status"
    >
      <div className="flex flex-col h-full">
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <p className="text-sm text-muted-foreground mb-4">
            Mudança de status de {nome}
          </p>

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
          </form>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={loading || novoStatus === statusAtual}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Alterar Status
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
