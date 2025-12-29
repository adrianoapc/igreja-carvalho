import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Users, Calendar, Clock, MapPin, Crown, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Props {
  pessoaId: string;
}

interface Time {
  id: string;
  nome: string;
  cor: string | null;
  categoria: string;
  posicao: string | null;
  isLider: boolean;
  isSublider: boolean;
}

interface Escala {
  id: string;
  culto_titulo: string;
  culto_data: string;
  culto_local: string | null;
  time_nome: string;
  time_cor: string | null;
  posicao: string | null;
  confirmado: boolean;
}

interface Funcao {
  id: string;
  nome: string;
  data_inicio: string;
  ativo: boolean;
}

export function VidaIgrejaEnvolvimento({ pessoaId }: Props) {
  const [times, setTimes] = useState<Time[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [funcoesOpen, setFuncoesOpen] = useState(true);
  const [timesOpen, setTimesOpen] = useState(true);
  const [escalasOpen, setEscalasOpen] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [pessoaId]);

  const loadData = async () => {
    try {
      // Buscar times do membro
      const { data: membrosTimeData } = await supabase
        .from("membros_time")
        .select(`
          id,
          posicao_id,
          times!inner (
            id,
            nome,
            cor,
            categoria,
            lider_id,
            sublider_id
          ),
          posicoes_time (
            nome
          )
        `)
        .eq("pessoa_id", pessoaId)
        .eq("ativo", true);

      const timesFormatted: Time[] = (membrosTimeData || []).map((mt: {
        times: {
          id: string;
          nome: string;
          cor: string;
          categoria: string;
          lider_id: string | null;
          sublider_id: string | null;
        };
        posicoes_time?: { nome: string } | null;
      }) => ({
        id: mt.times.id,
        nome: mt.times.nome,
        cor: mt.times.cor,
        categoria: mt.times.categoria,
        posicao: mt.posicoes_time?.nome || null,
        isLider: mt.times.lider_id === pessoaId,
        isSublider: mt.times.sublider_id === pessoaId,
      }));

      setTimes(timesFormatted);

      // Buscar escalas futuras
      const { data: escalasData } = await supabase
        .from("escalas")
        .select(`
          id,
          confirmado,
          evento_id,
          eventos!inner (
            id,
            titulo,
            data_evento,
            local
          ),
          times!inner (
            nome,
            cor
          ),
          posicoes_time (
            nome
          )
        `)
        .eq("pessoa_id", pessoaId)
        .gte("eventos.data_evento", new Date().toISOString())
        .order("eventos(data_evento)", { ascending: true })
        .limit(10);

      const escalasFormatted: Escala[] = (escalasData || []).map((e: {
        id: string;
        confirmado: boolean;
        eventos: { titulo: string; data_evento: string; local: string | null };
        times: { nome: string; cor: string | null };
        posicoes_time?: { nome: string } | null;
      }) => ({
        id: e.id,
        culto_titulo: e.eventos.titulo,
        culto_data: e.eventos.data_evento,
        culto_local: e.eventos.local,
        time_nome: e.times.nome,
        time_cor: e.times.cor,
        posicao: e.posicoes_time?.nome || null,
        confirmado: e.confirmado,
      }));

      setEscalas(escalasFormatted);

      // Buscar funções do membro
      const { data: funcoesData } = await supabase
        .from("membro_funcoes")
        .select(`
          id,
          data_inicio,
          ativo,
          funcoes_igreja!inner (
            nome
          )
        `)
        .eq("membro_id", pessoaId)
        .order("data_inicio", { ascending: false });

      const funcoesFormatted: Funcao[] = (funcoesData || []).map((f: {
        id: string;
        data_inicio: string;
        ativo: boolean;
        funcoes_igreja: { nome: string };
      }) => ({
        id: f.id,
        nome: f.funcoes_igreja.nome,
        data_inicio: f.data_inicio,
        ativo: f.ativo,
      }));

      setFuncoes(funcoesFormatted);
    } catch (error) {
      console.error("Erro ao carregar envolvimento:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Funções */}
      <Collapsible open={funcoesOpen} onOpenChange={setFuncoesOpen}>
        <Card className="shadow-soft">
          <CardHeader className="p-4 md:p-5 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base md:text-lg truncate">Funções na Igreja</CardTitle>
                  <p className="text-xs text-muted-foreground">{funcoes.length} ativa{funcoes.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex-shrink-0">
                  {funcoesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-4 md:p-5">
              {funcoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma função atribuída
                </p>
              ) : (
                <div className="space-y-3">
                  {funcoes.map((funcao) => (
                    <div
                      key={funcao.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{funcao.nome}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Desde: {format(new Date(funcao.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant={funcao.ativo ? "default" : "secondary"} className="text-xs whitespace-nowrap">
                        {funcao.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Times */}
      <Collapsible open={timesOpen} onOpenChange={setTimesOpen}>
        <Card className="shadow-soft">
          <CardHeader className="p-4 md:p-5 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base md:text-lg truncate">Times</CardTitle>
                  <p className="text-xs text-muted-foreground">{times.length} time{times.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex-shrink-0">
                  {timesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-4 md:p-5">
              {times.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Não participa de nenhum time
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {times.map((time) => (
                    <div
                      key={time.id}
                      className="flex items-center gap-3 p-3 sm:p-4 rounded-lg bg-muted/50 border transition-colors hover:bg-muted"
                      style={{ borderLeftColor: time.cor || undefined, borderLeftWidth: time.cor ? 4 : undefined }}
                    >
                      <Avatar className="w-10 h-10 flex-shrink-0" style={{ backgroundColor: time.cor || undefined }}>
                        <AvatarFallback className="text-white text-sm font-semibold">
                          {time.nome.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{time.nome}</p>
                          {time.isLider && (
                            <Badge className="text-xs bg-amber-500 hover:bg-amber-600 flex-shrink-0">
                              <Crown className="w-3 h-3 mr-1" />
                              Líder
                            </Badge>
                          )}
                          {time.isSublider && (
                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                              Sub-líder
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {time.categoria}
                          </Badge>
                          {time.posicao && (
                            <span className="text-xs text-muted-foreground">{time.posicao}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Escalas Futuras */}
      <Collapsible open={escalasOpen} onOpenChange={setEscalasOpen}>
        <Card className="shadow-soft">
          <CardHeader className="p-4 md:p-5 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base md:text-lg truncate">Escalas Futuras</CardTitle>
                  <p className="text-xs text-muted-foreground">{escalas.length} escalada{escalas.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex-shrink-0">
                  {escalasOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-4 md:p-5">
              {escalas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma escala futura agendada
                </p>
              ) : (
                <div className="space-y-3">
                  {escalas.map((escala) => (
                    <div
                      key={escala.id}
                      className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 sm:p-4 rounded-lg bg-muted/50 border hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className="w-1.5 h-12 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: escala.time_cor || "#8B5CF6" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{escala.culto_titulo}</p>
                          <div className="flex flex-col gap-2 mt-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              {format(new Date(escala.culto_data), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </div>
                            {escala.culto_local && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                {escala.culto_local}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap sm:flex-col sm:gap-1">
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {escala.time_nome}
                        </Badge>
                        {escala.posicao && (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            {escala.posicao}
                          </Badge>
                        )}
                        <Badge
                          variant={escala.confirmado ? "default" : "outline"}
                          className={`text-xs whitespace-nowrap ${escala.confirmado ? "bg-green-600" : ""}`}
                        >
                          {escala.confirmado ? "✓ Confirmado" : "○ Pendente"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
