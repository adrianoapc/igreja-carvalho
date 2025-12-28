import { useState, useEffect } from "react";
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
  Search,
  UserPlus,
  Loader2,
  AlertCircle
} from "lucide-react";

interface EventoInfo {
  id: string;
  titulo: string;
  data: string;
  tipo: string;
}

export default function Checkin() {
  const { tipo, id } = useParams<{ tipo: string; id: string }>();
  const navigate = useNavigate();
  
  const [evento, setEvento] = useState<EventoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [contato, setContato] = useState("");
  const [step, setStep] = useState<"input" | "success" | "not-found">("input");
  const [pessoaNome, setPessoaNome] = useState("");

  useEffect(() => {
    loadEvento();
  }, [tipo, id]);

  const loadEvento = async () => {
    if (!tipo || !id) return;
    
    try {
      if (tipo === "culto") {
        const { data, error } = await supabase
          .from("eventos")
          .select("id, titulo, data_evento, tipo")
          .eq("id", id)
          .maybeSingle();
        
        if (error) throw error;
        if (data) {
          setEvento({
            id: data.id,
            titulo: data.titulo,
            data: data.data_evento,
            tipo: data.tipo,
          });
        }
      } else if (tipo === "aula") {
        const { data, error } = await supabase
          .from("aulas")
          .select("id, tema, data_inicio, modalidade")
          .eq("id", id)
          .maybeSingle();
        
        if (error) throw error;
        if (data) {
          setEvento({
            id: data.id,
            titulo: data.tema || "Aula",
            data: data.data_inicio,
            tipo: data.modalidade || "presencial",
          });
        }
      }
    } catch (error: unknown) {
      console.error("Erro ao carregar evento:", error);
      toast.error("Evento não encontrado");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!contato.trim()) {
      toast.error("Digite seu email ou telefone");
      return;
    }

    setSearching(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("checkin-evento", {
        body: {
          tipo,
          evento_id: id,
          contato: contato.trim(),
        },
      });

      if (error) throw error;

      if (data.success) {
        setPessoaNome(data.nome);
        setStep("success");
        toast.success("Presença registrada!");
      } else if (data.not_found) {
        setStep("not-found");
      } else {
        toast.error(data.message || "Erro ao registrar presença");
      }
    } catch (error: unknown) {
      console.error("Erro no check-in:", error);
      toast.error("Erro ao processar check-in", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setSearching(false);
    }
  };

  const handleCadastro = () => {
    // Redireciona para cadastro de visitante passando o contato como parâmetro
    const params = new URLSearchParams();
    if (contato.includes("@")) {
      params.set("email", contato);
    } else {
      params.set("telefone", contato);
    }
    if (tipo && id) {
      params.set("retorno_tipo", tipo);
      params.set("retorno_id", id);
    }
    navigate(`/cadastro/Visitante?${params.toString()}`);
  };

  const handleNovoCheckin = () => {
    setStep("input");
    setContato("");
    setPessoaNome("");
  };

  if (loading) {
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
          {step === "input" && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Confirmar Presença</h3>
                <p className="text-sm text-muted-foreground">
                  Digite seu email ou telefone cadastrado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contato">Email ou Telefone</Label>
                <Input
                  id="contato"
                  type="text"
                  placeholder="seu@email.com ou (11) 99999-9999"
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  autoFocus
                  className="text-lg h-12"
                />
              </div>

              <Button 
                className="w-full h-12 text-lg" 
                onClick={handleSearch}
                disabled={searching || !contato.trim()}
              >
                {searching ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Confirmar Presença
                  </>
                )}
              </Button>
            </div>
          )}

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
                  Olá, <span className="font-semibold">{pessoaNome}</span>!
                </p>
                <p className="text-muted-foreground mt-1">
                  Sua presença foi registrada com sucesso.
                </p>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleNovoCheckin}
              >
                Novo Check-in
              </Button>
            </div>
          )}

          {step === "not-found" && (
            <div className="text-center space-y-6">
              <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                <UserPlus className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              
              <div>
                <h3 className="text-xl font-bold">
                  Cadastro não encontrado
                </h3>
                <p className="text-muted-foreground mt-2">
                  Não encontramos seu cadastro com "{contato}". 
                  Gostaria de se cadastrar como visitante?
                </p>
              </div>

              <div className="space-y-3">
                <Button 
                  className="w-full h-12"
                  onClick={handleCadastro}
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Fazer Cadastro
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleNovoCheckin}
                >
                  Tentar outro contato
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
