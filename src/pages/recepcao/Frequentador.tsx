import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  Loader2,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Perfil {
  id: string;
  nome: string;
  avatar_url: string | null;
  status: string;
}

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
}

export default function RecepcaoFrequentador() {
  const navigate = useNavigate();
  const { igrejaId } = useIgrejaId();

  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [confirmados, setConfirmados] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Evento do dia (culto mais próximo)
  const { data: evento, isLoading: loadingEvento } = useQuery<Evento | null>({
    queryKey: ["culto-hoje-recepcao", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return null;
      const hoje = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("eventos")
        .select("id, titulo, data_evento")
        .eq("igreja_id", igrejaId)
        .gte("data_evento", `${hoje}T00:00:00`)
        .lte("data_evento", `${hoje}T23:59:59`)
        .order("data_evento", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as Evento;

      // Fallback: evento mais recente
      const { data: recente, error: errRecente } = await supabase
        .from("eventos")
        .select("id, titulo, data_evento")
        .eq("igreja_id", igrejaId)
        .lt("data_evento", `${hoje}T00:00:00`)
        .order("data_evento", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (errRecente) throw errRecente;
      return recente as Evento | null;
    },
    enabled: !!igrejaId,
  });

  // Busca de frequentadores/membros por nome ou telefone
  const { data: resultados, isLoading: loadingBusca } = useQuery<Perfil[]>({
    queryKey: ["busca-frequentador", buscaAtiva, igrejaId],
    queryFn: async () => {
      if (!buscaAtiva.trim() || !igrejaId) return [];
      const termo = buscaAtiva.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, status")
        .eq("igreja_id", igrejaId)
        .in("status", ["frequentador", "membro"])
        .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%`)
        .order("nome")
        .limit(20);
      if (error) throw error;
      return (data || []) as Perfil[];
    },
    enabled: !!buscaAtiva && !!igrejaId,
  });

  const handleBuscar = () => {
    if (busca.trim().length < 2) {
      toast.error("Digite ao menos 2 caracteres para buscar");
      return;
    }
    setBuscaAtiva(busca.trim());
  };

  const handleConfirmarPresenca = async (perfil: Perfil) => {
    if (!evento?.id) {
      toast.error("Nenhum evento ativo encontrado para hoje");
      return;
    }
    if (confirmados.has(perfil.id)) return;

    setLoadingId(perfil.id);
    try {
      const { error } = await supabase.from("checkins").insert({
        evento_id: evento.id,
        pessoa_id: perfil.id,
        igreja_id: igrejaId,
        metodo: "recepcao",
      });

      if (error) {
        // Ignora duplicata (presença já registrada)
        if (error.code === "23505") {
          setConfirmados((prev) => new Set(prev).add(perfil.id));
          toast.info(`${perfil.nome} já tinha presença registrada`);
          return;
        }
        throw error;
      }

      setConfirmados((prev) => new Set(prev).add(perfil.id));
      toast.success(`Presença de ${perfil.nome} confirmada!`);
    } catch {
      toast.error("Erro ao registrar presença. Tente novamente.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/recepcao")} className="mb-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Recepção
        </Button>
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Frequentador</h1>
        </div>
        {evento && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Evento: <span className="font-medium">{evento.titulo}</span>
          </p>
        )}
      </div>

      <div className="p-4 max-w-sm mx-auto space-y-4">
        {/* Alerta se não há evento */}
        {!loadingEvento && !evento && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Nenhum culto encontrado para hoje. A presença será vinculada ao evento mais recente.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Campo de busca */}
        <div className="space-y-2">
          <Label htmlFor="busca">Buscar por nome ou telefone</Label>
          <div className="flex gap-2">
            <Input
              id="busca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex: João Silva ou 11 9..."
              onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
              autoFocus
            />
            <Button onClick={handleBuscar} disabled={loadingBusca} size="icon">
              {loadingBusca ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Resultados */}
        {buscaAtiva && (
          <div className="space-y-2">
            {loadingBusca ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
            ) : resultados && resultados.length > 0 ? (
              resultados.map((perfil) => {
                const jaConfirmado = confirmados.has(perfil.id);
                const carregando = loadingId === perfil.id;

                return (
                  <Card key={perfil.id} className={jaConfirmado ? "border-green-300 bg-green-50 dark:bg-green-950/20" : ""}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={perfil.avatar_url || undefined} />
                        <AvatarFallback className="text-sm font-medium">
                          {perfil.nome?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{perfil.nome}</p>
                        <Badge variant="outline" className="text-xs capitalize">
                          {perfil.status}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant={jaConfirmado ? "secondary" : "default"}
                        disabled={jaConfirmado || carregando}
                        onClick={() => handleConfirmarPresenca(perfil)}
                        className="shrink-0"
                      >
                        {carregando ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : jaConfirmado ? (
                          <><CheckCircle2 className="w-4 h-4 mr-1 text-green-600" />Confirmado</>
                        ) : (
                          "Confirmar"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum frequentador ou membro encontrado.</p>
                  <p className="text-xs text-muted-foreground mt-1">É um visitante? Use "Cadastrar Visitante".</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
