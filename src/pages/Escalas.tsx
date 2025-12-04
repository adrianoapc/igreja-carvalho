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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  Users, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  MessageCircle
} from "lucide-react";

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

interface Culto {
  id: string;
  titulo: string;
  data_culto: string;
  tipo: string;
}

interface Escala {
  id: string;
  culto_id: string;
  time_id: string;
  pessoa_id: string;
  posicao_id: string | null;
  confirmado: boolean;
}

export default function Escalas() {
  const [times, setTimes] = useState<Time[]>([]);
  const [timeSelecionado, setTimeSelecionado] = useState<string>("");
  const [membros, setMembros] = useState<MembroTime[]>([]);
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const mesAtual = format(currentDate, "MMMM yyyy", { locale: ptBR });
  const inicioMes = startOfMonth(currentDate);
  const fimMes = endOfMonth(currentDate);

  useEffect(() => {
    loadTimes();
  }, []);

  useEffect(() => {
    if (timeSelecionado) {
      loadMembros();
    }
  }, [timeSelecionado]);

  useEffect(() => {
    loadCultos();
  }, [currentDate]);

  useEffect(() => {
    if (timeSelecionado && cultos.length > 0) {
      loadEscalas();
    }
  }, [timeSelecionado, cultos]);

  const loadTimes = async () => {
    try {
      const { data, error } = await supabase
        .from("times_culto")
        .select("*")
        .eq("ativo", true)
        .order("categoria")
        .order("nome");

      if (error) throw error;
      setTimes(data || []);
      if (data && data.length > 0) {
        setTimeSelecionado(data[0].id);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar times", { description: error.message });
    }
  };

  const loadMembros = async () => {
    if (!timeSelecionado) return;
    try {
      const { data, error } = await supabase
        .from("membros_time")
        .select(`*, profiles:pessoa_id(nome), posicoes_time:posicao_id(nome)`)
        .eq("time_id", timeSelecionado)
        .eq("ativo", true);

      if (error) throw error;
      setMembros(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar membros", { description: error.message });
    }
  };

  const loadCultos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cultos")
        .select("id, titulo, data_culto, tipo")
        .gte("data_culto", inicioMes.toISOString())
        .lte("data_culto", fimMes.toISOString())
        .order("data_culto", { ascending: true });

      if (error) throw error;
      setCultos(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar cultos", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const loadEscalas = async () => {
    if (!timeSelecionado || cultos.length === 0) return;
    try {
      const cultoIds = cultos.map(c => c.id);
      const { data, error } = await supabase
        .from("escalas_culto")
        .select("*")
        .eq("time_id", timeSelecionado)
        .in("culto_id", cultoIds);

      if (error) throw error;
      setEscalas(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar escalas", { description: error.message });
    }
  };

  const handleToggleEscala = async (pessoaId: string, cultoId: string, posicaoId: string | null) => {
    const escalaExistente = escalas.find(
      e => e.pessoa_id === pessoaId && e.culto_id === cultoId && e.time_id === timeSelecionado
    );

    try {
      if (escalaExistente) {
        const { error } = await supabase
          .from("escalas_culto")
          .delete()
          .eq("id", escalaExistente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("escalas_culto")
          .insert({
            culto_id: cultoId,
            time_id: timeSelecionado,
            pessoa_id: pessoaId,
            posicao_id: posicaoId,
            confirmado: false,
          });
        if (error) throw error;
      }
      loadEscalas();
    } catch (error: any) {
      toast.error("Erro ao atualizar escala", { description: error.message });
    }
  };

  const isEscalado = (pessoaId: string, cultoId: string) => {
    return escalas.some(e => e.pessoa_id === pessoaId && e.culto_id === cultoId);
  };

  const isConfirmado = (pessoaId: string, cultoId: string) => {
    return escalas.find(e => e.pessoa_id === pessoaId && e.culto_id === cultoId)?.confirmado || false;
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  const timeAtual = times.find(t => t.id === timeSelecionado);

  const handleNotificarPendentes = async () => {
    // Mockup - futuramente chamará webhook do Make
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Escalas Mensais
          </h1>
          <p className="text-muted-foreground">Monte as escalas do mês inteiro</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleNotificarPendentes}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          Notificar Pendentes via WhatsApp
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md min-w-[180px] justify-center">
            <Calendar className="h-4 w-4" />
            <span className="font-medium capitalize">{mesAtual}</span>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateMonth("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={timeSelecionado} onValueChange={setTimeSelecionado}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Selecione o time" />
          </SelectTrigger>
          <SelectContent>
            {times.map((time) => (
              <SelectItem key={time.id} value={time.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
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
            <div className="animate-pulse">Carregando...</div>
          </CardContent>
        </Card>
      ) : cultos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum culto encontrado neste mês.</p>
          </CardContent>
        </Card>
      ) : membros.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum membro cadastrado neste time.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {timeAtual && (
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: timeAtual.cor || "hsl(var(--primary))" }} 
                />
              )}
              {timeAtual?.nome} - {cultos.length} cultos no mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-left border-b sticky left-0 bg-background z-10 min-w-[200px]">
                        Voluntário
                      </th>
                      {cultos.map((culto) => (
                        <th key={culto.id} className="p-2 text-center border-b min-w-[100px]">
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(culto.data_culto), "EEE", { locale: ptBR })}
                          </div>
                          <div className="font-semibold">
                            {format(parseISO(culto.data_culto), "dd/MM")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(culto.data_culto), "HH:mm")}
                          </div>
                        </th>
                      ))}
                      <th className="p-2 text-center border-b min-w-[80px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membros.map((membro) => {
                      const totalEscalas = cultos.filter(c => isEscalado(membro.pessoa_id, c.id)).length;
                      const totalConfirmados = cultos.filter(c => isConfirmado(membro.pessoa_id, c.id)).length;

                      return (
                        <tr key={membro.id} className="hover:bg-muted/50">
                          <td className="p-2 border-b sticky left-0 bg-background z-10">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{membro.profiles.nome}</span>
                              {membro.posicoes_time && (
                                <Badge variant="outline" className="text-xs">
                                  {membro.posicoes_time.nome}
                                </Badge>
                              )}
                            </div>
                          </td>
                          {cultos.map((culto) => {
                            const escalado = isEscalado(membro.pessoa_id, culto.id);
                            const confirmado = isConfirmado(membro.pessoa_id, culto.id);

                            return (
                              <td key={culto.id} className="p-2 border-b text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Checkbox
                                    checked={escalado}
                                    onCheckedChange={() => handleToggleEscala(membro.pessoa_id, culto.id, membro.posicao_id)}
                                  />
                                  {escalado && (
                                    confirmado ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                    )
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-2 border-b text-center">
                            <Badge variant={totalEscalas > 0 ? "default" : "secondary"}>
                              {totalEscalas}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30">
                      <td className="p-2 font-semibold sticky left-0 bg-muted/30 z-10">
                        Total por Culto
                      </td>
                      {cultos.map((culto) => {
                        const total = membros.filter(m => isEscalado(m.pessoa_id, culto.id)).length;
                        return (
                          <td key={culto.id} className="p-2 text-center">
                            <Badge variant={total > 0 ? "default" : "outline"}>
                              {total}
                            </Badge>
                          </td>
                        );
                      })}
                      <td className="p-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Checkbox checked disabled />
              <span>Escalado</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Confirmado</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span>Pendente confirmação</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
