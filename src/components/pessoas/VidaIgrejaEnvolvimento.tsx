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
import { Users, Calendar, Clock, MapPin, Crown, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
          times_culto!inner (
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

      const timesFormatted: Time[] = (membrosTimeData || []).map((mt: any) => ({
        id: mt.times_culto.id,
        nome: mt.times_culto.nome,
        cor: mt.times_culto.cor,
        categoria: mt.times_culto.categoria,
        posicao: mt.posicoes_time?.nome || null,
        isLider: mt.times_culto.lider_id === pessoaId,
        isSublider: mt.times_culto.sublider_id === pessoaId,
      }));

      setTimes(timesFormatted);

      // Buscar escalas futuras
      const { data: escalasData } = await supabase
        .from("escalas_culto")
        .select(`
          id,
          confirmado,
          cultos!inner (
            id,
            titulo,
            data_culto,
            local
          ),
          times_culto!inner (
            nome,
            cor
          ),
          posicoes_time (
            nome
          )
        `)
        .eq("pessoa_id", pessoaId)
        .gte("cultos.data_culto", new Date().toISOString())
        .order("cultos(data_culto)", { ascending: true })
        .limit(10);

      const escalasFormatted: Escala[] = (escalasData || []).map((e: any) => ({
        id: e.id,
        culto_titulo: e.cultos.titulo,
        culto_data: e.cultos.data_culto,
        culto_local: e.cultos.local,
        time_nome: e.times_culto.nome,
        time_cor: e.times_culto.cor,
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

      const funcoesFormatted: Funcao[] = (funcoesData || []).map((f: any) => ({
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-base md:text-lg">Funções na Igreja ({funcoes.length})</CardTitle>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
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
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-sm">{funcao.nome}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Desde: {format(new Date(funcao.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant={funcao.ativo ? "default" : "secondary"} className="text-xs">
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-base md:text-lg">Times ({times.length})</CardTitle>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
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
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
                  style={{ borderLeftColor: time.cor || undefined, borderLeftWidth: time.cor ? 4 : undefined }}
                >
                  <Avatar className="w-10 h-10" style={{ backgroundColor: time.cor || undefined }}>
                    <AvatarFallback className="text-white text-sm">
                      {time.nome.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{time.nome}</p>
                      {time.isLider && (
                        <Badge className="text-xs bg-amber-500 hover:bg-amber-600">
                          <Crown className="w-3 h-3 mr-1" />
                          Líder
                        </Badge>
                      )}
                      {time.isSublider && (
                        <Badge variant="secondary" className="text-xs">
                          Sub-líder
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-base md:text-lg">Escalas Futuras ({escalas.length})</CardTitle>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
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
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-2 h-12 rounded-full flex-shrink-0"
                      style={{ backgroundColor: escala.time_cor || "#8B5CF6" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{escala.culto_titulo}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(escala.culto_data), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </div>
                        {escala.culto_local && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            {escala.culto_local}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-5 sm:pl-0">
                    <Badge variant="outline" className="text-xs">
                      {escala.time_nome}
                    </Badge>
                    {escala.posicao && (
                      <Badge variant="secondary" className="text-xs">
                        {escala.posicao}
                      </Badge>
                    )}
                    <Badge
                      variant={escala.confirmado ? "default" : "outline"}
                      className={`text-xs ${escala.confirmado ? "bg-green-600" : ""}`}
                    >
                      {escala.confirmado ? "Confirmado" : "Pendente"}
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
