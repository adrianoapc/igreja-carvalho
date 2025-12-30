import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, FileText, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";

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

const eventoSchema = z.object({
  tipo: z.enum(["CULTO", "RELOGIO", "TAREFA", "EVENTO", "OUTRO"]),
  subtipo_id: z.string().optional(),
  titulo: z.string().min(1, "Título é obrigatório").max(200, "Título muito longo"),
  descricao: z.string().max(1000, "Descrição muito longa").optional(),
  data_evento: z.date(),
  hora: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora inválida (use HH:MM)"),
  duracao_minutos: z.number().int().min(0).max(600).optional(),
  local: z.string().max(200, "Local muito longo").optional(),
  endereco: z.string().max(500, "Endereço muito longo").optional(),
  pregador: z.string().max(200, "Nome muito longo").optional(),
  tema: z.string().max(300, "Tema muito longo").optional(),
  status: z.enum(["planejado", "confirmado", "realizado", "cancelado"]),
});
type EventoFormData = z.infer<typeof eventoSchema>;

interface Subtipo {
  id: string;
  nome: string;
  tipo_pai: "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO";
  cor: string | null;
}

const TIPOS_EVENTO = [
  { value: "CULTO", label: "Culto" },
  { value: "RELOGIO", label: "Relógio de Oração" },
  { value: "TAREFA", label: "Tarefa/Atividade" },
  { value: "EVENTO", label: "Evento Geral" },
  { value: "OUTRO", label: "Outro" },
];

interface Template {
  id: string;
  nome: string;
  categoria?: string | null;
  tipo_culto?: string | null;
  tema_padrao?: string | null;
  duracao_padrao?: number | null;
  local_padrao?: string | null;
  pregador_padrao?: string | null;
  incluir_escalas?: boolean | null;
}

export default function EventoDialog({ open, onOpenChange, evento, onSuccess }: EventoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [templateApplied, setTemplateApplied] = useState(false);
  const isEditing = !!evento;
  const [subtipos, setSubtipos] = useState<Subtipo[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState<string>("");

  const form = useForm<EventoFormData>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      tipo: "CULTO",
      subtipo_id: "",
      titulo: "",
      descricao: "",
      hora: "19:00",
      duracao_minutos: 120,
      local: "",
      endereco: "",
      pregador: "",
      tema: "",
      status: "planejado",
    },
  });

  useEffect(() => {
    if (open && !isEditing) {
      loadTemplates();
    }
    // carregar subtipo ao mudar tipo
    const tipo = form.watch("tipo");
    if (tipo) {
      setTipoSelecionado(tipo);
      loadSubtipos(tipo);
    }

    if (evento) {
      const dataCulto = new Date(evento.data_evento);
      form.reset({
        tipo: evento.tipo,
        subtipo_id: evento.subtipo_id || "",
        titulo: evento.titulo,
        descricao: evento.descricao || "",
        data_evento: dataCulto,
        hora: format(dataCulto, "HH:mm"),
        duracao_minutos: evento.duracao_minutos || undefined,
        local: evento.local || "",
        endereco: evento.endereco || "",
        pregador: evento.pregador || "",
        tema: evento.tema || "",
        status: evento.status as "planejado" | "confirmado" | "realizado" | "cancelado",
      });
    } else {
      form.reset({
        tipo: "CULTO",
        subtipo_id: "",
        titulo: "",
        descricao: "",
        hora: "19:00",
        duracao_minutos: 120,
        local: "",
        endereco: "",
        pregador: "",
        tema: "",
        status: "planejado",
      });
      setTemplateApplied(false);
    }
  }, [evento, form, open, isEditing]);

  const loadSubtipos = async (tipo: string) => {
    try {
      const tipoEnum = tipo as "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO";
      const { data, error } = await supabase
        .from("evento_subtipos")
        .select("*")
        .eq("tipo_pai", tipoEnum)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setSubtipos(data || []);
    } catch (error: unknown) {
      console.error("Erro ao carregar subtipos:", error);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("templates_culto")
        .select("id, nome, categoria, tipo_culto")
        .eq("ativo", true)
        .order("categoria, nome");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: unknown) {
      console.error("Erro ao carregar templates:", error);
    }
  };

  const handleApplyTemplate = (template: Template) => {
    const tipoValue = template.tipo_culto as "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO" | undefined;
    if (tipoValue) {
      form.setValue("tipo", tipoValue);
    }
    form.setValue("titulo", template.tema_padrao || "");
    form.setValue("duracao_minutos", template.duracao_padrao || 120);
    form.setValue("local", template.local_padrao || "");
    form.setValue("pregador", template.pregador_padrao || "");
    form.setValue("tema", template.tema_padrao || "");
    
    setTemplateApplied(true);
    toast.success("Template aplicado! Configure data e finalize a criação.");
  };

  const onSubmit = async (data: EventoFormData) => {
    setLoading(true);
    try {
      // Combinar data e hora
      const [horas, minutos] = data.hora.split(":").map(Number);
      const dataHoraCompleta = new Date(data.data_evento);
      dataHoraCompleta.setHours(horas, minutos, 0, 0);

      const eventoData = {
        tipo: data.tipo,
        subtipo_id: data.subtipo_id || null,
        titulo: data.titulo,
        descricao: data.descricao || null,
        data_evento: dataHoraCompleta.toISOString(),
        duracao_minutos: data.duracao_minutos || null,
        local: data.local || null,
        endereco: data.endereco || null,
        pregador: data.pregador || null,
        tema: data.tema || null,
        status: data.status,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("eventos")
          .update(eventoData)
          .eq("id", evento!.id);

        if (error) throw error;
        toast.success("Evento atualizado com sucesso!");
      } else {
        const { data: novoCulto, error: cultoError } = await supabase
          .from("eventos")
          .insert([eventoData])
          .select()
          .single();

        if (cultoError) throw cultoError;

        // Se template foi aplicado, copiar liturgia e escalas
        if (templateApplied && selectedTemplateId && novoCulto) {
          await aplicarTemplateAoCulto(selectedTemplateId, novoCulto.id);
        }

        toast.success("Evento criado com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error("Erro ao salvar evento", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const aplicarTemplateAoCulto = async (templateId: string, cultoId: string) => {
    try {
      // Buscar template completo
      const { data: template } = await supabase
        .from("templates_culto")
        .select("*")
        .eq("id", templateId)
        .single();

      if (!template) return;

      // Copiar itens de liturgia
      const { data: itensTemplate } = await supabase
        .from("itens_template_culto")
        .select("*")
        .eq("template_id", templateId)
        .order("ordem");

      if (itensTemplate && itensTemplate.length > 0) {
        const novosItens = itensTemplate.map(item => ({
          evento_id: cultoId,
          ordem: item.ordem,
          tipo: item.tipo,
          titulo: item.titulo,
          descricao: item.descricao,
          duracao_minutos: item.duracao_minutos,
          responsavel_externo: item.responsavel_externo,
          midias_ids: item.midias_ids
        }));

        await supabase.from("liturgias").insert(novosItens);
      }

      // Copiar escalas se incluídas
      if (template.incluir_escalas) {
        const { data: escalasTemplate } = await supabase
          .from("escalas_template")
          .select("*")
          .eq("template_id", templateId);

        if (escalasTemplate && escalasTemplate.length > 0) {
          const novasEscalas = escalasTemplate.map(escala => ({
            evento_id: cultoId,
            time_id: escala.time_id,
            posicao_id: escala.posicao_id,
            pessoa_id: escala.pessoa_id,
            observacoes: escala.observacoes,
            confirmado: false
          }));

          await supabase.from("escalas").insert(novasEscalas);
        }
      }
    } catch (error: unknown) {
      console.error("Erro ao aplicar template:", error);
      toast.error("Template aplicado com avisos - verifique liturgia e escalas");
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-4 px-6 pt-6">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Editar Evento" : "Novo Evento"}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* Seleção de Template (apenas para novos cultos) */}
        {!isEditing && !templateApplied && templates.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <span className="text-sm">Deseja usar um template existente?</span>
              <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2 sm:items-center">
                <Select value={selectedTemplateId || ""} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Selecionar template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowTemplatePreview(true)}
                  disabled={!selectedTemplateId}
                  className="w-full sm:w-auto"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {templateApplied && !isEditing && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Template aplicado! Configure a data e revise os detalhes antes de salvar.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo */}
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIPOS_EVENTO.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Subtipo/Categoria (opcional) */}
              {subtipos.length > 0 && (
                <FormField
                  control={form.control}
                  name="subtipo_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria (Opcional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subtipos.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="planejado">Planejado</SelectItem>
                        <SelectItem value="confirmado">Confirmado</SelectItem>
                        <SelectItem value="realizado">Realizado</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Título */}
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Evento de Celebração Dominical" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Data */}
              <FormField
                control={form.control}
                name="data_evento"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione a data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Hora */}
              <FormField
                control={form.control}
                name="hora"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Duração */}
              <FormField
                control={form.control}
                name="duracao_minutos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (minutos)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="120"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Local */}
              <FormField
                control={form.control}
                name="local"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Templo Principal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Endereço completo */}
            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço completo (para Google Maps)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Rua das Flores, 123 - Centro, São Paulo - SP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pregador */}
              <FormField
                control={form.control}
                name="pregador"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pregador/Ministrante</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do pregador" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tema */}
              <FormField
                control={form.control}
                name="tema"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tema</FormLabel>
                    <FormControl>
                      <Input placeholder="Tema da mensagem" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Descrição */}
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição adicional do evento..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : isEditing ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
        </div>
      </div>

      {/* Preview Dialog */}
      <TemplatePreviewDialog
        open={showTemplatePreview}
        onOpenChange={setShowTemplatePreview}
        templateId={selectedTemplateId}
        onConfirm={handleApplyTemplate}
      />
    </ResponsiveDialog>
  );
}
