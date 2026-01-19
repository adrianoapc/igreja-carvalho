import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Calendar, 
  User,
  Loader2,
  AlertCircle,
  XCircle,
  Clock
} from "lucide-react";

interface InscricaoData {
  pessoa: {
    id: string;
    nome: string;
    email?: string;
    telefone?: string;
  } | null;
  evento: {
    id: string;
    titulo: string;
    data_evento: string;
    status: string;
  } | null;
}

export default function CheckinInscricao() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<"validating" | "ready" | "success" | "error" | "already_used" | "pending_payment">("validating");
  const [inscricaoData, setInscricaoData] = useState<InscricaoData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Token inválido");
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para realizar o check-in");
        navigate("/login", { state: { redirectTo: `/eventos/checkin/${token}` } });
        return;
      }

      // Buscar inscrição pelo token
      const { data: inscricao, error } = await supabase
        .from("inscricoes_eventos")
        .select(`
          id,
          status_pagamento,
          checkin_validado_em,
          pessoa:profiles!inscricoes_eventos_pessoa_id_fkey (id, nome, email, telefone),
          evento:eventos!inscricoes_eventos_evento_id_fkey (id, titulo, data_evento, status, requer_pagamento)
        `)
        .eq("qr_token", token)
        .maybeSingle();

      if (error || !inscricao) {
        setStatus("error");
        setErrorMessage("Inscrição não encontrada");
        setLoading(false);
        return;
      }

      const evento = Array.isArray(inscricao.evento) ? inscricao.evento[0] : inscricao.evento;
      const pessoa = Array.isArray(inscricao.pessoa) ? inscricao.pessoa[0] : inscricao.pessoa;

      setInscricaoData({ pessoa, evento });

      if (inscricao.checkin_validado_em) {
        setStatus("already_used");
      } else if (evento?.requer_pagamento && !["pago", "isento"].includes(inscricao.status_pagamento?.toLowerCase() || "")) {
        setStatus("pending_payment");
      } else if (evento?.status === "cancelado") {
        setStatus("error");
        setErrorMessage("Evento cancelado");
      } else {
        setStatus("ready");
      }
    } catch (error) {
      console.error("Erro ao validar token:", error);
      setStatus("error");
      setErrorMessage("Erro ao validar inscrição");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!token) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("checkin-inscricao", {
        body: { qr_token: token }
      });

      if (error) throw error;

      if (data.success) {
        setStatus("success");
        toast.success("Check-in realizado com sucesso!");
      } else {
        if (data.code === "ALREADY_USED") {
          setStatus("already_used");
        } else if (data.code === "PENDENTE") {
          setStatus("pending_payment");
        } else {
          setStatus("error");
          setErrorMessage(data.message || "Erro ao realizar check-in");
        }
      }
    } catch (error) {
      console.error("Erro ao realizar check-in:", error);
      setStatus("error");
      setErrorMessage("Erro ao realizar check-in");
      toast.error("Erro ao realizar check-in");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        {status === "ready" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Confirmar Check-in</CardTitle>
              <CardDescription>
                Verifique os dados antes de confirmar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {inscricaoData?.pessoa && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="font-semibold text-lg">{inscricaoData.pessoa.nome}</p>
                  {inscricaoData.pessoa.email && (
                    <p className="text-sm text-muted-foreground">{inscricaoData.pessoa.email}</p>
                  )}
                </div>
              )}
              
              {inscricaoData?.evento && (
                <div className="p-4 border rounded-lg space-y-2">
                  <p className="font-medium">{inscricaoData.evento.titulo}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(inscricaoData.evento.data_evento), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              )}

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleCheckin}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirmar Check-in
                  </>
                )}
              </Button>
            </CardContent>
          </>
        )}

        {status === "success" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-xl text-green-600">Check-in Realizado!</CardTitle>
              <CardDescription>
                Presença confirmada com sucesso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {inscricaoData?.pessoa && (
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="font-semibold text-lg">{inscricaoData.pessoa.nome}</p>
                  <Badge variant="outline" className="mt-2 bg-green-100 text-green-700 border-green-200">
                    Presença Confirmada
                  </Badge>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate("/")}
              >
                Voltar ao Início
              </Button>
            </CardContent>
          </>
        )}

        {status === "already_used" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
              <CardTitle className="text-xl text-amber-600">Já Utilizado</CardTitle>
              <CardDescription>
                Este check-in já foi realizado anteriormente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {inscricaoData?.pessoa && (
                <div className="p-4 bg-amber-50 rounded-lg text-center">
                  <p className="font-semibold">{inscricaoData.pessoa.nome}</p>
                  <Badge variant="outline" className="mt-2 bg-amber-100 text-amber-700 border-amber-200">
                    Check-in já realizado
                  </Badge>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate("/")}
              >
                Voltar ao Início
              </Button>
            </CardContent>
          </>
        )}

        {status === "pending_payment" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-orange-600" />
              </div>
              <CardTitle className="text-xl text-orange-600">Pagamento Pendente</CardTitle>
              <CardDescription>
                O pagamento desta inscrição ainda não foi confirmado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {inscricaoData?.pessoa && (
                <div className="p-4 bg-orange-50 rounded-lg text-center">
                  <p className="font-semibold">{inscricaoData.pessoa.nome}</p>
                  <Badge variant="outline" className="mt-2 bg-orange-100 text-orange-700 border-orange-200">
                    Aguardando Pagamento
                  </Badge>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate("/")}
              >
                Voltar ao Início
              </Button>
            </CardContent>
          </>
        )}

        {status === "error" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-600">Erro</CardTitle>
              <CardDescription>
                {errorMessage || "Não foi possível processar o check-in"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate("/")}
              >
                Voltar ao Início
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
