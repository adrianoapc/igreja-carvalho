import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { removerFormatacao } from "@/lib/validators";
import { useAuthContext } from "@/contexts/AuthContextProvider";

import { StepTipo, type TipoPessoa } from "./wizard-steps/StepTipo";
import { StepDadosBasicos, type DadosBasicos } from "./wizard-steps/StepDadosBasicos";
import { StepComplementar, type DadosComplementares } from "./wizard-steps/StepComplementar";
import { StepCheckboxes, type DadosCheckboxes } from "./wizard-steps/StepCheckboxes";
import { StepDadosMembro, type DadosMembro } from "./wizard-steps/StepDadosMembro";

const STEPS_BASE = ["Tipo", "Dados básicos", "Complementar", "Finalizar"];
const STEPS_MEMBRO = ["Tipo", "Dados básicos", "Dados de membro", "Complementar", "Finalizar"];

function getSteps(tipo: TipoPessoa | "") {
  return tipo === "membro" ? STEPS_MEMBRO : STEPS_BASE;
}

const emptyDadosBasicos: DadosBasicos = { nome: "", telefone: "", email: "", sexo: "" };
const emptyComplementar: DadosComplementares = {
  dia_nascimento: "", mes_nascimento: "", ano_nascimento: "", entrou_por: "", observacoes: "",
};
const emptyCheckboxes: DadosCheckboxes = {
  aceitou_jesus: false, batizado: false, deseja_contato: true, recebeu_brinde: false,
};
const emptyMembro: DadosMembro = {
  cpf: "", rg: "", estado_civil: "", profissao: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
};

export function PessoaWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { igrejaId, filialId } = useAuthContext();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [tipo, setTipo] = useState<TipoPessoa | "">("");
  const [dadosBasicos, setDadosBasicos] = useState<DadosBasicos>(emptyDadosBasicos);
  const [complementar, setComplementar] = useState<DadosComplementares>(emptyComplementar);
  const [checkboxes, setCheckboxes] = useState<DadosCheckboxes>(emptyCheckboxes);
  const [dadosMembro, setDadosMembro] = useState<DadosMembro>(emptyMembro);

  const steps = getSteps(tipo);
  const totalSteps = steps.length;
  const progress = (step / (totalSteps - 1)) * 100;

  const handleSelectTipo = (t: TipoPessoa) => {
    setTipo(t);
    setStep(1);
  };

  const validateCurrentStep = (): boolean => {
    if (step === 1) {
      if (!dadosBasicos.nome.trim()) {
        toast({ title: "Nome obrigatório", description: "Informe o nome completo.", variant: "destructive" });
        return false;
      }
      if (!dadosBasicos.telefone.trim() && !dadosBasicos.email.trim()) {
        toast({ title: "Contato necessário", description: "Informe telefone ou email.", variant: "destructive" });
        return false;
      }
      if (dadosBasicos.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dadosBasicos.email.trim())) {
        toast({ title: "Email inválido", description: "Informe um endereço de email válido.", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const goBack = () => {
    if (step === 0) return;
    if (step === 1) {
      setTipo("");
      setStep(0);
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    if (!tipo) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const telefoneNormalizado = dadosBasicos.telefone.trim()
        ? removerFormatacao(dadosBasicos.telefone.trim())
        : null;

      // Verificar duplicatas
      const checks = [];
      if (dadosBasicos.email.trim()) {
        checks.push(supabase.from("profiles").select("id, nome, status").eq("email", dadosBasicos.email.trim()));
      }
      if (telefoneNormalizado) {
        checks.push(supabase.from("profiles").select("id, nome, status").eq("telefone", telefoneNormalizado));
      }
for (const check of checks) {
  const { data, error } = await check;
  if (error) throw error;
  if (data && data.length > 0) {
          const existente = data[0];
          toast({
            title: "Pessoa já cadastrada",
            description: `${existente.nome} já existe como ${existente.status}.`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      let dataNascimento: string | null = null;
      if (complementar.dia_nascimento && complementar.mes_nascimento) {
        const ano = complementar.ano_nascimento || "1900";
        dataNascimento = `${ano}-${complementar.mes_nascimento}-${complementar.dia_nascimento}`;
      }

      const dados: Record<string, unknown> = {
        nome: dadosBasicos.nome.trim(),
        telefone: telefoneNormalizado,
        email: dadosBasicos.email.trim() || null,
        sexo: dadosBasicos.sexo || null,
        status: tipo,
        observacoes: complementar.observacoes.trim() || null,
        entrou_por: complementar.entrou_por || null,
        data_nascimento: dataNascimento,
        aceitou_jesus: checkboxes.aceitou_jesus,
        batizado: checkboxes.batizado,
        deseja_contato: checkboxes.deseja_contato,
        recebeu_brinde: checkboxes.recebeu_brinde,
        data_primeira_visita: new Date().toISOString(),
        data_ultima_visita: new Date().toISOString(),
        numero_visitas: 1,
        igreja_id: igrejaId,
        filial_id: filialId,
      };

      if (tipo === "membro") {
        dados.cpf = dadosMembro.cpf ? removerFormatacao(dadosMembro.cpf) : null;
        dados.rg = dadosMembro.rg || null;
        dados.estado_civil = dadosMembro.estado_civil || null;
        dados.profissao = dadosMembro.profissao || null;
        dados.cep = dadosMembro.cep ? removerFormatacao(dadosMembro.cep) : null;
        dados.logradouro = dadosMembro.logradouro || null;
        dados.numero = dadosMembro.numero || null;
        dados.complemento = dadosMembro.complemento || null;
        dados.bairro = dadosMembro.bairro || null;
        dados.cidade = dadosMembro.cidade || null;
        dados.estado = dadosMembro.estado || null;
      }

      const { data: newData, error } = await supabase
        .from("profiles")
        .insert([dados as never])
        .select()
        .single();

      if (error) throw error;

if (checkboxes.deseja_contato && tipo === "visitante" && newData) {
  const dataContato = new Date();
  dataContato.setDate(dataContato.getDate() + 3);

  const { error: contatoError } = await supabase.from("visitante_contatos").insert({
    visitante_id: newData.id,
    membro_responsavel_id: user.id,
    data_contato: dataContato.toISOString(),
    tipo_contato: "telefonico",
    status: "agendado",
    observacoes: "Contato automático agendado após registro",
    igreja_id: igrejaId,
    filial_id: filialId,
  });

  if (contatoError) throw contatoError;
}

      const tipoLabel = tipo === "visitante" ? "Visitante" : tipo === "frequentador" ? "Frequentador" : "Membro";
      toast({ title: "Cadastro realizado!", description: `${tipoLabel} ${dadosBasicos.nome} cadastrado com sucesso.` });
      navigate("/pessoas");
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível cadastrar. Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    if (step === 0) return <StepTipo onSelect={handleSelectTipo} />;
    if (tipo === "membro") {
      if (step === 1) return <StepDadosBasicos data={dadosBasicos} onChange={setDadosBasicos} disabled={loading} />;
      if (step === 2) return <StepDadosMembro data={dadosMembro} onChange={setDadosMembro} disabled={loading} />;
      if (step === 3) return <StepComplementar data={complementar} onChange={setComplementar} disabled={loading} />;
      if (step === 4) return <StepCheckboxes data={checkboxes} onChange={setCheckboxes} tipo={tipo} disabled={loading} />;
    } else {
      if (step === 1) return <StepDadosBasicos data={dadosBasicos} onChange={setDadosBasicos} disabled={loading} />;
      if (step === 2) return <StepComplementar data={complementar} onChange={setComplementar} disabled={loading} />;
      if (step === 3) return <StepCheckboxes data={checkboxes} onChange={setCheckboxes} tipo={tipo as TipoPessoa} disabled={loading} />;
    }
  };

  const isLastStep = step === totalSteps - 1;
  const showNav = step > 0;

  return (
    <div className="max-w-lg mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pessoas")} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Cadastrar Pessoa</h1>
          {tipo && (
            <p className="text-sm text-muted-foreground capitalize">
              {steps[step]} · {tipo}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/pessoas")} className="text-muted-foreground">
          Cancelar
        </Button>
      </div>

      {/* Progress */}
      {step > 0 && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground text-right">
            Passo {step} de {totalSteps - 1}
          </p>
        </div>
      )}

      {/* Step content */}
      <div className="min-h-[300px]">
        {step === 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            Que tipo de pessoa você quer cadastrar?
          </p>
        )}
        {renderStep()}
      </div>

      {/* Navigation */}
      {showNav && (
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={goBack} disabled={loading} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          {isLastStep ? (
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Cadastrar
                </>
              )}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={loading} className="flex-1">
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
