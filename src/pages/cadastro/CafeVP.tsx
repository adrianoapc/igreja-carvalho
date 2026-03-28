import { useMemo, useState, type InputHTMLAttributes } from "react";
import { useSearchParams } from "react-router-dom";
import InputMask from "react-input-mask";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Coffee,
  HeartHandshake,
  Loader2,
  MapPinHouse,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Step = 1 | 2 | 3 | 4;

export default function CadastroCafeVP() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const igrejaIdParam = searchParams.get("igreja_id");
  const filialIdParam = searchParams.get("filial_id");
  const todasFiliaisParam = searchParams.get("todas_filiais") === "true";

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    sexo: "",
    estado_civil: "",
    dia_nascimento: "",
    mes_nascimento: "",
    ano_nascimento: "",
    cidade: "",
    bairro: "",
    profissao: "",
    necessidades_especiais: "",
    observacoes: "",
    aceitou_jesus: false,
    deseja_contato: true,
    deseja_trilha: true,
  });

  const dias = useMemo(
    () => Array.from({ length: 31 }, (_, index) => (index + 1).toString().padStart(2, "0")),
    []
  );

  const meses = useMemo(
    () => [
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
    ],
    []
  );

  const anos = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    return Array.from({ length: 90 }, (_, index) => String(anoAtual - index));
  }, []);

  const buildCadastroBackLink = () => {
    const params = new URLSearchParams();
    if (igrejaIdParam) params.set("igreja_id", igrejaIdParam);
    if (filialIdParam) params.set("filial_id", filialIdParam);
    if (todasFiliaisParam) params.set("todas_filiais", "true");
    const query = params.toString();
    return query ? `/cadastro?${query}` : "/cadastro";
  };

  const cadastroBackLink = buildCadastroBackLink();

  const stepProgress = (step / 4) * 100;

  const validateStep = () => {
    if (step === 1 && !formData.nome.trim()) {
      toast({
        title: "Falta seu nome 💛",
        description: "Me conta seu nome para eu te chamar direitinho.",
        variant: "destructive",
      });
      return false;
    }

    if (step === 2 && !formData.telefone.trim() && !formData.email.trim()) {
      toast({
        title: "Como a gente te encontra?",
        description: "Pode ser telefone ou email — qualquer um já resolve 😉",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((previous) => Math.min(previous + 1, 4) as Step);
  };

  const goBack = () => {
    setStep((previous) => Math.max(previous - 1, 1) as Step);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!igrejaIdParam) {
      toast({
        title: "Link inválido",
        description: "Esse link está incompleto. Pede pra equipe te enviar novamente.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.nome.trim()) {
      toast({
        title: "Falta seu nome 💛",
        description: "Me conta seu nome para concluir.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.telefone.trim() && !formData.email.trim()) {
      toast({
        title: "Contato necessário",
        description: "Antes de finalizar, coloca telefone ou email pra gente te acompanhar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let dataNascimento: string | null = null;
      if (formData.dia_nascimento && formData.mes_nascimento) {
        dataNascimento = `${formData.ano_nascimento || "1900"}-${formData.mes_nascimento}-${formData.dia_nascimento}`;
      }

      const { data: result, error } = await supabase.functions.invoke("cadastro-publico", {
        body: {
          action: "cadastrar_cafe_vp",
          data: {
            nome: formData.nome.trim(),
            telefone: formData.telefone.trim() || null,
            email: formData.email.trim() || null,
            sexo: formData.sexo || null,
            estado_civil: formData.estado_civil || null,
            data_nascimento: dataNascimento,
            cidade: formData.cidade.trim() || null,
            bairro: formData.bairro.trim() || null,
            profissao: formData.profissao.trim() || null,
            necessidades_especiais: formData.necessidades_especiais.trim() || null,
            observacoes: formData.observacoes.trim() || null,
            aceitou_jesus: formData.aceitou_jesus,
            deseja_contato: formData.deseja_contato,
            deseja_trilha: formData.deseja_trilha,
            igreja_id: igrejaIdParam,
            filial_id: filialIdParam,
            todas_filiais: todasFiliaisParam,
          },
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      toast({
        title: result?.isUpdate
          ? "Achamos seu cadastro e atualizamos ✨"
          : "Cadastro enviado com sucesso 🎉",
        description: result?.message || "Perfeito! O time do Café V&P vai continuar seu acompanhamento.",
      });

      setSuccess(true);
    } catch (submitError) {
      console.error("Erro ao registrar Café V&P:", submitError);
      toast({
        title: "Erro ao enviar",
        description: "Deu um probleminha aqui. Tenta de novo em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const stepTitle = {
    1: "Que bom ter você aqui! 💛",
    2: "Vamos trocar contato?",
    3: "Me conta um pouco de você",
    4: "Só mais um passinho ✨",
  }[step];

  const stepDescription = {
    1: "O Café V&P é um espaço de recepção, cuidado e conexão.",
    2: "Com telefone ou email a gente consegue seguir com você.",
    3: "É rapidinho e ajuda muito no seu próximo passo.",
    4: "Confere os dados e finaliza com um toque.",
  }[step];

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-b from-emerald-500/10 via-background to-background">
          <Card className="w-full max-w-md shadow-soft text-center border-emerald-500/20">
            <CardContent className="pt-8 pb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Tudo certo por aqui! 🎉</h2>
              <p className="text-muted-foreground mb-6">
                Obrigado por preencher seu cadastro do <strong>Café V&P</strong>.
                Em breve nosso time continua seu acolhimento e próximos passos.
              </p>
              <Button onClick={() => (window.location.href = cadastroBackLink)} className="w-full">
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
      <div className="flex-1 flex items-center justify-center p-3 py-6 sm:p-4 sm:py-8 bg-gradient-to-b from-orange-500/10 via-pink-500/5 to-background">
        <Card className="w-full max-w-md shadow-soft border-primary/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 text-xs font-medium">
                <Coffee className="w-3.5 h-3.5" />
                Café V&P
              </div>
              <span className="text-xs text-muted-foreground font-medium">Etapa {step}/4</span>
            </div>

            <Progress value={stepProgress} className="h-2 mb-4" />

            <div className="rounded-lg border border-primary/10 bg-primary/5 p-2 mb-3">
              <p className="text-xs text-muted-foreground text-center">
                Leva cerca de <strong>2 minutinhos</strong> ☕
              </p>
            </div>

            <CardTitle className="text-xl leading-tight">{stepTitle}</CardTitle>
            <CardDescription className="text-sm">{stepDescription}</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 && (
                <div className="space-y-4">
                  <div className="rounded-lg p-4 bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-amber-500/10 border border-primary/10">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-orange-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        É rapidinho: seu cadastro ajuda a gente a te receber com carinho e sem burocracia.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(event) => setFormData({ ...formData, nome: event.target.value })}
                      placeholder="Como você gosta de ser chamado(a)?"
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
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="rounded-lg p-3 bg-blue-500/10 border border-blue-500/20 flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-blue-600" />
                    <p className="text-xs text-blue-900 dark:text-blue-300">
                      Se você já tem cadastro, a gente encontra e atualiza sem duplicar ✨
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <InputMask
                      mask="(99) 99999-9999"
                      value={formData.telefone}
                      onChange={(event) => setFormData({ ...formData, telefone: event.target.value })}
                      disabled={loading}
                    >
                      {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
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
                      onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                      placeholder="voce@email.com"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Data de nascimento</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                            <SelectItem key={dia} value={dia}>
                              {dia}
                            </SelectItem>
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
                            <SelectItem key={mes.value} value={mes.value}>
                              {mes.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={formData.ano_nascimento}
                        onValueChange={(value) => setFormData({ ...formData, ano_nascimento: value })}
                        disabled={loading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent>
                          {anos.map((ano) => (
                            <SelectItem key={ano} value={ano}>
                              {ano}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="estado_civil">Estado civil</Label>
                      <Select
                        value={formData.estado_civil}
                        onValueChange={(value) => setFormData({ ...formData, estado_civil: value })}
                        disabled={loading}
                      >
                        <SelectTrigger id="estado_civil">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="casado">Casado(a)</SelectItem>
                          <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                          <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profissao">Profissão</Label>
                      <Input
                        id="profissao"
                        value={formData.profissao}
                        onChange={(event) => setFormData({ ...formData, profissao: event.target.value })}
                        placeholder="Sua profissão"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        value={formData.cidade}
                        onChange={(event) => setFormData({ ...formData, cidade: event.target.value })}
                        placeholder="Cidade"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bairro">Bairro</Label>
                      <Input
                        id="bairro"
                        value={formData.bairro}
                        onChange={(event) => setFormData({ ...formData, bairro: event.target.value })}
                        placeholder="Bairro"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="necessidades_especiais">Necessidades especiais</Label>
                    <Input
                      id="necessidades_especiais"
                      value={formData.necessidades_especiais}
                      onChange={(event) =>
                        setFormData({ ...formData, necessidades_especiais: event.target.value })
                      }
                      placeholder="Ex.: mobilidade, audição, visão..."
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <UserRound className="w-4 h-4 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Resumo rápido</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>{formData.nome || "Nome não informado"}</strong>
                      {formData.telefone ? ` · ${formData.telefone}` : ""}
                      {formData.email ? ` · ${formData.email}` : ""}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações (opcional)</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })}
                      placeholder="Algo que você quer compartilhar com a equipe?"
                      disabled={loading}
                      className="min-h-[90px]"
                    />
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="aceitou_jesus"
                        checked={formData.aceitou_jesus}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, aceitou_jesus: checked as boolean })
                        }
                        disabled={loading}
                      />
                      <label htmlFor="aceitou_jesus" className="text-sm leading-none">
                        Tomei uma decisão por Jesus recentemente
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="deseja_trilha"
                        checked={formData.deseja_trilha}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, deseja_trilha: checked as boolean })
                        }
                        disabled={loading}
                      />
                      <label htmlFor="deseja_trilha" className="text-sm leading-none">
                        Quero seguir para a trilha de novos membros
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="deseja_contato"
                        checked={formData.deseja_contato}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, deseja_contato: checked as boolean })
                        }
                        disabled={loading}
                      />
                      <label htmlFor="deseja_contato" className="text-sm leading-none">
                        Autorizo contato da equipe da igreja 💬
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                    <MapPinHouse className="w-4 h-4 text-amber-700 mt-0.5" />
                    <p className="text-xs text-amber-900 dark:text-amber-200">
                      Seus dados são usados apenas para acolhimento e acompanhamento pastoral.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  disabled={step === 1 || loading}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>

                {step < 4 ? (
                  <Button type="button" onClick={goNext} disabled={loading} className="w-full">
                    Próxima
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando com carinho...
                      </>
                    ) : (
                      <>
                        <Coffee className="w-4 h-4 mr-2" />
                        Finalizar cadastro
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
