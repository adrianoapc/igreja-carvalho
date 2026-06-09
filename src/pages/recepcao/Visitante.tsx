import { useState, type InputHTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import InputMask from "react-input-mask";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { toast } from "sonner";

type Step = 1 | 2;

export default function RecepcaoVisitante() {
  const navigate = useNavigate();
  const { igrejaId } = useIgrejaId();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    email: "",
    sexo: "",
    aceitou_jesus: false,
    deseja_contato: true,
  });

  const set = (field: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const goNext = () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do visitante");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!form.telefone.trim() && !form.email.trim()) {
      toast.error("Informe telefone ou email para contato");
      return;
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("cadastro-publico", {
        body: {
          action: "cadastrar_visitante",
          data: {
            nome: form.nome.trim(),
            telefone: form.telefone.trim() || null,
            email: form.email.trim() || null,
            sexo: form.sexo || null,
            aceitou_jesus: form.aceitou_jesus,
            deseja_contato: form.deseja_contato,
            igreja_id: igrejaId,
          },
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setSuccess(true);
    } catch {
      toast.error("Erro ao cadastrar visitante. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center shadow-md">
          <CardContent className="pt-10 pb-10 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Visitante cadastrado!</h2>
            <p className="text-muted-foreground text-sm">{form.nome} foi registrado com sucesso.</p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => {
                setForm({ nome: "", telefone: "", email: "", sexo: "", aceitou_jesus: false, deseja_contato: true });
                setStep(1);
                setSuccess(false);
              }}>
                Novo visitante
              </Button>
              <Button className="flex-1" onClick={() => navigate("/recepcao")}>
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => step === 1 ? navigate("/recepcao") : setStep(1)} className="mb-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {step === 1 ? "Recepção" : "Voltar"}
        </Button>
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Cadastrar Visitante</h1>
        </div>
      </div>

      <div className="p-4 max-w-sm mx-auto space-y-4">
        {/* Progresso */}
        <div className="space-y-1">
          <Progress value={(step - 1) * 100} className="h-1.5" />
          <p className="text-xs text-muted-foreground text-right">Passo {step} de 2</p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="pt-6 pb-6 px-5 space-y-5">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => set("nome", e.target.value)}
                    placeholder="Nome do visitante"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && goNext()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sexo">Sexo</Label>
                  <Select value={form.sexo} onValueChange={(v) => set("sexo", v)}>
                    <SelectTrigger id="sexo"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
                  <InputMask
                    mask="(99) 99999-9999"
                    value={form.telefone}
                    onChange={(e) => set("telefone", e.target.value)}
                  >
                    {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                      <Input {...inputProps} id="telefone" type="tel" placeholder="(00) 00000-0000" autoFocus />
                    )}
                  </InputMask>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-3 pt-1 border-t">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="aceitou_jesus"
                      checked={form.aceitou_jesus}
                      onCheckedChange={(v) => set("aceitou_jesus", v as boolean)}
                    />
                    <label htmlFor="aceitou_jesus" className="text-sm font-medium cursor-pointer">
                      Aceitou Jesus hoje
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="deseja_contato"
                      checked={form.deseja_contato}
                      onCheckedChange={(v) => set("deseja_contato", v as boolean)}
                    />
                    <label htmlFor="deseja_contato" className="text-sm font-medium cursor-pointer">
                      Deseja receber contato
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              {step === 1 ? (
                <Button className="w-full" onClick={goNext}>
                  Próximo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button className="w-full" onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
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
  );
}
