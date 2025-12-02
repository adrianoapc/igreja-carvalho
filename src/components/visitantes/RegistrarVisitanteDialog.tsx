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
    dia_nascimento: "",
    mes_nascimento: "",
    entrou_por: "",
    observacoes: "",
    aceitou_jesus: false,
    batizado: false,
    deseja_contato: true,
    recebeu_brinde: false,
  });
  const { toast } = useToast();

  const dias = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, "0"));
  const meses = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];
  const opcoesComoConheceu = [
    { value: "indicacao", label: "Indicação de amigo/familiar" },
    { value: "redes_sociais", label: "Redes sociais" },
    { value: "google", label: "Pesquisa no Google" },
    { value: "passou_na_frente", label: "Passou na frente da igreja" },
    { value: "evento", label: "Evento da igreja" },
    { value: "convite_membro", label: "Convite de membro" },
    { value: "outro", label: "Outro" },
  ];

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
        // Verificar se a pessoa já é frequentador
        if (visitanteExistente.status === "frequentador" && formData.tipo === "visitante") {
          toast({
            title: "Aviso",
            description: `${visitanteExistente.nome} já é frequentador. Use o tipo correto ao registrar.`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const novoNumeroVisitas = (visitanteExistente.numero_visitas || 0) + 1;
        
        // Promover automaticamente para frequentador após 2 visitas
        let novoStatus = formData.tipo;
        let mensagemPromocao = "";
        
        if (visitanteExistente.status === "visitante" && novoNumeroVisitas > 2) {
          novoStatus = "frequentador";
          mensagemPromocao = " Foi promovido a Frequentador!";
        }

        // Atualizar registro existente
        const { data: updatedData, error: updateError } = await supabase
          .from("profiles")
          .update({
            numero_visitas: novoNumeroVisitas,
            data_ultima_visita: new Date().toISOString(),
            status: novoStatus,
            observacoes: formData.observacoes.trim() || visitanteExistente.observacoes,
            aceitou_jesus: formData.aceitou_jesus || visitanteExistente.aceitou_jesus,
            batizado: formData.batizado || visitanteExistente.batizado,
            deseja_contato: formData.deseja_contato,
            recebeu_brinde: formData.recebeu_brinde || visitanteExistente.recebeu_brinde,
          })
          .eq("id", visitanteExistente.id)
          .select()
          .single();

        if (updateError) throw updateError;
        visitanteData = updatedData;

        // Se houve promoção, notificar admins
        if (mensagemPromocao) {
          await supabase.rpc('notify_admins', {
            p_title: 'Promoção para Frequentador',
            p_message: `${visitanteData.nome} foi promovido automaticamente a Frequentador após ${novoNumeroVisitas} visitas`,
            p_type: 'promocao_status',
            p_related_user_id: visitanteData.user_id,
            p_metadata: {
              nome: visitanteData.nome,
              status_anterior: 'visitante',
              status_novo: 'frequentador',
              numero_visitas: novoNumeroVisitas
            }
          });
        }

        toast({
          title: mensagemPromocao ? "🎉 Promoção Automática!" : "Registro Atualizado",
          description: `${visitanteData.nome} já tem ${visitanteData.numero_visitas} visita(s) registrada(s)!${mensagemPromocao}`,
        });
      } else {
        // Construir data_nascimento parcial (ano fictício para armazenar só dia/mês)
        let dataNascimento = null;
        if (formData.dia_nascimento && formData.mes_nascimento) {
          dataNascimento = `1900-${formData.mes_nascimento}-${formData.dia_nascimento}`;
        }

        // Inserir novo registro
        const { data: newData, error: insertError } = await supabase
          .from("profiles")
          .insert({
            nome: formData.nome.trim(),
            telefone: telefoneNormalizado,
            email: formData.email.trim() || null,
            observacoes: formData.observacoes.trim() || null,
            aceitou_jesus: formData.aceitou_jesus,
            batizado: formData.batizado,
            deseja_contato: formData.deseja_contato,
            recebeu_brinde: formData.recebeu_brinde,
            data_nascimento: dataNascimento,
            entrou_por: formData.entrou_por || null,
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

      // Se deseja contato E é visitante (não foi promovido), criar agendamento automático para 3 dias depois
      if (formData.deseja_contato && visitanteData && visitanteData.status === "visitante") {
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
        dia_nascimento: "",
        mes_nascimento: "",
        entrou_por: "",
        observacoes: "",
        aceitou_jesus: false,
        batizado: false,
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
            <Label>Data de aniversário</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={formData.dia_nascimento}
                onValueChange={(value) => setFormData({ ...formData, dia_nascimento: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent>
                  {dias.map((dia) => (
                    <SelectItem key={dia} value={dia}>{dia}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={formData.mes_nascimento}
                onValueChange={(value) => setFormData({ ...formData, mes_nascimento: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((mes) => (
                    <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entrou_por">Como conheceu a igreja?</Label>
            <Select
              value={formData.entrou_por}
              onValueChange={(value) => setFormData({ ...formData, entrou_por: value })}
              disabled={loading}
            >
              <SelectTrigger id="entrou_por">
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {opcoesComoConheceu.map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>{opcao.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                id="batizado"
                checked={formData.batizado}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, batizado: checked as boolean })
                }
                disabled={loading}
              />
              <label
                htmlFor="batizado"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Convertido/Batizado
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
