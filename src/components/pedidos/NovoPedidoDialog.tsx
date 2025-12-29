import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface NovoPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialDescription?: string;
}

export function NovoPedidoDialog({ open, onOpenChange, onSuccess, initialDescription }: NovoPedidoDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [anonimo, setAnonimo] = React.useState(false);
  const [tipo, setTipo] = React.useState("outro");
  const [pedido, setPedido] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const { toast } = useToast();
  const { user, profile } = useAuth();

  // Preencher pedido com valor inicial quando dialog abre
  React.useEffect(() => {
    if (open && initialDescription) {
      setPedido(initialDescription);
    }
  }, [open, initialDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Buscar pessoa por contato se não estiver autenticado
      let pessoaId = null;
      if (!user && (nome || email || telefone)) {
        const { data: pessoaData } = await supabase.rpc('buscar_pessoa_por_contato', {
          p_nome: nome || null,
          p_email: email || null,
          p_telefone: telefone || null,
        });
        pessoaId = pessoaData;
      }

      const pedidoData: {
        tipo: "agradecimento" | "espiritual" | "familia" | "financeiro" | "outro" | "saude" | "trabalho";
        pedido: string;
        anonimo: boolean;
        status: "pendente" | "em_oracao" | "respondido" | "arquivado";
        membro_id?: string;
        pessoa_id?: string | null;
        nome_solicitante?: string;
        email_solicitante?: string;
        telefone_solicitante?: string;
      } = {
        tipo: tipo as "agradecimento" | "espiritual" | "familia" | "financeiro" | "outro" | "saude" | "trabalho",
        pedido,
        anonimo,
        status: "pendente"
      };

      if (!anonimo) {
        if (user) {
          pedidoData.membro_id = user.id;
          // Também salvar pessoa_id para permitir filtrar por profile
          if (profile?.id) {
            pedidoData.pessoa_id = profile.id;
          }
        } else if (pessoaId) {
          pedidoData.pessoa_id = pessoaId;
        } else {
          pedidoData.nome_solicitante = nome;
          pedidoData.email_solicitante = email;
          pedidoData.telefone_solicitante = telefone;
        }
      }

      const { data: insertedPedido, error } = await supabase
        .from("pedidos_oracao")
        .insert([pedidoData])
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Pedido de oração criado com sucesso"
      });

      // Trigger AI analysis in background (non-blocking)
      if (insertedPedido?.id) {
        supabase.functions.invoke('analise-pedido-ia', {
          body: { pedido_id: insertedPedido.id }
        }).catch(err => {
          console.error('AI analysis failed (non-blocking):', err);
        });
      }

      // Reset form
      setPedido("");
      setNome("");
      setEmail("");
      setTelefone("");
      setAnonimo(false);
      setTipo("outro");
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o pedido de oração",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Novo Pedido de Oração</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Pedido</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saude">Saúde</SelectItem>
                <SelectItem value="familia">Família</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="trabalho">Trabalho</SelectItem>
                <SelectItem value="espiritual">Espiritual</SelectItem>
                <SelectItem value="agradecimento">Agradecimento</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="anonimo" 
              checked={anonimo}
              onCheckedChange={(checked) => setAnonimo(checked as boolean)}
            />
            <Label htmlFor="anonimo" className="cursor-pointer">
              Pedido anônimo
            </Label>
          </div>

          {!anonimo && !user && (
            <>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  placeholder="Seu nome"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone (opcional)</Label>
                  <Input
                    id="telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="pedido">Pedido de Oração</Label>
            <Textarea
              id="pedido"
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              required
              placeholder="Descreva seu pedido de oração..."
              className="min-h-[120px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Pedido"}
            </Button>
          </div>
        </form>
        </div>

        </div>
    </ResponsiveDialog>
  );
}
