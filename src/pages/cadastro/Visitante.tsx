import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Heart,
  Loader2,
  Sparkles,
} from "lucide-react";
import { MaskedInput } from "@/components/ui/masked-input";
import { useSearchParams } from "react-router-dom";
import logoCarvalho from "@/assets/logo-carvalho.png";

type Step = 1 | 2 | 3;

export default function CadastroVisitante() {
  const [searchParams] = useSearchParams();
  const aceitouJesus = searchParams.get("aceitou") === "true";
  const igrejaIdParam = searchParams.get("igreja_id");
  const filialIdParam = searchParams.get("filial_id");
  const todasFiliaisParam = searchParams.get("todas_filiais") === "true";
  // pré-preenche se veio do check-in
  const telefoneParam = searchParams.get("telefone") ?? "";

  const backLink = useMemo(() => {
    const params = new URLSearchParams();
    if (igrejaIdParam) params.set("igreja_id", igrejaIdParam);
    if (filialIdParam) params.set("filial_id", filialIdParam);
    if (todasFiliaisParam) params.set("todas_filiais", "true");
    if (aceitouJesus) params.set("aceitou", "true");
    const q = params.toString();
    return q ? `/cadastro?${q}` : "/cadastro";
  }, [igrejaIdParam, filialIdParam, todasFiliaisParam, aceitouJesus]);

  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    telefone: telefoneParam,
    email: "",
    sexo: "",
    dia_nascimento: "",
    mes_nascimento: "",
    entrou_por: "",
    necessidades_especiais: "",
    observacoes: "",
    aceitou_jesus: aceitouJesus,
    deseja_contato: true,
  });

  const dias = useMemo(
    () =>
      Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, "0")),
    [],
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
    [],
  );
  const opcoesComoConheceu = [
    { value: "indicacao", label: "Indicação de amigo/familiar" },
    { value: "redes_sociais", label: "Redes sociais" },
    { value: "google", label: "Pesquisa no Google" },
    { value: "passou_na_frente", label: "Passou na frente da igreja" },
    { value: "evento", label: "Evento da igreja" },
    { value: "convite_membro", label: "Convite de membro" },
    { value: "outro", label: "Outro" },
  ];

  const set = (field: keyof typeof formData, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const validateStep = (): boolean => {
    if (step === 1 && !formData.nome.trim()) {
      toast({ title: "Informe seu nome", variant: "destructive" });
      return false;
    }
    if (step === 2 && !formData.telefone.trim() && !formData.email.trim()) {
      toast({
        title: "Informe telefone ou email",
        description: "Precisamos de ao menos um contato.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, 3) as Step);
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1) as Step);

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    try {
      let dataNascimento = null;
      if (formData.dia_nascimento && formData.mes_nascimento) {
        dataNascimento = `1900-${formData.mes_nascimento}-${formData.dia_nascimento}`;
      }

      const { data: result, error } = await supabase.functions.invoke(
        "cadastro-publico",
        {
          body: {
            action: "cadastrar_visitante",
            data: {
              nome: formData.nome.trim(),
              telefone: formData.telefone.trim() || null,
              email: formData.email.trim() || null,
              sexo: formData.sexo || null,
              data_nascimento: dataNascimento,
              entrou_por: formData.entrou_por || null,
              necessidades_especiais:
                formData.necessidades_especiais.trim() || null,
              observacoes: formData.observacoes.trim() || null,
              aceitou_jesus: formData.aceitou_jesus,
              deseja_contato: formData.deseja_contato,
              igreja_id: igrejaIdParam,
              filial_id: filialIdParam,
              todas_filiais: todasFiliaisParam,
            },
          },
        },
      );

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      setSuccess(true);
    } catch {
      toast({
        title: "Erro ao cadastrar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const progress = ((step - 1) / 2) * 100;

  const stepTitles: Record<Step, string> = {
    1: aceitouJesus ? "Que decisão incrível! 💛" : "Seja bem-vindo!",
    2: "Como a gente te encontra?",
    3: "Quase lá ✨",
  };
  const stepDescriptions: Record<Step, string> = {
    1: aceitouJesus
      ? "Sua vida nunca mais será a mesma! Me conta um pouco de você."
      : "É uma alegria receber você! Me conta seu nome.",
    2: "Com telefone ou email a gente consegue seguir com você.",
    3: "Só mais algumas informações para te conhecermos melhor.",
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-md px-4 py-3 flex items-center gap-3">
          <img
            src={logoCarvalho}
            alt="Igreja Carvalho"
            className="h-8 w-auto"
          />
          <span className="font-semibold text-foreground">Igreja Carvalho</span>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center shadow-soft">
            <CardContent className="pt-10 pb-10 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">Cadastro realizado!</h2>
              <p className="text-muted-foreground">
                Obrigado por se cadastrar! Será um prazer ter você conosco.
              </p>
              <Button
                onClick={() =>
                  (window.location.href =
                    window.location.pathname + window.location.search)
                }
                className="mt-2"
              >
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
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <img src={logoCarvalho} alt="Igreja Carvalho" className="h-8 w-auto" />
        <span className="font-semibold text-foreground">Igreja Carvalho</span>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {/* Progresso */}
          <div className="space-y-1 px-1">
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground text-right">
              Passo {step} de 3
            </p>
          </div>

          <Card className="shadow-soft">
            <CardContent className="pt-8 pb-8 px-6 space-y-6">
              {aceitouJesus && step === 1 && (
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                  <p className="text-sm font-medium text-primary">
                    Que alegria saber que você aceitou Jesus! 🎉
                  </p>
                </div>
              )}

              {/* Ícone + título */}
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-3">
                  {aceitouJesus && step === 1 ? (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                      <Heart className="w-7 h-7 text-white" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-bold">{stepTitles[step]}</h2>
                <p className="text-sm text-muted-foreground">
                  {stepDescriptions[step]}
                </p>
              </div>

              {/* Step 1: nome + sexo */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => set("nome", e.target.value)}
                      placeholder="Seu nome completo"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && goNext()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sexo">Sexo</Label>
                    <Select
                      value={formData.sexo}
                      onValueChange={(v) => set("sexo", v)}
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
                        onValueChange={(v) => set("dia_nascimento", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {dias.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={formData.mes_nascimento}
                        onValueChange={(v) => set("mes_nascimento", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                          {meses.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: contato */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
                    <MaskedInput
                      mask="(99) 99999-9999"
                      value={formData.telefone}
                      onChange={(e) => set("telefone", e.target.value)}
                      id="telefone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="seu@email.com"
                      onKeyDown={(e) => e.key === "Enter" && goNext()}
                    />
                  </div>
                </div>
              )}

              {/* Step 3: complementar + checkboxes */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="entrou_por">Como conheceu a igreja?</Label>
                    <Select
                      value={formData.entrou_por}
                      onValueChange={(v) => set("entrou_por", v)}
                    >
                      <SelectTrigger id="entrou_por">
                        <SelectValue placeholder="Selecione uma opção" />
                      </SelectTrigger>
                      <SelectContent>
                        {opcoesComoConheceu.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="necessidades_especiais">
                      Possui alguma necessidade especial?
                    </Label>
                    <Input
                      id="necessidades_especiais"
                      value={formData.necessidades_especiais}
                      onChange={(e) =>
                        set("necessidades_especiais", e.target.value)
                      }
                      placeholder="Ex: cadeirante, deficiência auditiva..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => set("observacoes", e.target.value)}
                      placeholder="Algo que gostaria de compartilhar..."
                      className="min-h-[70px]"
                    />
                  </div>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="aceitou_jesus"
                        checked={formData.aceitou_jesus}
                        disabled={aceitouJesus}
                        onCheckedChange={(v) =>
                          set("aceitou_jesus", v as boolean)
                        }
                      />
                      <label
                        htmlFor="aceitou_jesus"
                        className={`text-sm font-medium leading-none ${aceitouJesus ? "" : "cursor-pointer"}`}
                      >
                        Aceitei Jesus hoje
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="deseja_contato"
                        checked={formData.deseja_contato}
                        onCheckedChange={(v) =>
                          set("deseja_contato", v as boolean)
                        }
                      />
                      <label
                        htmlFor="deseja_contato"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        Desejo receber contato da igreja
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Navegação */}
              <div className="flex gap-3 pt-2">
                {step > 1 && (
                  <Button
                    variant="outline"
                    onClick={goBack}
                    disabled={loading}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                )}
                {step < 3 ? (
                  <Button onClick={goNext} className="flex-1">
                    Próximo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      "Concluir cadastro"
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
