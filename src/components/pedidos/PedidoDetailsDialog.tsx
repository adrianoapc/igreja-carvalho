import * as React from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, User, Mail, Phone, EyeOff, Sparkles, AlertTriangle } from "lucide-react";

interface PedidoDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: {
    id: string;
    status: string;
    observacoes_intercessor?: string | null;
    pessoa_id?: string | null;
    data_resposta?: string | null;
    pedido?: string;
    tipo?: string;
    anonimo?: boolean;
    nome_solicitante?: string | null;
    email_solicitante?: string | null;
    telefone_solicitante?: string | null;
    prioridade?: string | null;
    data_criacao?: string;
  };
  onUpdate: () => void;
}

export function PedidoDetailsDialog({ open, onOpenChange, pedido, onUpdate }: PedidoDetailsDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState(pedido.status);
  const [observacoes, setObservacoes] = React.useState(pedido.observacoes_intercessor || "");
  const [pessoaNome, setPessoaNome] = React.useState<string>("");
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchPessoaNome = async () => {
      if (pedido.pessoa_id) {
        const { data } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', pedido.pessoa_id)
          .single();
        if (data) setPessoaNome(data.nome);
      }
    };
    fetchPessoaNome();
  }, [pedido.pessoa_id]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const updateData: {
        status: string;
        observacoes_intercessor: string;
        data_resposta?: string;
      } = {
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

  const getNomeExibicao = () => {
    if (pedido.anonimo) return "Anônimo";
    if (pessoaNome) return pessoaNome;
    if (pedido.profiles?.nome) return pedido.profiles.nome;
    if (pedido.nome_solicitante) return pedido.nome_solicitante;
    return "Não identificado";
  };

  const mascarar = (texto: string | null | undefined) => {
    if (!texto) return "";
    if (texto.includes("@")) {
      // Email
      const [user, domain] = texto.split("@");
      return `${user.substring(0, 2)}***@${domain}`;
    }
    // Telefone
    return texto.substring(0, 4) + "***" + texto.substring(texto.length - 2);
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title="Detalhes do Pedido de Oração"
    >
      <div className="flex flex-col h-full">
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{getNomeExibicao()}</span>
                {pedido.anonimo && (
                  <Badge variant="secondary" className="gap-1">
                    <EyeOff className="w-3 h-3" />
                    Anônimo
                  </Badge>
                )}
              </div>
              {!pedido.anonimo && pedido.email_solicitante && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-3 h-3" />
                  {pedido.email_solicitante}
                </div>
              )}
              {pedido.anonimo && pedido.email_solicitante && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-3 h-3" />
                  {mascarar(pedido.email_solicitante)}
                </div>
              )}
              {!pedido.anonimo && pedido.telefone_solicitante && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {pedido.telefone_solicitante}
                </div>
              )}
              {pedido.anonimo && pedido.telefone_solicitante && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {mascarar(pedido.telefone_solicitante)}
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

          {/* AI Analysis Section */}
          {pedido.analise_ia_titulo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <Label>Análise IA</Label>
                {pedido.analise_ia_gravidade === 'critica' && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Crítico
                  </Badge>
                )}
                {pedido.analise_ia_gravidade === 'media' && (
                  <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
                    Atenção
                  </Badge>
                )}
                {pedido.analise_ia_gravidade === 'baixa' && (
                  <Badge variant="secondary" className="text-xs">Normal</Badge>
                )}
              </div>
              <div className="bg-primary/5 border border-primary/10 p-4 rounded-md space-y-2">
                <p className="font-medium">{pedido.analise_ia_titulo}</p>
                {pedido.analise_ia_motivo && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Categoria:</span> {pedido.analise_ia_motivo}
                  </p>
                )}
                {pedido.analise_ia_resposta && (
                  <p className="text-sm text-muted-foreground italic">
                    {pedido.analise_ia_resposta}
                  </p>
                )}
              </div>
            </div>
          )}

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
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex justify-end gap-2">
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
    </ResponsiveDialog>
  );
}
