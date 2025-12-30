import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calendar as CalendarIcon,
  FileText,
  Loader2,
  Clock,
} from "lucide-react";
import { format, differenceInMinutes, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";

// --- Interfaces e Tipos ---

interface Evento {
  id: string;
  tipo: "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO";
  titulo: string;
  descricao: string | null;
  data_evento: string;
  duracao_minutos: number | null;
  local: string | null;
  endereco: string | null;
  pregador: string | null;
  tema: string | null;
  status: string;
  subtipo_id?: string | null;
}

interface EventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: Evento | null;
  onSuccess: () => void;
}

interface Subtipo {
  id: string;
  nome: string;
  tipo_pai: "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO";
}

interface Template {
  id: string;
  nome: string;
  tipo_culto?: string | null;
  tema_padrao?: string | null;
  duracao_padrao?: number | null;
  local_padrao?: string | null;
  pregador_padrao?: string | null;
  incluir_escalas?: boolean | null;
}

// --- Schema de Validação ---

const eventoSchema = z.object({
  tipo: z.enum(["CULTO", "RELOGIO", "TAREFA", "EVENTO", "OUTRO"]),
  subtipo_id: z.string().optional(),
  titulo: z.string().min(1, "Título é obrigatório").max(200),
  descricao: z.string().max(1000).optional(),
  data_evento: z.date(),
  hora_inicio: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora inválida"),
  usar_data_fim: z.boolean().default(false),
  data_fim: z.date().optional(),
  hora_fim: z.string().optional(),
  duracao_minutos: z.number().int().min(0).optional(),
  local: z.string().optional(),
  endereco: z.string().optional(),
  pregador: z.string().optional(),
  tema: z.string().optional(),
  status: z.enum(["planejado", "confirmado", "realizado", "cancelado"]),
});

type EventoFormData = z.infer<typeof eventoSchema>;

// --- Configuração Visual ---

const TIPOS_EVENTO = [
  {
    value: "CULTO",
    label: "Culto",
    emoji: "🏛️",
    color:
      "bg-purple-50 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/20 dark:border-purple-800",
    desc: "Oficial / Domingo",
  },
  {
    value: "EVENTO",
    label: "Evento",
    emoji: "📅",
    color:
      "bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-950/20 dark:border-green-800",
    desc: "Geral / Reunião",
  },
  {
    value: "RELOGIO",
    label: "Relógio",
    emoji: "⏰",
    color:
      "bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/20 dark:border-blue-800",
    desc: "Turnos / 24h",
  },
  {
    value: "TAREFA",
    label: "Tarefa",
    emoji: "🧹",
    color:
      "bg-orange-50 border-orange-200 hover:bg-orange-100 dark:bg-orange-950/20 dark:border-orange-800",
    desc: "Operacional",
  },
];

export default function EventoDialog({
  open,
  onOpenChange,
  evento,
  onSuccess,
}: EventoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [templateApplied, setTemplateApplied] = useState(false);
  const [subtipos, setSubtipos] = useState<Subtipo[]>([]);

  const isEditing = !!evento;

  const form = useForm<EventoFormData>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      tipo: "CULTO",
      subtipo_id: "none",
      titulo: "",
      hora_inicio: "19:00",
      duracao_minutos: 120,
      status: "planejado",
      usar_data_fim: false,
    },
  });

  const tipoSelecionado = form.watch("tipo");
  const usarDataFim = form.watch("usar_data_fim");

  useEffect(() => {
    if (tipoSelecionado) {
      loadSubtipos(tipoSelecionado);
      if (tipoSelecionado === "RELOGIO") {
        form.setValue("usar_data_fim", true);
        if (!form.getValues("titulo"))
          form.setValue("titulo", "Relógio de Oração");
      } else if (tipoSelecionado === "EVENTO") {
        form.setValue("usar_data_fim", true);
      } else {
        form.setValue("usar_data_fim", false);
      }
    }
  }, [tipoSelecionado]);

  useEffect(() => {
    if (open) {
      if (!isEditing) loadTemplates();
      if (evento) {
        const dataInicio = new Date(evento.data_evento);
        const duracao = evento.duracao_minutos || 120;
        const dataFimCalculada = addMinutes(dataInicio, duracao);
        const deveUsarDataFim =
          evento.tipo === "RELOGIO" || evento.tipo === "EVENTO";

        form.reset({
          tipo: evento.tipo,
          subtipo_id: evento.subtipo_id || "none",
          titulo: evento.titulo,
          descricao: evento.descricao || "",
          data_evento: dataInicio,
          hora_inicio: format(dataInicio, "HH:mm"),
          duracao_minutos: duracao,
          local: evento.local || "",
          endereco: evento.endereco || "",
          pregador: evento.pregador || "",
          tema: evento.tema || "",
          status: evento.status as Evento["status"],
          usar_data_fim: deveUsarDataFim,
          data_fim: dataFimCalculada,
          hora_fim: format(dataFimCalculada, "HH:mm"),
        });
      } else {
        form.reset({
          tipo: "CULTO",
          titulo: "",
          hora_inicio: "19:00",
          duracao_minutos: 120,
          status: "planejado",
          usar_data_fim: false,
          data_evento: new Date(),
          data_fim: new Date(),
          hora_fim: "21:00",
        });
      }
    }
  }, [open, evento]);

  const loadSubtipos = async (tipo: string) => {
    const { data } = await supabase
      .from("evento_subtipos")
      .select("*")
      .eq("tipo_pai", tipo)
      .eq("ativo", true)
      .order("nome");
    setSubtipos(data || []);
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("templates_culto")
      .select("*")
      .eq("ativo", true);
    setTemplates(data || []);
  };

  const onSubmit = async (data: EventoFormData) => {
    setLoading(true);
    try {
      const [hIni, mIni] = data.hora_inicio.split(":").map(Number);
      const dataInicio = new Date(data.data_evento);
      dataInicio.setHours(hIni, mIni, 0, 0);

      let duracaoFinal = data.duracao_minutos || 0;

      if (data.usar_data_fim && data.data_fim && data.hora_fim) {
        const [hFim, mFim] = data.hora_fim.split(":").map(Number);
        const dataFim = new Date(data.data_fim);
        dataFim.setHours(hFim, mFim, 0, 0);

        const diff = differenceInMinutes(dataFim, dataInicio);
        if (diff <= 0) throw new Error("Término deve ser após o início.");
        duracaoFinal = diff;
      }

      const payload = {
        tipo: data.tipo,
        subtipo_id: data.subtipo_id === "none" ? null : data.subtipo_id,
        titulo: data.titulo,
        descricao: data.descricao,
        data_evento: dataInicio.toISOString(),
        duracao_minutos: duracaoFinal,
        local: data.local,
        endereco: data.endereco,
        pregador: data.pregador,
        tema: data.tema,
        status: data.status,
      };

      if (isEditing) {
        await supabase.from("eventos").update(payload).eq("id", evento!.id);
        toast.success("Atualizado!");
      } else {
        await supabase.from("eventos").insert([payload]).select().single();
        toast.success("Criado!");
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao salvar evento";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = (template: Template) => {
    if (template.tipo_culto) form.setValue("tipo", template.tipo_culto as Evento["tipo"]);
    form.setValue("titulo", template.tema_padrao || "");
    form.setValue("duracao_minutos", template.duracao_padrao || 120);
    setTemplateApplied(true);
  };

  const isCulto = tipoSelecionado === "CULTO";
  const isEventoGeral = tipoSelecionado === "EVENTO";
  const isTarefa = tipoSelecionado === "TAREFA";
  const isRelogio = tipoSelecionado === "RELOGIO";

  const getPregadorLabel = () => {
    if (isEventoGeral) return "Palestrante / Responsável";
    if (isCulto) return "Pregador / Ministrante";
    return "Responsável";
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-4xl" // AQUI: Força a largura expandida no Desktop (896px)
    >
      <div className="flex flex-col h-full max-h-[90vh]">
        <div className="border-b pb-4 px-6 pt-6 bg-background sticky top-0 z-10">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Editar" : "Novo"} Agendamento
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!isEditing && templates.length > 0 && (
            <div className="mb-6 p-3 bg-muted/40 rounded-lg flex flex-col sm:flex-row gap-3 items-center border border-dashed">
              <div className="flex items-center gap-2 text-sm text-muted-foreground w-full sm:w-auto shrink-0">
                <FileText className="h-4 w-4" />
                <span>Modelos:</span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto flex-1">
                <Select
                  value={selectedTemplateId || ""}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger className="h-9 text-sm bg-background w-full">
                    <SelectValue placeholder="Escolher..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplateId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowTemplatePreview(true)}
                  >
                    Ver
                  </Button>
                )}
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* TIPO */}
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={(val) => {
                          field.onChange(val);
                          form.setValue("subtipo_id", "none");
                        }}
                        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
                      >
                        {TIPOS_EVENTO.map((tipo) => (
                          <div key={tipo.value} className="relative h-full">
                            <RadioGroupItem
                              value={tipo.value}
                              id={tipo.value}
                              className="sr-only"
                            />
                            <Label
                              htmlFor={tipo.value}
                              className={cn(
                                "flex flex-col items-center justify-center text-center h-full p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-muted/50 min-h-[100px]",
                                field.value === tipo.value
                                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                                  : "border-border bg-card/50"
                              )}
                            >
                              <span className="text-3xl mb-2">
                                {tipo.emoji}
                              </span>
                              <span className="font-semibold text-sm leading-tight">
                                {tipo.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground mt-1 hidden lg:block">
                                {tipo.desc}
                              </span>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* TÍTULO E CATEGORIA */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Título *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            isRelogio ? "Relógio de Oração" : "Título do evento"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {subtipos.length > 0 ? (
                  <FormField
                    control={form.control}
                    name="subtipo_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Padrão</SelectItem>
                            {subtipos.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="hidden md:block"></div>
                )}
              </div>

              {/* AGENDAMENTO - Container Cinza */}
              <div className="bg-muted/20 p-5 rounded-xl border border-border/60">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                    Data e Horário
                  </Label>
                  {!isRelogio && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-primary"
                      onClick={() =>
                        form.setValue("usar_data_fim", !usarDataFim)
                      }
                    >
                      {usarDataFim
                        ? "Alternar para Duração"
                        : "Alternar para Data Fim"}
                    </Button>
                  )}
                </div>

                {/* Layout Flex para evitar sobreposição */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* COLUNA INICIO */}
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-muted-foreground block uppercase">
                      Início
                    </span>
                    <div className="flex gap-3">
                      <FormField
                        control={form.control}
                        name="data_evento"
                        render={({ field }) => (
                          <FormItem className="flex-1 min-w-0">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "dd/MM/yy")
                                  ) : (
                                    <span>Data</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="hora_inicio"
                        render={({ field }) => (
                          <FormItem className="w-28 shrink-0">
                            <FormControl>
                              <Input type="time" className="h-9" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* COLUNA FIM */}
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-muted-foreground block uppercase">
                      {usarDataFim ? "Término" : "Duração"}
                    </span>

                    {usarDataFim ? (
                      <div className="flex gap-3">
                        <FormField
                          control={form.control}
                          name="data_fim"
                          render={({ field }) => (
                            <FormItem className="flex-1 min-w-0">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "dd/MM/yy")
                                    ) : (
                                      <span>Data</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-auto p-0"
                                  align="start"
                                >
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) =>
                                      date < form.getValues("data_evento")
                                    }
                                  />
                                </PopoverContent>
                              </Popover>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="hora_fim"
                          render={({ field }) => (
                            <FormItem className="w-28 shrink-0">
                              <FormControl>
                                <Input type="time" className="h-9" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : (
                      <FormField
                        control={form.control}
                        name="duracao_minutos"
                        render={({ field }) => (
                          <FormItem>
                            <div className="relative">
                              <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <FormControl>
                                <Input
                                  type="number"
                                  className="pl-9"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(parseInt(e.target.value))
                                  }
                                />
                              </FormControl>
                              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                                minutos
                              </span>
                            </div>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* DETALHES EXTRAS */}
              {(isCulto || isEventoGeral) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="pregador"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{getPregadorLabel()}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={
                              isEventoGeral ? "Responsável" : "Pregador"
                            }
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tema"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tema</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={isEventoGeral ? "Pauta" : "Tema"}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {isTarefa && (
                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Atividades</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Lista de tarefas..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t sticky bottom-0 bg-background pb-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto h-11"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-primary w-full sm:w-auto min-w-[140px] h-11 text-base"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? "Salvar" : "Criar Evento"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
        <TemplatePreviewDialog
          open={showTemplatePreview}
          onOpenChange={setShowTemplatePreview}
          templateId={selectedTemplateId}
          onConfirm={handleApplyTemplate}
        />
      </div>
    </ResponsiveDialog>
  );
}
