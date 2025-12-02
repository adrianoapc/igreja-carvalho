import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle } from "lucide-react";
import InputMask from "react-input-mask";
import { useSearchParams } from "react-router-dom";

export default function CadastroVisitante() {
  const [searchParams] = useSearchParams();
  const aceitouJesus = searchParams.get("aceitou") === "true";
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    sexo: "",
    dia_nascimento: "",
    mes_nascimento: "",
    entrou_por: "",
    observacoes: "",
    aceitou_jesus: aceitouJesus,
    deseja_contato: true,
  });

  const opcoesComoConheceu = [
    { value: "indicacao", label: "Indicação de amigo/familiar" },
    { value: "redes_sociais", label: "Redes sociais" },
    { value: "google", label: "Pesquisa no Google" },
    { value: "passou_na_frente", label: "Passou na frente da igreja" },
    { value: "evento", label: "Evento da igreja" },
    { value: "convite_membro", label: "Convite de membro" },
    { value: "outro", label: "Outro" },
  ];
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
      // Construir data_nascimento parcial (ano fictício para armazenar só dia/mês)
      let dataNascimento = null;
      if (formData.dia_nascimento && formData.mes_nascimento) {
        dataNascimento = `1900-${formData.mes_nascimento}-${formData.dia_nascimento}`;
      }

      // Usar edge function para cadastro público (sem autenticação)
      const { data: result, error } = await supabase.functions.invoke('cadastro-publico', {
        body: {
          action: 'cadastrar_visitante',
          data: {
            nome: formData.nome.trim(),
            telefone: formData.telefone.trim() || null,
            email: formData.email.trim() || null,
            sexo: formData.sexo || null,
            data_nascimento: dataNascimento,
            entrou_por: formData.entrou_por || null,
            observacoes: formData.observacoes.trim() || null,
            aceitou_jesus: formData.aceitou_jesus,
            deseja_contato: formData.deseja_contato,
          }
        }
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      toast({
        title: result?.isUpdate ? "Cadastro atualizado!" : "Cadastro realizado!",
        description: result?.isUpdate 
          ? `Obrigado ${result.data?.nome}! Seu cadastro foi atualizado.`
          : "Obrigado por se cadastrar! Será um prazer ter você conosco.",
      });

      setSuccess(true);
    } catch (error) {
      console.error("Erro ao registrar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível realizar o cadastro. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader showBackButton backTo="/cadastro" />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-soft text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Cadastro realizado!
              </h2>
              <p className="text-muted-foreground mb-6">
                Obrigado por se cadastrar! Será um prazer ter você conosco em nossos cultos.
              </p>
              <Button onClick={() => window.location.href = "/public"}>
                Voltar para o início
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader showBackButton backTo="/cadastro" />
      
      <div className="flex-1 flex items-center justify-center p-4 py-8">
        <Card className="w-full max-w-md shadow-soft">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-foreground">
              Cadastro de Visitante
            </CardTitle>
            <CardDescription>
              Preencha seus dados para nos conhecermos melhor
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Seu nome completo"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone *</Label>
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
                  placeholder="seu@email.com"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sexo">Sexo</Label>
                <Select
                  value={formData.sexo}
                  onValueChange={(value) => setFormData({ ...formData, sexo: value })}
                  disabled={loading}
                >
                  <SelectTrigger id="sexo">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
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
                  placeholder="Algo que gostaria de compartilhar..."
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
                    Aceitei Jesus hoje
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
                    Desejo receber contato da igreja
                  </label>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-4">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  "Cadastrar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
