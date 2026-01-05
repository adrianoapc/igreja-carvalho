import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  MessageCircle
} from "lucide-react";
import { useFilialId } from "@/hooks/useFilialId";

interface Time {
  id: string;
  nome: string;
  categoria: string;
  cor: string | null;
}

interface MembroTime {
  id: string;
  pessoa_id: string;
  posicao_id: string | null;
  profiles: { nome: string };
  posicoes_time: { nome: string } | null;
}

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
  tipo: "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO";
}

interface Escala {
  id: string;
  evento_id: string;
  time_id: string;
  pessoa_id: string;
  posicao_id: string | null;
  confirmado: boolean;
}

export default function Escalas() {
  const [times, setTimes] = useState<Time[]>([]);
  const [timeSelecionado, setTimeSelecionado] = useState<string>("");
  const [membros, setMembros] = useState<MembroTime[]>([]);
  const [cultos, setCultos] = useState<Evento[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const { igrejaId, filialId, isAllFiliais, loading: filialLoading } = useFilialId();

  const mesAtual = format(currentDate, "MMMM yyyy", { locale: ptBR });
  const inicioMes = startOfMonth(currentDate);
  const fimMes = endOfMonth(currentDate);

  useEffect(() => {
    if (!filialLoading && igrejaId) {
      loadTimes();
    }
  }, [filialLoading, igrejaId]);

  useEffect(() => {
    if (timeSelecionado) {
      loadMembros();
    }
  }, [timeSelecionado, igrejaId, filialId, isAllFiliais, filialLoading]);

  useEffect(() => {
    loadCultos();
  }, [currentDate, igrejaId, filialId, isAllFiliais, filialLoading]);

  useEffect(() => {
    if (timeSelecionado && cultos.length > 0) {
      loadEscalas();
    }
  }, [timeSelecionado, cultos, igrejaId, filialId, isAllFiliais, filialLoading]);

  const loadTimes = async () => {
    try {
      if (!igrejaId) return;
      let query = supabase
        .from("times")
        .select("*")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("categoria")
        .order("nome");
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      const { data, error } = await query;

      if (error) throw error;
      setTimes(data || []);
      if (data && data.length > 0) {
        setTimeSelecionado(data[0].id);
      }
    } catch (error: unknown) {
      toast.error("Erro ao carregar times", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const loadMembros = async () => {
    if (!timeSelecionado) return;
    try {
      let query = supabase
        .from("membros_time")
        .select(`*, profiles:pessoa_id(nome), posicoes_time:posicao_id(nome)`)
        .eq("time_id", timeSelecionado)
        .eq("ativo", true);
      if (igrejaId) query = query.eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      const { data, error } = await query;

      if (error) throw error;
      setMembros(data || []);
    } catch (error: unknown) {
      toast.error("Erro ao carregar membros", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const loadCultos = async () => {
    setLoading(true);
    try {
      if (!igrejaId) return;
      let query = supabase
        .from("eventos")
        .select("id, titulo, data_evento, tipo")
        .gte("data_evento", inicioMes.toISOString())
        .lte("data_evento", fimMes.toISOString())
        .eq("igreja_id", igrejaId)
        .order("data_evento", { ascending: true });
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      const { data, error } = await query;

      if (error) throw error;
      setCultos((data || []) as Evento[]);
    } catch (error: unknown) {
      toast.error("Erro ao carregar cultos", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  const loadEscalas = async () => {
    if (!timeSelecionado || cultos.length === 0) return;
    try {
      const cultoIds = cultos.map(c => c.id);
      if (!igrejaId) return;
      let query = supabase
        .from("escalas")
        .select("*")
        .eq("time_id", timeSelecionado)
        .in("evento_id", cultoIds)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      const { data, error } = await query;

      if (error) throw error;
      setEscalas(data || []);
    } catch (error: unknown) {
      toast.error("Erro ao carregar escalas", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const isEscalado = (pessoaId: string, cultoId: string) => {
    return escalas.some(e => e.pessoa_id === pessoaId && e.evento_id === cultoId);
  };

  const isConfirmado = (pessoaId: string, cultoId: string) => {
    return escalas.find(e => e.pessoa_id === pessoaId && e.evento_id === cultoId)?.confirmado || false;
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  const timeAtual = times.find(t => t.id === timeSelecionado);

  const handleToggleEscala = async (pessoaId: string, cultoId: string, posicaoId: string | null) => {
    const existente = escalas.find(e => e.pessoa_id === pessoaId && e.evento_id === cultoId);

    if (existente) {
      const { error } = await supabase
        .from("escalas")
        .delete()
        .eq("id", existente.id);

      if (error) {
        toast.error("Erro ao remover escala");
        return;
      }
    } else {
      const { error } = await supabase
        .from("escalas")
        .insert({
          evento_id: cultoId,
          time_id: timeSelecionado,
          pessoa_id: pessoaId,
          posicao_id: posicaoId,
          confirmado: false,
        });

      if (error) {
        toast.error("Erro ao adicionar escala");
        return;
      }
    }

    loadEscalas();
  };

  const handleNotificarPendentes = async () => {
    const pendentesList = escalas.filter(e => !e.confirmado);
    if (pendentesList.length === 0) {
      toast.info("Todos os voluntários já confirmaram!");
      return;
    }
    toast.success(`Enviando ${pendentesList.length} mensagens via WhatsApp...`, {
      description: "Os voluntários pendentes serão notificados em breve."
    });
  };

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Escalas Mensais
          </h1>
          <p className="text-sm text-muted-foreground">Monte as escalas do mês inteiro</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleNotificarPendentes}
          className="gap-2 w-full md:w-auto justify-center md:justify-start"
        >
          <MessageCircle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">Notificar Pendentes</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 overflow-x-auto flex-wrap">
          <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")} className="flex-shrink-0 h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md whitespace-nowrap">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-sm capitalize">{mesAtual}</span>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateMonth("next")} className="flex-shrink-0 h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={timeSelecionado} onValueChange={setTimeSelecionado}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[200px]">
            <SelectValue placeholder="Selecione o time" />
          </SelectTrigger>
          <SelectContent>
            {times.map((time) => (
              <SelectItem key={time.id} value={time.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: time.cor || "hsl(var(--primary))" }} 
                  />
                  {time.nome}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Matrix Grid */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </CardContent>
        </Card>
      ) : cultos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">Nenhum culto encontrado neste mês.</p>
          </CardContent>
        </Card>
      ) : membros.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">Nenhum membro cadastrado neste time.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm md:text-base flex items-center gap-2 flex-wrap">
              {timeAtual && (
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: timeAtual.cor || "hsl(var(--primary))" }} 
                />
              )}
              <span className="truncate">{timeAtual?.nome}</span>
              <Badge variant="secondary" className="text-xs whitespace-nowrap ml-auto">
                {cultos.length} cultos
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="inline-block min-w-full">
              <table className="w-full border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 md:p-3 text-left font-semibold min-w-[140px] md:min-w-[180px]">
                      Voluntário
                    </th>
                    {cultos.map((culto) => (
                      <th key={culto.id} className="p-2 md:p-3 text-center font-semibold min-w-[80px] md:min-w-[100px]">
                        <div className="text-muted-foreground text-xs">
                          {format(parseISO(culto.data_evento), "EEE", { locale: ptBR })}
                        </div>
                        <div className="font-bold">
                          {format(parseISO(culto.data_evento), "dd/MM")}
                        </div>
                      </th>
                    ))}
                    <th className="p-2 md:p-3 text-center font-semibold min-w-[60px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {membros.map((membro) => {
                    const totalEscalas = cultos.filter(c => isEscalado(membro.pessoa_id, c.id)).length;
                    
                    return (
                      <tr key={membro.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-2 md:p-3 sticky left-0 bg-background sm:bg-transparent z-10">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate text-xs md:text-sm">{membro.profiles.nome}</span>
                            {membro.posicoes_time && (
                              <Badge variant="outline" className="text-xs flex-shrink-0 hidden sm:inline-flex">
                                {membro.posicoes_time.nome}
                              </Badge>
                            )}
                          </div>
                        </td>
                        {cultos.map((culto) => {
                          const escalado = isEscalado(membro.pessoa_id, culto.id);
                          const confirmado = isConfirmado(membro.pessoa_id, culto.id);

                          return (
                            <td key={culto.id} className="p-2 md:p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Checkbox
                                  checked={escalado}
                                  onCheckedChange={() => handleToggleEscala(membro.pessoa_id, culto.id, membro.posicao_id)}
                                  className="h-4 w-4"
                                />
                                {escalado && (
                                  confirmado ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                                  )
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-2 md:p-3 text-center">
                          <Badge variant={totalEscalas > 0 ? "default" : "secondary"} className="text-xs">
                            {totalEscalas}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold border-t">
                    <td className="p-2 md:p-3 text-xs">Total por Evento</td>
                    {cultos.map((culto) => {
                      const total = membros.filter(m => isEscalado(m.pessoa_id, culto.id)).length;
                      return (
                        <td key={culto.id} className="p-2 md:p-3 text-center">
                          <Badge variant={total > 0 ? "default" : "outline"} className="text-xs">
                            {total}
                          </Badge>
                        </td>
                      );
                    })}
                    <td className="p-2 md:p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <Checkbox checked disabled className="h-4 w-4" />
              <span>Escalado</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Confirmado</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span>Pendente</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
