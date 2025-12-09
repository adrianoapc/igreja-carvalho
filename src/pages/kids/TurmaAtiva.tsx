import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Baby, BookOpen, Users, AlertCircle, CheckCircle, Calendar, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KidsObservationDialog } from "@/components/kids/KidsObservationDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface CriancaPresente {
  id: string;
  nome: string;
  avatar_url: string | null;
  data_nascimento: string | null;
  responsavel_nome?: string;
  tem_diario: boolean;
}

export default function TurmaAtiva() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [selectedCrianca, setSelectedCrianca] = useState<CriancaPresente | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Buscar culto ativo hoje
  const { data: cultoAtivo } = useQuery({
    queryKey: ["culto-ativo-hoje"],
    queryFn: async () => {
      const hoje = new Date();
      const inicioDia = new Date(hoje.setHours(0, 0, 0, 0));
      const fimDia = new Date(hoje.setHours(23, 59, 59, 999));

      const { data, error } = await supabase
        .from("cultos")
        .select("*")
        .gte("data_culto", inicioDia.toISOString())
        .lte("data_culto", fimDia.toISOString())
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Buscar crianças que fizeram check-in hoje
  const { data: criancasPresentes, isLoading, error: queryError } = useQuery({
    queryKey: ["criancas-presentes-hoje"],
    queryFn: async () => {
      const hoje = new Date();
      const dataHoje = format(hoje, "yyyy-MM-dd");

      // Buscar o culto de hoje
      const { data: culto } = await supabase
        .from("cultos")
        .select("id")
        .eq("data_culto", dataHoje)
        .maybeSingle();

      if (!culto) {
        return [];
      }

      // Buscar presenças do culto de hoje (uma presença por criança)
      const { data: presencas, error: presencasError } = await supabase
        .from("presencas_culto")
        .select("pessoa_id")
        .eq("culto_id", culto.id);

      if (presencasError) {
        console.error("Erro ao buscar presenças:", presencasError);
        throw presencasError;
      }

      const pessoaIds = [...new Set(presencas?.map(p => p.pessoa_id) || [])];
      
      if (pessoaIds.length === 0) {
        return [];
      }

      // Buscar dados das crianças
      const { data: criancas, error: criancasError } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, data_nascimento")
        .in("id", pessoaIds);

      if (criancasError) {
        console.error("Erro ao buscar crianças:", criancasError);
        throw criancasError;
      }

      if (!criancas || criancas.length === 0) {
        return [];
      }

      const criancaIds = criancas.map(c => c.id);

      // Buscar responsáveis via familias table (pai/mãe das crianças)
      const { data: familias } = await supabase
        .from("familias")
        .select("pessoa_id, familiar_id, tipo_parentesco")
        .in("familiar_id", criancaIds)
        .in("tipo_parentesco", ["pai", "mae", "responsavel"]);

      // Buscar nomes dos responsáveis
      const responsavelIds = [...new Set(familias?.map(f => f.pessoa_id) || [])];
      const { data: responsaveis } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", responsavelIds);

      const responsaveisMap = new Map(responsaveis?.map(r => [r.id, r.nome]) || []);
      const criancaResponsavelMap = new Map<string, string>();
      familias?.forEach(f => {
        if (f.familiar_id && !criancaResponsavelMap.has(f.familiar_id)) {
          criancaResponsavelMap.set(f.familiar_id, responsaveisMap.get(f.pessoa_id) || "");
        }
      });

      // Buscar diários já registrados para este culto
      const { data: diarios } = await supabase
        .from("kids_diario")
        .select("crianca_id")
        .eq("culto_id", culto.id)
        .in("crianca_id", criancaIds);

      const diariosSet = new Set(diarios?.map(d => d.crianca_id) || []);

      // Mapear crianças com indicador de diário
      return criancas.map((crianca) => ({
        id: crianca.id,
        nome: crianca.nome,
        avatar_url: crianca.avatar_url,
        data_nascimento: crianca.data_nascimento,
        responsavel_nome: criancaResponsavelMap.get(crianca.id),
        tem_diario: diariosSet.has(crianca.id),
      }));
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const calcularIdade = (dataNascimento: string | null) => {
    if (!dataNascimento) return null;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    const idade = hoje.getFullYear() - nascimento.getFullYear();
    const mesAtual = hoje.getMonth();
    const mesNascimento = nascimento.getMonth();
    
    if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
      return idade - 1;
    }
    return idade;
  };

  const handleCriancaClick = (crianca: CriancaPresente) => {
    setSelectedCrianca(crianca);
    setDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/kids/dashboard")}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              Diário de Classe
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Registre observações e avaliações das crianças
            </p>
          </div>
        </div>

        {cultoAtivo && (
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-medium text-primary">{cultoAtivo.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(cultoAtivo.data_culto), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presentes Hoje</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{criancasPresentes?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {criancasPresentes?.length === 1 ? "criança presente" : "crianças presentes"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Diário</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {criancasPresentes?.filter(c => c.tem_diario).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              registros completados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {criancasPresentes?.filter(c => !c.tem_diario).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              aguardando registro
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Crianças */}
      <Card>
        <CardHeader>
          <CardTitle>Crianças Presentes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : queryError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Erro ao carregar crianças presentes. Por favor, tente novamente.
              </AlertDescription>
            </Alert>
          ) : !criancasPresentes || criancasPresentes.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma criança fez check-in hoje ainda.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {criancasPresentes.map((crianca) => (
                <Card
                  key={crianca.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    crianca.tem_diario
                      ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
                      : "border-orange-300 hover:border-primary"
                  }`}
                  onClick={() => handleCriancaClick(crianca)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Avatar className="w-12 h-12 shrink-0">
                        <AvatarImage src={crianca.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10">
                          <Baby className="w-6 h-6 text-primary" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-sm sm:text-base truncate pr-2">{crianca.nome}</h3>
                          {crianca.tem_diario ? (
                            <Badge className="bg-green-500 hover:bg-green-600 shrink-0 self-start">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              <span className="text-xs">Avaliado</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-orange-400 text-orange-600 shrink-0 self-start">
                              <span className="text-xs">Pendente</span>
                            </Badge>
                          )}
                        </div>

                        {crianca.data_nascimento && (
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {calcularIdade(crianca.data_nascimento)} anos
                          </p>
                        )}

                        {crianca.responsavel_nome && (
                          <p className="text-xs text-muted-foreground truncate" title={`Responsável: ${crianca.responsavel_nome}`}>
                            Responsável: {crianca.responsavel_nome}
                          </p>
                        )}

                        <Button
                          variant={crianca.tem_diario ? "outline" : "default"}
                          size="sm"
                          className="w-full mt-2 sm:mt-3 h-8 text-xs sm:text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCriancaClick(crianca);
                          }}
                        >
                          <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          {crianca.tem_diario ? "Ver/Editar" : "Registrar"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Observação */}
      {selectedCrianca && (
        <KidsObservationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          crianca={selectedCrianca}
          cultoId={cultoAtivo?.id}
          professorId={profile?.id}
        />
      )}
    </div>
  );
}
