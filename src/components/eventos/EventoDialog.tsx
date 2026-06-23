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
import { useAuthContext } from "@/contexts/AuthContextProvider";
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
  Plus,
  Pencil,
  Trash2,
  Ticket,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, differenceInMinutes, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  gerarDatasRecorrentes,
  formatarDescricaoRecorrencia,
  type TipoRecorrencia,
  type FimRecorrencia,
} from "@/lib/eventos-recorrentes";

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
  // Campos de inscrição
  requer_inscricao?: boolean | null;
  requer_pagamento?: boolean | null;
  valor_inscricao?: number | null;
  vagas_limite?: number | null;
  inscricoes_abertas_ate?: string | null;
  categoria_financeira_id?: string | null;
  conta_financeira_id?: string | null;
  // Campos financeiros
  tem_oferta?: boolean | null;
  // Site público
  publicar_no_site?: boolean | null;
}

interface EventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: Evento | null;
  onSuccess: () => void;
  initialDate?: Date;
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

interface Lote {
  id?: string;
  nome: string;
  descricao: string;
  valor: number;
  vigencia_inicio: Date | null;
  vigencia_fim: Date | null;
  vagas_limite: number | null;
  ativo: boolean;
  ordem: number;
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
  // Campos de Inscrição
  requer_inscricao: z.boolean().default(false),
  requer_pagamento: z.boolean().default(false),
  valor_inscricao: z.number().min(0).optional(),
  vagas_limite: z.number().int().min(1).optional().nullable(),
  inscricoes_abertas_ate: z.date().optional().nullable(),
  categoria_financeira_id: z.string().optional().nullable(),
  conta_financeira_id: z.string().optional().nullable(),
  exigir_documento_checkin: z.boolean().default(false),
  // Campos financeiros
  tem_oferta: z.boolean().default(false),
  // Site público
  publicar_no_site: z.boolean().default(false),
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

const STATUS_OPTIONS = [
  { value: "planejado", label: "📝 Planejado" },
  { value: "confirmado", label: "✅ Confirmado" },
  { value: "realizado", label: "🏁 Realizado" },
  { value: "cancelado", label: "❌ Cancelado" },
];

export default function EventoDialog({
  open,
  onOpenChange,
  evento,
  onSuccess,
  initialDate,
}: EventoDialogProps) {
  const { igrejaId, filialId, isAllFiliais } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [templateApplied, setTemplateApplied] = useState(false);
  const [subtipos, setSubtipos] = useState<Subtipo[]>([]);
  const [categoriasFinanceiras, setCategoriasFinanceiras] = useState<
    { id: string; nome: string }[]
  >([]);
  const [contasFinanceiras, setContasFinanceiras] = useState<
    { id: string; nome: string }[]
  >([]);

  // Estado para lotes
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loteEditando, setLoteEditando] = useState<number | null>(null);
  const [mostrarLotes, setMostrarLotes] = useState(false);

  // Estado para recorrência
  const [criarMultiplos, setCriarMultiplos] = useState(false);
  const [tipoRecorrencia, setTipoRecorrencia] =
    useState<TipoRecorrencia>("semanal");
  const [intervaloRecorrencia, setIntervaloRecorrencia] = useState(1);
  const [fimTipoRecorrencia, setFimTipoRecorrencia] =
    useState<FimRecorrencia>("ocorrencias");
  const [numOcorrencias, setNumOcorrencias] = useState(4);
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState<
    Date | undefined
  >();
  const [diasSemanaSelecionados, setDiasSemanaSelecionados] = useState<
    number[]
  >([]);
  const [eventosGerados, setEventosGerados] = useState<Date[]>([]);

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
      requer_inscricao: false,
      requer_pagamento: false,
      tem_oferta: true,
    },
  });

  const tipoSelecionado = form.watch("tipo");
  const usarDataFim = form.watch("usar_data_fim");
  const requerInscricao = form.watch("requer_inscricao");
  const requerPagamento = form.watch("requer_pagamento");
  const dataEventoWatch = form.watch("data_evento");
  const horaInicioWatch = form.watch("hora_inicio");

  useEffect(() => {
    if (tipoSelecionado) {
      loadSubtipos(tipoSelecionado);
      // Ajustar tem_oferta baseado no tipo
      if (tipoSelecionado === "CULTO") {
        form.setValue("tem_oferta", true);
      } else {
        form.setValue("tem_oferta", false);
      }

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

  // Carregar lotes ao abrir dialog de edição
  useEffect(() => {
    if (open && isEditing && evento?.id) {
      loadLotesExistentes(evento.id);
    } else if (open && !isEditing) {
      setLotes([]);
    }
  }, [open, isEditing, evento?.id]);

  // Atualizar preview de datas geradas quando configuração de recorrência mudar
  useEffect(() => {
    if (!criarMultiplos) {
      setEventosGerados([]);
      return;
    }

    if (!dataEventoWatch || !horaInicioWatch) {
      setEventosGerados([]);
      return;
    }

    try {
      const datas = gerarDatasRecorrentes({
        dataInicial: dataEventoWatch,
        horaInicio: horaInicioWatch,
        tipo: tipoRecorrencia,
        intervalo: intervaloRecorrencia,
        fimTipo: fimTipoRecorrencia,
        numOcorrencias: numOcorrencias,
        dataFim: dataFimRecorrencia,
        diasSemana:
          diasSemanaSelecionados.length > 0
            ? diasSemanaSelecionados
            : undefined,
      });
      setEventosGerados(datas);
    } catch (error) {
      console.error("Erro ao gerar datas:", error);
      setEventosGerados([]);
    }
  }, [
    criarMultiplos,
    tipoRecorrencia,
    intervaloRecorrencia,
    fimTipoRecorrencia,
    numOcorrencias,
    dataFimRecorrencia,
    diasSemanaSelecionados,
    dataEventoWatch,
    horaInicioWatch,
  ]);

  const loadLotesExistentes = async (eventoId: string) => {
    try {
      const { data, error } = await supabase
        .from("evento_lotes")
        .select("*")
        .eq("evento_id", eventoId)
        .order("ordem", { ascending: true });

      if (error) throw error;

      const lotesFormatados: Lote[] = (data || []).map((l) => ({
        id: l.id,
        nome: l.nome,
        descricao: l.descricao || "",
        valor: l.valor,
        vigencia_inicio: l.vigencia_inicio ? new Date(l.vigencia_inicio) : null,
        vigencia_fim: l.vigencia_fim ? new Date(l.vigencia_fim) : null,
        vagas_limite: l.vagas_limite,
        ativo: l.ativo,
        ordem: l.ordem,
      }));

      setLotes(lotesFormatados);
    } catch (error) {
      console.error("Erro ao carregar lotes:", error);
    }
  };

  useEffect(() => {
    if (open) {
      if (!isEditing) loadTemplates();
      if (evento) {
        const dataInicio = new Date(evento.data_evento);
        const duracao = evento.duracao_minutos || 120;
        const dataFimCalculada = addMinutes(dataInicio, duracao);
        const deveUsarDataFim =
          evento.tipo === "RELOGIO" ||
          evento.tipo === "EVENTO" ||
          evento.tipo === "TAREFA";

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
          status: evento.status as
            | "planejado"
            | "confirmado"
            | "realizado"
            | "cancelado",
          usar_data_fim: deveUsarDataFim,
          data_fim: dataFimCalculada,
          hora_fim: format(dataFimCalculada, "HH:mm"),
          // Campos de inscrição
          requer_inscricao: evento.requer_inscricao || false,
          requer_pagamento: evento.requer_pagamento || false,
          valor_inscricao: evento.valor_inscricao ?? undefined,
          vagas_limite: evento.vagas_limite ?? null,
          inscricoes_abertas_ate: evento.inscricoes_abertas_ate
            ? new Date(evento.inscricoes_abertas_ate)
            : null,
          categoria_financeira_id: evento.categoria_financeira_id ?? null,
          conta_financeira_id: evento.conta_financeira_id ?? null,
          tem_oferta: evento.tem_oferta || false,
          publicar_no_site: evento.publicar_no_site || false,
        });
      } else {
        const defaultDate = initialDate || new Date();
        form.reset({
          tipo: "CULTO",
          titulo: "",
          hora_inicio: "19:00",
          duracao_minutos: 120,
          status: "planejado",
          usar_data_fim: false,
          data_evento: defaultDate,
          data_fim: defaultDate,
          hora_fim: "21:00",
          tem_oferta: true,
        });
      }
    }
  }, [open, evento, initialDate]);

  const loadSubtipos = async (tipo: string) => {
    const tipoEnum = tipo as
      | "CULTO"
      | "RELOGIO"
      | "TAREFA"
      | "EVENTO"
      | "OUTRO";
    const { data } = await supabase
      .from("evento_subtipos")
      .select("*")
      .eq("tipo_pai", tipoEnum)
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

  const loadDadosFinanceiros = async () => {
    // Não buscar se não tiver igreja
    if (!igrejaId) return;

    // Query para categorias - filtrar por igreja
    let catQuery = supabase
      .from("categorias_financeiras")
      .select("id, nome")
      .eq("ativo", true)
      .eq("tipo", "entrada")
      .eq("igreja_id", igrejaId);

    // Query para contas - filtrar por igreja e opcionalmente por filial
    let contaQuery = supabase
      .from("contas")
      .select("id, nome")
      .eq("ativo", true)
      .eq("igreja_id", igrejaId);

    // Se não for "todas as filiais" e tiver filial específica, filtrar por ela
    if (!isAllFiliais && filialId) {
      contaQuery = contaQuery.eq("filial_id", filialId);
    }

    const [catRes, contaRes] = await Promise.all([catQuery, contaQuery]);

    setCategoriasFinanceiras(catRes.data || []);
    setContasFinanceiras(contaRes.data || []);
  };

  // Funções para gerenciar lotes
  const adicionarLote = () => {
    const novoLote: Lote = {
      nome: "",
      descricao: "",
      valor: 0,
      vigencia_inicio: null,
      vigencia_fim: null,
      vagas_limite: null,
      ativo: true,
      ordem: lotes.length,
    };
    setLotes([...lotes, novoLote]);
    setLoteEditando(lotes.length);
  };

  const removerLote = (index: number) => {
    setLotes(lotes.filter((_, i) => i !== index));
    if (loteEditando === index) setLoteEditando(null);
  };

  const atualizarLote = (index: number, campo: keyof Lote, valor: any) => {
    const novosLotes = [...lotes];
    novosLotes[index] = { ...novosLotes[index], [campo]: valor };
    setLotes(novosLotes);
  };

  const salvarLotes = async (eventoId: string) => {
    try {
      // Deletar lotes existentes que não estão mais na lista
      if (isEditing) {
        const lotesExistentes = await supabase
          .from("evento_lotes")
          .select("id")
          .eq("evento_id", eventoId);

        const idsNaLista = lotes.filter((l) => l.id).map((l) => l.id);
        const idsParaDeletar = (lotesExistentes.data || [])
          .map((l) => l.id)
          .filter((id) => !idsNaLista.includes(id));

        if (idsParaDeletar.length > 0) {
          await supabase.from("evento_lotes").delete().in("id", idsParaDeletar);
        }
      }

      // Salvar ou atualizar lotes
      for (const lote of lotes) {
        const payload = {
          evento_id: eventoId,
          nome: lote.nome,
          descricao: lote.descricao || null,
          valor: lote.valor,
          vigencia_inicio: lote.vigencia_inicio?.toISOString() || null,
          vigencia_fim: lote.vigencia_fim?.toISOString() || null,
          vagas_limite: lote.vagas_limite,
          ativo: lote.ativo,
          ordem: lote.ordem,
          igreja_id: igrejaId,
          filial_id: filialId,
        };

        if (lote.id) {
          // Atualizar existente
          await supabase.from("evento_lotes").update(payload).eq("id", lote.id);
        } else {
          // Inserir novo
          await supabase.from("evento_lotes").insert(payload);
        }
      }
    } catch (error) {
      console.error("Erro ao salvar lotes:", error);
      throw error;
    }
  };

  // Carregar dados financeiros quando tipo for EVENTO
  useEffect(() => {
    if (tipoSelecionado === "EVENTO" && open && igrejaId) {
      loadDadosFinanceiros();
    }
  }, [tipoSelecionado, open, igrejaId, filialId, isAllFiliais]);

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
        // Campos de inscrição (apenas para EVENTO)
        requer_inscricao:
          data.tipo === "EVENTO" ? data.requer_inscricao || false : false,
        requer_pagamento:
          data.tipo === "EVENTO" && data.requer_inscricao
            ? data.requer_pagamento || false
            : false,
        valor_inscricao:
          data.tipo === "EVENTO" && data.requer_pagamento
            ? data.valor_inscricao
            : null,
        vagas_limite:
          data.tipo === "EVENTO" && data.requer_inscricao
            ? data.vagas_limite
            : null,
        inscricoes_abertas_ate:
          data.tipo === "EVENTO" &&
          data.requer_inscricao &&
          data.inscricoes_abertas_ate
            ? data.inscricoes_abertas_ate.toISOString()
            : null,
        categoria_financeira_id:
          data.tipo === "EVENTO" && data.requer_pagamento
            ? data.categoria_financeira_id
            : null,
        conta_financeira_id:
          data.tipo === "EVENTO" && data.requer_pagamento
            ? data.conta_financeira_id
            : null,
        exigir_documento_checkin:
          data.tipo === "EVENTO" && data.requer_inscricao
            ? data.exigir_documento_checkin || false
            : false,
        tem_oferta: data.tem_oferta || false,
        publicar_no_site: data.publicar_no_site || false,
      };

      if (isEditing) {
        await supabase.from("eventos").update(payload).eq("id", evento!.id);
        // Salvar lotes se evento requer pagamento
        if (
          data.tipo === "EVENTO" &&
          data.requer_pagamento &&
          lotes.length > 0
        ) {
          await salvarLotes(evento!.id);
        }
        toast.success("Atualizado!");
      } else {
        // Criar múltiplos eventos se recorrência está ativada
        if (criarMultiplos && eventosGerados.length > 0) {
          // Criar array de eventos com as datas geradas
          const eventosParaCriar = eventosGerados.map((dataEvento) => ({
            ...payload,
            data_evento: dataEvento.toISOString(),
            igreja_id: igrejaId,
            filial_id: isAllFiliais ? null : filialId,
          }));

          // Inserir todos os eventos em batch
          const { error: batchError } = await supabase
            .from("eventos")
            .insert(eventosParaCriar);

          if (batchError) throw batchError;

          toast.success(
            `${eventosGerados.length} ${eventosGerados.length === 1 ? "evento criado" : "eventos criados"} com sucesso!`,
          );
        } else {
          // Criar apenas um evento (comportamento normal)
          const { data: novoEvento, error: singleError } = await supabase
            .from("eventos")
            .insert([
              {
                ...payload,
                igreja_id: igrejaId,
                filial_id: isAllFiliais ? null : filialId,
              },
            ])
            .select()
            .single();

          if (singleError) throw singleError;

          // Salvar lotes se evento requer pagamento
          if (
            novoEvento &&
            data.tipo === "EVENTO" &&
            data.requer_pagamento &&
            lotes.length > 0
          ) {
            await salvarLotes(novoEvento.id);
          }
          toast.success("Criado!");
        }
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao salvar evento";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = (template: Template) => {
    if (template.tipo_culto)
      form.setValue("tipo", template.tipo_culto as Evento["tipo"]);
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
      dialogContentProps={{ className: "sm:max-w-4xl" }}
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
                                  : "border-border bg-card/50",
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

              {/* TÍTULO, CATEGORIA E STATUS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* AGENDAMENTO - Container Cinza */}
              <div className="bg-muted/20 p-5 rounded-xl border border-border/60">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                    Data e Horário
                  </Label>
                  {!isRelogio && !isTarefa && !isEventoGeral && (
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
                                    !field.value && "text-muted-foreground",
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
                                      !field.value && "text-muted-foreground",
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

              {/* OFERTAS - Independente de Inscrição */}
              <FormField
                control={form.control}
                name="tem_oferta"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-0.5 flex-1">
                      <FormLabel className="font-medium cursor-pointer">
                        🙏 Ofertas disponíveis
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Permite que membros contribuam com oferta durante o
                        evento
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {/* PUBLICAR NO SITE */}
              <FormField
                control={form.control}
                name="publicar_no_site"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-0.5 flex-1">
                      <FormLabel className="font-medium cursor-pointer">
                        🌐 Publicar na agenda do site
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Exibe este evento na agenda pública do site institucional
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {/* SEÇÃO DE RECORRÊNCIA - Apenas para novos eventos */}
              {!isEditing && (
                <div className="bg-purple-50/50 border border-purple-200 p-5 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={criarMultiplos}
                        onCheckedChange={setCriarMultiplos}
                        id="criar-multiplos"
                      />
                      <Label
                        htmlFor="criar-multiplos"
                        className="text-sm font-semibold cursor-pointer"
                      >
                        🔄 Criar múltiplas ocorrências deste evento
                      </Label>
                    </div>
                  </div>

                  {criarMultiplos && (
                    <div className="space-y-4 pl-4 border-l-2 border-purple-300">
                      {/* Tipo de Recorrência */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Repetir
                        </Label>
                        <Select
                          value={tipoRecorrencia}
                          onValueChange={(v) =>
                            setTipoRecorrencia(v as TipoRecorrencia)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="diaria">Diariamente</SelectItem>
                            <SelectItem value="semanal">
                              Semanalmente
                            </SelectItem>
                            <SelectItem value="mensal">Mensalmente</SelectItem>
                            <SelectItem value="anual">Anualmente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Intervalo */}
                      <div className="flex items-center gap-2">
                        <Label className="text-sm shrink-0">A cada</Label>
                        <Input
                          type="number"
                          min={1}
                          max={52}
                          value={intervaloRecorrencia}
                          onChange={(e) =>
                            setIntervaloRecorrencia(Number(e.target.value))
                          }
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">
                          {tipoRecorrencia === "diaria" &&
                            (intervaloRecorrencia === 1 ? "dia" : "dias")}
                          {tipoRecorrencia === "semanal" &&
                            (intervaloRecorrencia === 1 ? "semana" : "semanas")}
                          {tipoRecorrencia === "mensal" &&
                            (intervaloRecorrencia === 1 ? "mês" : "meses")}
                          {tipoRecorrencia === "anual" &&
                            (intervaloRecorrencia === 1 ? "ano" : "anos")}
                        </span>
                      </div>

                      {/* Dias da semana (apenas para semanal) */}
                      {tipoRecorrencia === "semanal" && (
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-muted-foreground">
                            Dias da semana (opcional)
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: 0, label: "Dom" },
                              { value: 1, label: "Seg" },
                              { value: 2, label: "Ter" },
                              { value: 3, label: "Qua" },
                              { value: 4, label: "Qui" },
                              { value: 5, label: "Sex" },
                              { value: 6, label: "Sáb" },
                            ].map((dia) => (
                              <div
                                key={dia.value}
                                className="flex items-center gap-1.5"
                              >
                                <Checkbox
                                  id={`dia-${dia.value}`}
                                  checked={diasSemanaSelecionados.includes(
                                    dia.value,
                                  )}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setDiasSemanaSelecionados([
                                        ...diasSemanaSelecionados,
                                        dia.value,
                                      ]);
                                    } else {
                                      setDiasSemanaSelecionados(
                                        diasSemanaSelecionados.filter(
                                          (d) => d !== dia.value,
                                        ),
                                      );
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`dia-${dia.value}`}
                                  className="text-xs cursor-pointer"
                                >
                                  {dia.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Deixe vazio para repetir no mesmo dia da semana do
                            evento inicial
                          </p>
                        </div>
                      )}

                      {/* Termina */}
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Termina
                        </Label>
                        <RadioGroup
                          value={fimTipoRecorrencia}
                          onValueChange={(v) =>
                            setFimTipoRecorrencia(v as FimRecorrencia)
                          }
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem
                              value="ocorrencias"
                              id="fim-ocorrencias"
                            />
                            <Label
                              htmlFor="fim-ocorrencias"
                              className="text-sm cursor-pointer"
                            >
                              Após
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              value={numOcorrencias}
                              onChange={(e) =>
                                setNumOcorrencias(Number(e.target.value))
                              }
                              disabled={fimTipoRecorrencia !== "ocorrencias"}
                              className="w-20"
                            />
                            <Label
                              htmlFor="fim-ocorrencias"
                              className="text-sm cursor-pointer"
                            >
                              {numOcorrencias === 1 ? "evento" : "eventos"}
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="ate_data" id="fim-data" />
                            <Label
                              htmlFor="fim-data"
                              className="text-sm cursor-pointer"
                            >
                              Até
                            </Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  disabled={fimTipoRecorrencia !== "ate_data"}
                                  className={cn(
                                    "w-[200px] pl-3 text-left font-normal",
                                    !dataFimRecorrencia &&
                                      "text-muted-foreground",
                                  )}
                                >
                                  {dataFimRecorrencia ? (
                                    format(dataFimRecorrencia, "dd/MM/yyyy", {
                                      locale: ptBR,
                                    })
                                  ) : (
                                    <span>Selecione a data</span>
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
                                  selected={dataFimRecorrencia}
                                  onSelect={setDataFimRecorrencia}
                                  disabled={(date) =>
                                    date <
                                    (form.getValues("data_evento") ||
                                      new Date())
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Preview das Datas */}
                      {eventosGerados.length > 0 && (
                        <div className="bg-background/50 p-3 rounded-lg border border-purple-200">
                          <p className="text-xs font-semibold mb-2 text-purple-900">
                            📅 Serão criados {eventosGerados.length}{" "}
                            {eventosGerados.length === 1 ? "evento" : "eventos"}
                            :
                          </p>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {eventosGerados.slice(0, 15).map((data, i) => (
                              <div
                                key={i}
                                className="text-xs text-muted-foreground"
                              >
                                •{" "}
                                {format(data, "dd/MM/yyyy (eeee) 'às' HH:mm", {
                                  locale: ptBR,
                                })}
                              </div>
                            ))}
                            {eventosGerados.length > 15 && (
                              <p className="text-xs text-muted-foreground italic pt-1">
                                ... e mais {eventosGerados.length - 15} eventos
                              </p>
                            )}
                          </div>
                          {eventosGerados.length > 100 && (
                            <p className="text-xs text-amber-600 mt-2">
                              ⚠️ Atenção: Muitos eventos serão criados.
                              Considere reduzir o período.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SEÇÃO DE INSCRIÇÕES - Apenas para EVENTO */}
              {isEventoGeral && (
                <div className="bg-muted/20 p-5 rounded-xl border border-border/60 space-y-4">
                  <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                    📋 Inscrições
                  </Label>

                  <FormField
                    control={form.control}
                    name="requer_inscricao"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </FormControl>
                        <FormLabel className="font-medium cursor-pointer">
                          Este evento requer inscrição prévia
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  {requerInscricao && (
                    <div className="pl-7 space-y-4 border-l-2 border-primary/20 ml-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="vagas_limite"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Limite de Vagas</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Ilimitado"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value
                                        ? parseInt(e.target.value)
                                        : null,
                                    )
                                  }
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="inscricoes_abertas_ate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Inscrições até</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground",
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "dd/MM/yyyy")
                                    ) : (
                                      <span>Sem limite</span>
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
                                    selected={field.value ?? undefined}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="requer_pagamento"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </FormControl>
                            <FormLabel className="font-medium cursor-pointer">
                              Evento pago (requer pagamento)
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="exigir_documento_checkin"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 space-y-0 pt-2 border-t border-border/40">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-0.5">
                              <FormLabel className="font-medium cursor-pointer">
                                Exigir documento no check-in
                              </FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Operador valida identidade antes de liberar
                                entrada
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      {requerPagamento && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-7 border-l-2 border-green-500/20 ml-2">
                          <FormField
                            control={form.control}
                            name="valor_inscricao"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Valor (R$)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0,00"
                                    {...field}
                                    value={field.value ?? ""}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value
                                          ? parseFloat(e.target.value)
                                          : undefined,
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="categoria_financeira_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Categoria Financeira</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value ?? undefined}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {categoriasFinanceiras.map((cat) => (
                                      <SelectItem key={cat.id} value={cat.id}>
                                        {cat.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="conta_financeira_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Conta de Destino</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value ?? undefined}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {contasFinanceiras.map((conta) => (
                                      <SelectItem
                                        key={conta.id}
                                        value={conta.id}
                                      >
                                        {conta.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {/* Gerenciamento de Lotes */}
                      {requerPagamento && (
                        <div className="space-y-3 pl-7 border-l-2 border-blue-500/20 ml-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Ticket className="h-4 w-4 text-primary" />
                              <Label className="font-medium">
                                Lotes / Categorias de Ingresso
                              </Label>
                              <Badge variant="secondary" className="text-xs">
                                {lotes.length}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMostrarLotes(!mostrarLotes)}
                            >
                              {mostrarLotes ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  Ocultar
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  Mostrar
                                </>
                              )}
                            </Button>
                          </div>

                          {mostrarLotes && (
                            <div className="space-y-2">
                              {lotes.length === 0 && (
                                <Card className="border-dashed">
                                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                                    <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>Nenhum lote configurado</p>
                                    <p className="text-xs mt-1">
                                      Crie lotes para preços diferenciados por
                                      período
                                    </p>
                                  </CardContent>
                                </Card>
                              )}

                              {lotes.map((lote, index) => (
                                <Card
                                  key={index}
                                  className={cn(!lote.ativo && "opacity-60")}
                                >
                                  <CardContent className="p-3 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <Input
                                        placeholder="Nome do lote *"
                                        value={lote.nome}
                                        onChange={(e) =>
                                          atualizarLote(
                                            index,
                                            "nome",
                                            e.target.value,
                                          )
                                        }
                                        className="flex-1"
                                      />
                                      <div className="flex items-center gap-1">
                                        <Switch
                                          checked={lote.ativo}
                                          onCheckedChange={(checked) =>
                                            atualizarLote(
                                              index,
                                              "ativo",
                                              checked,
                                            )
                                          }
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => removerLote(index)}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs">
                                          Valor (R$)
                                        </Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          placeholder="0,00"
                                          value={lote.valor || ""}
                                          onChange={(e) =>
                                            atualizarLote(
                                              index,
                                              "valor",
                                              parseFloat(e.target.value) || 0,
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Vagas</Label>
                                        <Input
                                          type="number"
                                          placeholder="Ilimitado"
                                          value={lote.vagas_limite ?? ""}
                                          onChange={(e) =>
                                            atualizarLote(
                                              index,
                                              "vagas_limite",
                                              e.target.value
                                                ? parseInt(e.target.value)
                                                : null,
                                            )
                                          }
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs">
                                          Início
                                        </Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !lote.vigencia_inicio &&
                                                  "text-muted-foreground",
                                              )}
                                            >
                                              <CalendarIcon className="mr-2 h-3 w-3" />
                                              {lote.vigencia_inicio
                                                ? format(
                                                    lote.vigencia_inicio,
                                                    "dd/MM",
                                                    { locale: ptBR },
                                                  )
                                                : "Imediato"}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent
                                            className="w-auto p-0"
                                            align="start"
                                          >
                                            <Calendar
                                              mode="single"
                                              selected={
                                                lote.vigencia_inicio ??
                                                undefined
                                              }
                                              onSelect={(date) =>
                                                atualizarLote(
                                                  index,
                                                  "vigencia_inicio",
                                                  date || null,
                                                )
                                              }
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      </div>

                                      <div className="space-y-1">
                                        <Label className="text-xs">Fim</Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !lote.vigencia_fim &&
                                                  "text-muted-foreground",
                                              )}
                                            >
                                              <CalendarIcon className="mr-2 h-3 w-3" />
                                              {lote.vigencia_fim
                                                ? format(
                                                    lote.vigencia_fim,
                                                    "dd/MM",
                                                    { locale: ptBR },
                                                  )
                                                : "Sem limite"}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent
                                            className="w-auto p-0"
                                            align="start"
                                          >
                                            <Calendar
                                              mode="single"
                                              selected={
                                                lote.vigencia_fim ?? undefined
                                              }
                                              onSelect={(date) =>
                                                atualizarLote(
                                                  index,
                                                  "vigencia_fim",
                                                  date || null,
                                                )
                                              }
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                    </div>

                                    <Input
                                      placeholder="Descrição (opcional)"
                                      value={lote.descricao}
                                      onChange={(e) =>
                                        atualizarLote(
                                          index,
                                          "descricao",
                                          e.target.value,
                                        )
                                      }
                                      className="text-sm"
                                    />
                                  </CardContent>
                                </Card>
                              ))}

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={adicionarLote}
                                className="w-full"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Lote
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
