import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import InputMask from "react-input-mask";
import { removerFormatacao } from "@/lib/validators";

interface RegistrarVisitanteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RegistrarVisitanteDialog({ open, onOpenChange, onSuccess }: RegistrarVisitanteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    tipo: "visitante" as "visitante" | "frequentador",
    observacoes: "",
    aceitou_jesus: false,
    deseja_contato: true,
    recebeu_brinde: false,
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (!formData.telefone.trim() && !formData.email.trim()) {
      toast({
        title: "Erro",
        description: "Informe pelo menos um contato (telefone ou email)",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Pegar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Verificar se já existe uma pessoa com o mesmo email ou telefone
      let query = supabase
        .from("profiles")
        .select("*")
        .in("status", ["visitante", "frequentador"]);

      const telefoneNormalizado = formData.telefone.trim() ? removerFormatacao(formData.telefone.trim()) : null;
      
      const conditions = [];
      if (formData.email.trim()) {
        conditions.push(supabase
          .from("profiles")
          .select("*")
          .in("status", ["visitante", "frequentador"])
          .eq("email", formData.email.trim()));
      }
      if (telefoneNormalizado) {
        conditions.push(supabase
          .from("profiles")
          .select("*")
          .in("status", ["visitante", "frequentador"])
          .eq("telefone", telefoneNormalizado));
      }

      // Verificar duplicatas
      let visitanteExistente = null;
      for (const condition of conditions) {
        const { data } = await condition;
        if (data && data.length > 0) {
          visitanteExistente = data[0];
          break;
        }
      }

      let visitanteData;

      if (visitanteExistente) {
        // Atualizar registro existente
        const { data: updatedData, error: updateError } = await supabase
          .from("profiles")
          .update({
            numero_visitas: (visitanteExistente.numero_visitas || 0) + 1,
            data_ultima_visita: new Date().toISOString(),
            status: formData.tipo,
            observacoes: formData.observacoes.trim() || visitanteExistente.observacoes,
            aceitou_jesus: formData.aceitou_jesus || visitanteExistente.aceitou_jesus,
            deseja_contato: formData.deseja_contato,
            recebeu_brinde: formData.recebeu_brinde || visitanteExistente.recebeu_brinde,
          })
          .eq("id", visitanteExistente.id)
          .select()
          .single();

        if (updateError) throw updateError;
        visitanteData = updatedData;

        toast({
          title: "Registro Atualizado",
          description: `${visitanteData.nome} já tem ${visitanteData.numero_visitas} visita(s) registrada(s)!`,
        });
      } else {
        // Inserir novo registro
        const { data: newData, error: insertError } = await supabase
          .from("profiles")
          .insert({
            nome: formData.nome.trim(),
            telefone: telefoneNormalizado,
            email: formData.email.trim() || null,
            observacoes: formData.observacoes.trim() || null,
            aceitou_jesus: formData.aceitou_jesus,
            deseja_contato: formData.deseja_contato,
            recebeu_brinde: formData.recebeu_brinde,
            status: formData.tipo,
            data_primeira_visita: new Date().toISOString(),
            data_ultima_visita: new Date().toISOString(),
            numero_visitas: 1,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        visitanteData = newData;

        toast({
          title: "Sucesso",
          description: `${formData.tipo === "visitante" ? "Visitante" : "Frequentador"} registrado com sucesso`
        });
      }

      // Se deseja contato E é visitante, criar agendamento automático para 3 dias depois
      if (formData.deseja_contato && visitanteData && formData.tipo === "visitante") {
        const dataContato = new Date();
        dataContato.setDate(dataContato.getDate() + 3);

        const { error: contatoError } = await supabase
          .from("visitante_contatos")
          .insert({
            visitante_id: visitanteData.id,
            membro_responsavel_id: user.id,
            data_contato: dataContato.toISOString(),
            tipo_contato: "telefonico",
            status: "agendado",
            observacoes: visitanteExistente 
              ? "Contato automático - visita recorrente" 
              : "Contato automático agendado após registro"
          });

        if (contatoError) {
          console.error("Erro ao criar agendamento:", contatoError);
          // Não bloqueamos o cadastro se falhar o agendamento
        }
      }

      setFormData({
        nome: "",
        telefone: "",
        email: "",
        tipo: "visitante",
        observacoes: "",
        aceitou_jesus: false,
        deseja_contato: true,
        recebeu_brinde: false,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao registrar visitante:", error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar o visitante",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Pessoa</DialogTitle>
          <DialogDescription>
            Preencha os dados da pessoa
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={formData.tipo}
              onValueChange={(value: "visitante" | "frequentador") => 
                setFormData({ ...formData, tipo: value })
              }
              disabled={loading}
            >
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visitante">Visitante</SelectItem>
                <SelectItem value="frequentador">Frequentador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome completo"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <InputMask
              mask="(99) 99999-9999"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              disabled={loading}
            >
              {(inputProps: any) => (
                <Input
                  {...inputProps}
                  id="telefone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                />
              )}
            </InputMask>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações sobre a pessoa..."
              disabled={loading}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aceitou_jesus"
                checked={formData.aceitou_jesus}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, aceitou_jesus: checked as boolean })
                }
                disabled={loading}
              />
              <label
                htmlFor="aceitou_jesus"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Aceitou Jesus
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="deseja_contato"
                checked={formData.deseja_contato}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, deseja_contato: checked as boolean })
                }
                disabled={loading}
              />
              <label
                htmlFor="deseja_contato"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Deseja receber contato
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recebeu_brinde"
                checked={formData.recebeu_brinde}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, recebeu_brinde: checked as boolean })
                }
                disabled={loading}
              />
              <label
                htmlFor="recebeu_brinde"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Recebeu brinde
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
