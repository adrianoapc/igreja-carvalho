import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  Plus,
  MoreHorizontal,
  Edit2,
  Trash2,
  Copy,
  AlertCircle,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EscalaSlotDialog from "./EscalaSlotDialog";
import AdicionarVoluntarioSheet from "./AdicionarVoluntarioSheet";

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
  duracao_minutos?: number;
  tipo: string;
  local?: string;
}

interface Voluntario {
  id: string;
  nome: string;
  avatar_url: string | null;
}

interface EscalaSlot {
  id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  pessoa_id: string;
  confirmado: boolean;
  time_id?: string;
  posicao_id?: string;
  profiles: Voluntario;
}

interface EscalaTimelineProps {
  evento: Evento;
}

export default function EscalaTimeline({ evento }: EscalaTimelineProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(
    new Date(evento.data_evento)
  );
  const [escalas, setEscalas] = useState<EscalaSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    hora: number;
    data: Date;
  } | null>(null);
  const [selectedSlotSheet, setSelectedSlotSheet] = useState<{
    hora: number;
    data: Date;
  } | null>(null);
  const [editingSlot, setEditingSlot] = useState<EscalaSlot | null>(null);

  useEffect(() => {
    loadEscalas();
  }, [selectedDate, evento.id]);

  const loadEscalas = async () => {
    try {
      setLoading(true);
      const dayStart = startOfDay(selectedDate);
      const dayEnd = endOfDay(selectedDate);

      const { data, error } = await supabase
        .from("escalas")
        .select(
          `
          id,
          data_hora_inicio,
          data_hora_fim,
          pessoa_id,
          confirmado,
          time_id,
          posicao_id,
          profiles:pessoa_id (
            id,
            nome,
            avatar_url
          )
        `
        )
        .eq("evento_id", evento.id)
        .gte("data_hora_inicio", dayStart.toISOString())
        .lt("data_hora_inicio", dayEnd.toISOString())
        .order("data_hora_inicio", { ascending: true });

      if (error) throw error;
      setEscalas(data || []);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar escalas";
      console.error("Erro ao carregar escalas:", error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = (hora: number) => {
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hora, 0, 0, 0);
    setSelectedSlotSheet({ hora, data: slotDate });
    setSheetOpen(true);
  };

  const handleEditSlot = (escala: EscalaSlot) => {
    setEditingSlot(escala);
    setSelectedSlot(null);
    setSlotDialogOpen(true);
  };

  const handleDeleteSlot = async (escalaId: string) => {
    if (!confirm("Deseja remover este voluntário do turno?")) return;

    try {
      const { error } = await supabase
        .from("escalas")
        .delete()
        .eq("id", escalaId);

      if (error) throw error;
      toast.success("Voluntário removido");
      loadEscalas();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao remover voluntário";
      console.error("Erro ao remover:", error);
      toast.error(message);
    }
  };

  const handleDuplicateSlot = async (escala: EscalaSlot) => {
    try {
      const proximaData = new Date(escala.data_hora_inicio);
      proximaData.setDate(proximaData.getDate() + 1);

      const { error } = await supabase.from("escalas").insert({
        evento_id: evento.id,
        pessoa_id: escala.pessoa_id,
        data_hora_inicio: proximaData.toISOString(),
        data_hora_fim: new Date(
          proximaData.getTime() + 24 * 60 * 60 * 1000
        ).toISOString(),
        confirmado: escala.confirmado,
        time_id: escala.time_id,
        posicao_id: escala.posicao_id,
      });

      if (error) throw error;
      toast.success("Turno duplicado para o próximo dia");
      loadEscalas();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao duplicar turno";
      console.error("Erro ao duplicar:", error);
      toast.error(message);
    }
  };

  const getEscalaForHour = (hora: number): EscalaSlot | undefined => {
    return escalas.find((e) => {
      const startHora = new Date(e.data_hora_inicio).getHours();
      return startHora === hora;
    });
  };

  const getStatusColor = (escala?: EscalaSlot) => {
    if (!escala)
      return "bg-gray-50 dark:bg-gray-950 border-dashed border-gray-300 dark:border-gray-700";
    return escala.confirmado
      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
      : "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800";
  };

  const geraSlots = () => {
    const slots = [];
    const horas =
      evento.tipo === "RELOGIO" ? 24 : (evento.duracao_minutos || 120) / 60;

    for (let i = 0; i < horas; i++) {
      slots.push(i);
    }
    return slots;
  };

  const isToday = isSameDay(selectedDate, new Date());
  const currentHour = new Date().getHours();
  const slots = geraSlots();

  return (
    <div className="space-y-4">
      {/* Header com seletor de data */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timeline de Turnos
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {evento.titulo}
              </p>
            </div>

            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) => {
                    const eventStart = new Date(evento.data_evento);
                    const eventEnd = new Date(eventStart);
                    eventEnd.setDate(
                      eventEnd.getDate() + (evento.tipo === "RELOGIO" ? 7 : 1)
                    );
                    return date < eventStart || date > eventEnd;
                  }}
                />
              </PopoverContent>
            </Popover>

            {/* Info Tags */}
            <div className="flex items-center gap-2">
              {isToday && <Badge className="bg-blue-600">Hoje</Badge>}
              <Badge variant="outline">{slots.length}h</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Timeline Slots */}
      <ScrollArea className="h-[600px] rounded-lg border">
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-muted rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum horário disponível</p>
            </div>
          ) : (
            slots.map((hora) => {
              const escala = getEscalaForHour(hora);
              const isCurrentHour = isToday && hora === currentHour;
              const horaFim = hora + 1;

              return (
                <div
                  key={hora}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isCurrentHour
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                      : getStatusColor(escala)
                  }`}
                >
                  {/* Horário */}
                  <div className="w-20 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-sm font-bold">
                        {String(hora).padStart(2, "0")}:00
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-5">
                      até {String(horaFim).padStart(2, "0")}:00
                    </span>
                  </div>

                  {/* Voluntário ou Vazio */}
                  <div className="flex-1 min-w-0">
                    {escala ? (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={escala.profiles.avatar_url || undefined}
                          />
                          <AvatarFallback>
                            {escala.profiles.nome.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {escala.profiles.nome}
                          </p>
                          <Badge
                            variant={
                              escala.confirmado ? "default" : "secondary"
                            }
                            className="text-xs mt-1"
                          >
                            {escala.confirmado ? "Confirmado" : "Pendente"}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddSlot(hora)}
                        className="w-full border-dashed text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Voluntário
                      </Button>
                    )}
                  </div>

                  {/* Ações */}
                  {escala && (
                    <div className="flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEditSlot(escala)}
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicateSlot(escala)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Repetir Amanhã
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteSlot(escala.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Dialog para Adicionar/Editar Slot */}
      <EscalaSlotDialog
        open={slotDialogOpen}
        onOpenChange={setSlotDialogOpen}
        evento={evento}
        slot={selectedSlot}
        editingSlot={editingSlot}
        onSuccess={() => {
          loadEscalas();
          setSlotDialogOpen(false);
          setSelectedSlot(null);
          setEditingSlot(null);
        }}
      />

      {/* Sheet para Adicionar Voluntário com Recorrência */}
      <AdicionarVoluntarioSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        evento={evento}
        slotData={selectedSlotSheet || undefined}
        onSuccess={() => {
          loadEscalas();
          setSheetOpen(false);
          setSelectedSlotSheet(null);
        }}
      />
    </div>
  );
}
