import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Voluntario {
  id: string;
  nome: string;
  avatar_url?: string;
}

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
  duracao_minutos?: number;
  tipo: string;
}

interface AdicionarVoluntarioSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento: Evento;
  slotData?: { hora: number; data: Date };
  onSuccess: () => void;
}

type RecurrenceType = "none" | "daily" | "weekly" | "custom";

const DIAS_SEMANA = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

export default function AdicionarVoluntarioSheet({
  open,
  onOpenChange,
  evento,
  slotData,
  onSuccess,
}: AdicionarVoluntarioSheetProps) {
  const [loading, setLoading] = useState(false);
  const [searchingVoluntarios, setSearchingVoluntarios] = useState(false);
  const [voluntarios, setVoluntarios] = useState<Voluntario[]>([]);
  const [openVoluntarioCombo, setOpenVoluntarioCombo] = useState(false);
  const [selectedVoluntario, setSelectedVoluntario] = useState<Voluntario | null>(null);

  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("10:00");
  const [dataInicio, setDataInicio] = useState<Date>(slotData?.data || new Date(evento.data_evento));

  const [repetir, setRepetir] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  const [diasSemanaCustom, setDiasSemanaCustom] = useState<string[]>([]);

  const [conflitos, setConflitos] = useState<string[]>([]);

  useEffect(() => {
    if (slotData) {
      const hora = String(slotData.hora).padStart(2, "0");
      setHoraInicio(`${hora}:00`);
      setHoraFim(`${String(slotData.hora + 1).padStart(2, "0")}:00`);
      setDataInicio(slotData.data);
    }
  }, [slotData]);

  useEffect(() => {
    if (open) {
      loadVoluntarios();
    }
  }, [open]);

  const loadVoluntarios = async () => {
    try {
      setSearchingVoluntarios(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .order("nome")
        .limit(100);

      if (error) throw error;
      setVoluntarios(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao carregar voluntários";
      console.error("Erro ao carregar voluntários:", error);
      toast.error(message);
    } finally {
      setSearchingVoluntarios(false);
    }
  };

  const calcularDatasRecorrencia = (): Date[] => {
    const datas: Date[] = [];
    const dataEvento = new Date(evento.data_evento);
    const dataFimEvento = new Date(dataEvento);

    if (evento.duracao_minutos) {
      dataFimEvento.setDate(
        dataFimEvento.getDate() + Math.ceil(evento.duracao_minutos / (24 * 60))
      );
    } else if (evento.tipo === "RELOGIO") {
      // Para RELOGIO, considerar 7 dias de escala
      dataFimEvento.setDate(dataFimEvento.getDate() + 7);
    }

    const dataAtual = new Date(dataInicio);

    if (recurrenceType === "daily") {
      while (dataAtual <= dataFimEvento) {
        datas.push(new Date(dataAtual));
        dataAtual.setDate(dataAtual.getDate() + 1);
      }
    } else if (recurrenceType === "weekly") {
      while (dataAtual <= dataFimEvento) {
        datas.push(new Date(dataAtual));
        dataAtual.setDate(dataAtual.getDate() + 7);
      }
    } else if (recurrenceType === "custom" && diasSemanaCustom.length > 0) {
      while (dataAtual <= dataFimEvento) {
        if (diasSemanaCustom.includes(String(dataAtual.getDay()))) {
          datas.push(new Date(dataAtual));
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
      }
    }

    return datas;
  };

  const verificarConflitos = async (datas: Date[]): Promise<string[]> => {
    const conflitosDetectados: string[] = [];

    try {
      for (const data of datas) {
        const dayStart = startOfDay(data);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const { data: escalasExistentes } = await supabase
          .from("escalas")
          .select("data_hora_inicio, profiles:pessoa_id(nome)")
          .eq("evento_id", evento.id)
          .eq("pessoa_id", selectedVoluntario?.id)
          .gte("data_hora_inicio", dayStart.toISOString())
          .lt("data_hora_inicio", dayEnd.toISOString());

        if (escalasExistentes && escalasExistentes.length > 0) {
          conflitosDetectados.push(format(data, "dd/MM", { locale: ptBR }));
        }
      }
    } catch (error: unknown) {
      console.error("Erro ao verificar conflitos:", error);
    }

    return conflitosDetectados;
  };

  const handleSalvar = async () => {
    if (!selectedVoluntario) {
      toast.error("Selecione um voluntário");
      return;
    }

    setLoading(true);
    try {
      let datasParaEscalar: Date[] = [];

      if (repetir && recurrenceType !== "none") {
        datasParaEscalar = calcularDatasRecorrencia();
      } else {
        datasParaEscalar = [dataInicio];
      }

      if (datasParaEscalar.length === 0) {
        toast.error("Nenhuma data válida para escalar");
        setLoading(false);
        return;
      }

      // Verificar conflitos
      const conflitosEncontrados = await verificarConflitos(datasParaEscalar);

      if (conflitosEncontrados.length > 0) {
        setConflitos(conflitosEncontrados);
        const conflitosList = conflitosEncontrados.join(", ");
        toast.warning(`⚠️ Já existem escalas em: ${conflitosList}`);
        return;
      }

      // Criar array de escalas
      const escalasParaInserir = datasParaEscalar.map((data) => {
        const [horaI, minI] = horaInicio.split(":").map(Number);
        const [horaF, minF] = horaFim.split(":").map(Number);

        const dataHoraInicio = new Date(data);
        dataHoraInicio.setHours(horaI, minI, 0, 0);

        const dataHoraFim = new Date(data);
        dataHoraFim.setHours(horaF, minF, 0, 0);

        return {
          evento_id: evento.id,
          pessoa_id: selectedVoluntario.id,
          data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(),
          confirmado: false,
        };
      });

      // Inserir escalas
      const { error } = await supabase
        .from("escalas")
        .insert(escalasParaInserir);

      if (error) throw error;

      toast.success(
        `${selectedVoluntario.nome} escalado para ${escalasParaInserir.length} turno(s)!`
      );

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao salvar escalas";
      console.error("Erro ao salvar escalas:", error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedVoluntario(null);
    setHoraInicio("09:00");
    setHoraFim("10:00");
    setDataInicio(new Date(evento.data_evento));
    setRepetir(false);
    setRecurrenceType("none");
    setDiasSemanaCustom([]);
    setConflitos([]);
  };

  const toggleDiaSemana = (dia: string) => {
    setDiasSemanaCustom((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const datasEscala = repetir && recurrenceType !== "none" ? calcularDatasRecorrencia() : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>Adicionar Voluntário</SheetTitle>
          <SheetDescription>{evento.titulo}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-6 py-4">
            {/* Seleção de Voluntário */}
            <div className="space-y-2">
              <Label>Voluntário</Label>
              <Popover open={openVoluntarioCombo} onOpenChange={setOpenVoluntarioCombo}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openVoluntarioCombo}
                    className="w-full justify-between"
                    disabled={searchingVoluntarios}
                  >
                    {selectedVoluntario
                      ? selectedVoluntario.nome
                      : "Selecione um voluntário..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar voluntário..." />
                    <CommandEmpty>Nenhum voluntário encontrado.</CommandEmpty>
                    <CommandGroup>
                      <ScrollArea className="h-[200px]">
                        {voluntarios.map((vol) => (
                          <CommandItem
                            key={vol.id}
                            value={vol.id}
                            onSelect={() => {
                              setSelectedVoluntario(vol);
                              setOpenVoluntarioCombo(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedVoluntario?.id === vol.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {vol.nome}
                          </CommandItem>
                        ))}
                      </ScrollArea>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Horário */}
            <div className="space-y-3">
              <Label>Horário</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Início</label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Fim</label>
                  <input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Recorrência */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="repetir"
                  checked={repetir}
                  onCheckedChange={(checked) => {
                    setRepetir(checked as boolean);
                    if (!checked) setRecurrenceType("none");
                  }}
                  disabled={loading}
                />
                <Label htmlFor="repetir" className="cursor-pointer font-medium">
                  Repetir escala?
                </Label>
              </div>

              {repetir && (
                <div className="space-y-3 pl-4 border-l-2 border-primary">
                  <RadioGroup
                    value={recurrenceType}
                    onValueChange={(value) =>
                      setRecurrenceType(value as RecurrenceType)
                    }
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="daily" id="daily" />
                      <Label htmlFor="daily" className="cursor-pointer text-sm">
                        Todos os dias
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="weekly" id="weekly" />
                      <Label htmlFor="weekly" className="cursor-pointer text-sm">
                        Semanalmente (mesmo dia da semana)
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="custom" id="custom" />
                      <Label htmlFor="custom" className="cursor-pointer text-sm">
                        Personalizado
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Seleção de Dias da Semana (Custom) */}
                  {recurrenceType === "custom" && (
                    <div className="space-y-2 mt-3 pl-4 bg-muted/50 p-3 rounded-md">
                      <p className="text-xs font-medium text-muted-foreground">
                        Selecione os dias:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {DIAS_SEMANA.map((dia) => (
                          <div key={dia.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`dia-${dia.value}`}
                              checked={diasSemanaCustom.includes(dia.value)}
                              onCheckedChange={() => toggleDiaSemana(dia.value)}
                              disabled={loading}
                            />
                            <Label
                              htmlFor={`dia-${dia.value}`}
                              className="cursor-pointer text-xs"
                            >
                              {dia.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview de Datas */}
                  {datasEscala.length > 0 && (
                    <div className="space-y-2 mt-3 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                        {datasEscala.length} turno(s) serão criados:
                      </p>
                      <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto">
                        {datasEscala.map((data, idx) => (
                          <div key={idx} className="text-xs text-blue-800 dark:text-blue-300">
                            {format(data, "dd/MM (EEE)", { locale: ptBR })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Alertas de Conflito */}
            {conflitos.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Conflitos detectados nos dias: {conflitos.join(", ")}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        {/* Botões */}
        <div className="border-t pt-4 flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={loading || !selectedVoluntario}
            className="flex-1"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
