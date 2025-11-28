import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, User, Mail, Phone } from "lucide-react";

interface PedidoDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: any;
  onUpdate: () => void;
}

export function PedidoDetailsDialog({ open, onOpenChange, pedido, onUpdate }: PedidoDetailsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(pedido.status);
  const [observacoes, setObservacoes] = useState(pedido.observacoes_intercessor || "");
  const { toast } = useToast();

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const updateData: any = {
        status,
        observacoes_intercessor: observacoes
      };

      if (status === "respondido" && !pedido.data_resposta) {
        updateData.data_resposta = new Date().toISOString();
      }

      const { error } = await supabase
        .from("pedidos_oracao")
        .update(updateData)
        .eq("id", pedido.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Pedido atualizado com sucesso"
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o pedido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const solicitante = pedido.anonimo 
    ? "Anônimo"
    : pedido.profiles?.nome || pedido.nome_solicitante || "Não identificado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Detalhes do Pedido de Oração</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{solicitante}</span>
              </div>
              {!pedido.anonimo && pedido.email_solicitante && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-3 h-3" />
                  {pedido.email_solicitante}
                </div>
              )}
              {!pedido.anonimo && pedido.telefone_solicitante && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {pedido.telefone_solicitante}
                </div>
              )}
            </div>
            <Badge variant="outline">{pedido.tipo}</Badge>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Criado em: {new Date(pedido.data_criacao).toLocaleDateString("pt-BR")}</span>
            </div>
            {pedido.data_alocacao && (
              <div className="flex items-center gap-1">
                <span>Alocado em: {new Date(pedido.data_alocacao).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            {pedido.data_resposta && (
              <div className="flex items-center gap-1">
                <span>Respondido em: {new Date(pedido.data_resposta).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Pedido</Label>
            <p className="text-sm bg-muted p-4 rounded-md">{pedido.pedido}</p>
          </div>

          {pedido.intercessores && (
            <div className="space-y-2">
              <Label>Intercessor Responsável</Label>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{pedido.intercessores.nome}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_oracao">Em Oração</SelectItem>
                <SelectItem value="respondido">Respondido</SelectItem>
                <SelectItem value="arquivado">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações do Intercessor</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Adicione observações sobre este pedido..."
              className="min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
