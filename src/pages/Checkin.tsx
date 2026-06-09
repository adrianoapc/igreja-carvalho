import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight,
  UserPlus,
  Loader2,
  AlertCircle,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { removerFormatacao } from "@/lib/validators";

interface EventoInfo {
  id: string;
  titulo: string;
  data: string;
  tipo: string;
  igreja_id?: string;
}

type Step = "telefone" | "otp" | "success" | "not-found";

function mascararNome(nome: string): string {
  const partes = nome.trim().split(" ");
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1].charAt(0)}.`;
}

export default function Checkin() {
  const { tipo, id } = useParams<{ tipo: string; id: string }>();
  const navigate = useNavigate();

  const [evento, setEvento] = useState<EventoInfo | null>(null);
  const [loadingEvento, setLoadingEvento] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState<Step>("telefone");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pessoaNome, setPessoaNome] = useState("");
  const [tentativasRestantes, setTentativasRestantes] = useState<number | null>(null);

  // Reenvio: contador regressivo de 60s
  const [reenvioSegundos, setReenvioSegundos] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadEvento();
  }, [tipo, id]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

const iniciarContadorReenvio = () => {
  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  setReenvioSegundos(60);
  timerRef.current = setInterval(() => {
    setReenvioSegundos((s) => {
      if (s <= 1) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return 0;
      }
      return s - 1;
    });
  }, 1000);
};

  const loadEvento = async () => {
    if (!tipo || !id) return;
    try {
      if (tipo === "culto") {
        const { data, error } = await supabase
          .from("eventos")
          .select("id, titulo, data_evento, tipo, igreja_id")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (data) setEvento({ id: data.id, titulo: data.titulo, data: data.data_evento, tipo: data.tipo, igreja_id: data.igreja_id });
      } else if (tipo === "aula") {
        const { data, error } = await supabase
          .from("aulas")
          .select("id, tema, data_inicio, modalidade")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (data) setEvento({ id: data.id, titulo: data.tema || "Aula", data: data.data_inicio, tipo: data.modalidade || "presencial" });
      }
    } catch {
      toast.error("Evento não encontrado");
    } finally {
      setLoadingEvento(false);
    }
  };

  const handleEnviarOTP = async () => {
    const tel = removerFormatacao(telefone.trim());
    if (tel.length < 10) {
      toast.error("Informe um telefone válido");
      return;
    }
    if (!evento?.igreja_id) {
      toast.error("Configuração do evento inválida");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { telefone: tel, igreja_id: evento.igreja_id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Código enviado via WhatsApp!");
      setCodigo("");
      setTentativasRestantes(null);
      setStep("otp");
      iniciarContadorReenvio();
    } catch (err) {
      toast.error("Não foi possível enviar o código", {
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerificarOTP = async () => {
    const tel = removerFormatacao(telefone.trim());
    if (!codigo.trim() || codigo.trim().length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }

    setSubmitting(true);
    try {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-otp", {
        body: { telefone: tel, codigo: codigo.trim() },
      });

      if (verifyError) throw verifyError;

      if (!verifyData?.success) {
        const msg = verifyData?.error || "Código incorreto";
        if (verifyData?.tentativas_restantes !== undefined) {
          setTentativasRestantes(verifyData.tentativas_restantes);
        }
        toast.error(msg);
        return;
      }

      // OTP válido — fazer check-in
      const profileId = verifyData.profile_id;

      const { data: checkinData, error: checkinError } = await supabase.functions.invoke("checkin-evento", {
        body: {
          tipo,
          evento_id: id,
          contato: telefone.trim(),
          profile_id: profileId ?? undefined,
        },
      });

      if (checkinError) throw checkinError;

      if (checkinData?.success) {
        setPessoaNome(checkinData.nome || "");
        setStep("success");
      } else if (checkinData?.not_found) {
        setStep("not-found");
      } else {
        toast.error(checkinData?.message || "Erro ao registrar presença");
      }
    } catch (err) {
      toast.error("Erro ao verificar código", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCadastro = () => {
    const params = new URLSearchParams();
    params.set("telefone", telefone.trim());
    if (tipo && id) {
      params.set("retorno_tipo", tipo);
      params.set("retorno_id", id);
    }
    navigate(`/cadastro/visitante?${params.toString()}`);
  };

  const resetar = () => {
    setStep("telefone");
    setTelefone("");
    setCodigo("");
    setPessoaNome("");
    setTentativasRestantes(null);
    if (timerRef.current) clearInterval(timerRef.current);
    setReenvioSegundos(0);
  };

  if (loadingEvento) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold">Evento não encontrado</h2>
            <p className="text-muted-foreground">
              Este QR Code pode estar expirado ou o evento não existe mais.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dataEvento = new Date(evento.data);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <Badge variant="outline" className="w-fit mx-auto mb-2">
            {tipo === "culto" ? "Culto" : "Aula"}
          </Badge>
          <CardTitle className="text-2xl">{evento.titulo}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-4 mt-2">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(dataEvento, "dd/MM/yyyy", { locale: ptBR })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {format(dataEvento, "HH:mm")}
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {/* Step 1: telefone */}
          {step === "telefone" && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Confirmar Presença</h3>
                <p className="text-sm text-muted-foreground">
                  Digite seu telefone para receber o código de confirmação via WhatsApp
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
                <Input
                  id="telefone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEnviarOTP()}
                  autoFocus
                  className="text-lg h-12"
                />
              </div>
              <Button
                className="w-full h-12 text-base"
                onClick={handleEnviarOTP}
                disabled={submitting || !telefone.trim()}
              >
                {submitting ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Enviando...</>
                ) : (
                  <><MessageCircle className="h-5 w-5 mr-2" />Receber código no WhatsApp</>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: OTP */}
          {step === "otp" && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Digite o código</h3>
                <p className="text-sm text-muted-foreground">
                  Enviamos um código de 6 dígitos para{" "}
                  <span className="font-medium">{telefone}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo">Código de verificação</Label>
                <Input
                  id="codigo"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerificarOTP()}
                  autoFocus
                  className="text-2xl h-14 tracking-widest text-center"
                />
                {tentativasRestantes !== null && (
                  <p className="text-xs text-destructive text-center">
                    {tentativasRestantes} tentativa{tentativasRestantes !== 1 ? "s" : ""} restante{tentativasRestantes !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <Button
                className="w-full h-12 text-base"
                onClick={handleVerificarOTP}
                disabled={submitting || codigo.length !== 6}
              >
                {submitting ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Verificando...</>
                ) : (
                  <><ArrowRight className="h-5 w-5 mr-2" />Confirmar presença</>
                )}
              </Button>
              <div className="text-center space-y-2">
                {reenvioSegundos > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Reenviar código em {reenvioSegundos}s
                  </p>
                ) : (
                  <Button variant="ghost" size="sm" onClick={handleEnviarOTP} disabled={submitting}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reenviar código
                  </Button>
                )}
                <div>
                  <Button variant="ghost" size="sm" onClick={resetar} className="text-muted-foreground text-xs">
                    Usar outro número
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: sucesso */}
          {step === "success" && (
            <div className="text-center space-y-6">
              <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">
                  Presença Confirmada!
                </h3>
                <p className="text-lg mt-2">
                  Olá, <span className="font-semibold">{mascararNome(pessoaNome)}</span>!
                </p>
                <p className="text-muted-foreground mt-1">
                  Sua presença foi registrada com sucesso.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={resetar}>
                Novo Check-in
              </Button>
            </div>
          )}

          {/* Step 4: não encontrado */}
          {step === "not-found" && (
            <div className="text-center space-y-6">
              <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                <UserPlus className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Cadastro não encontrado</h3>
                <p className="text-muted-foreground mt-2">
                  Não encontramos ninguém com esse número. Deseja se cadastrar como visitante?
                </p>
              </div>
              <div className="space-y-3">
                <Button className="w-full h-12" onClick={handleCadastro}>
                  <UserPlus className="h-5 w-5 mr-2" />
                  Fazer Cadastro
                </Button>
                <Button variant="outline" className="w-full" onClick={resetar}>
                  Usar outro número
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
