import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Culto {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  data_culto: string;
  duracao_minutos: number | null;
  local: string | null;
  pregador: string | null;
  tema: string | null;
  status: string;
}

interface CultoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  culto?: Culto | null;
  onSuccess: () => void;
}

const cultoSchema = z.object({
  tipo: z.string().min(1, "Tipo é obrigatório"),
  titulo: z.string().min(1, "Título é obrigatório").max(200, "Título muito longo"),
  descricao: z.string().max(1000, "Descrição muito longa").optional(),
  data_culto: z.date(),
  hora: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Hora inválida (use HH:MM)"),
  duracao_minutos: z.number().int().min(0).max(600).optional(),
  local: z.string().max(200, "Local muito longo").optional(),
  pregador: z.string().max(200, "Nome muito longo").optional(),
  tema: z.string().max(300, "Tema muito longo").optional(),
  status: z.enum(["planejado", "confirmado", "realizado", "cancelado"]),
});

type CultoFormData = z.infer<typeof cultoSchema>;

export default function CultoDialog({ open, onOpenChange, culto, onSuccess }: CultoDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!culto;

  const form = useForm<CultoFormData>({
    resolver: zodResolver(cultoSchema),
    defaultValues: {
      tipo: "",
      titulo: "",
      descricao: "",
      hora: "19:00",
      duracao_minutos: 120,
      local: "",
      pregador: "",
      tema: "",
      status: "planejado",
    },
  });

  useEffect(() => {
    if (culto) {
      const dataCulto = new Date(culto.data_culto);
      form.reset({
        tipo: culto.tipo,
        titulo: culto.titulo,
        descricao: culto.descricao || "",
        data_culto: dataCulto,
        hora: format(dataCulto, "HH:mm"),
        duracao_minutos: culto.duracao_minutos || undefined,
        local: culto.local || "",
        pregador: culto.pregador || "",
        tema: culto.tema || "",
        status: culto.status as "planejado" | "confirmado" | "realizado" | "cancelado",
      });
    } else {
      form.reset({
        tipo: "",
        titulo: "",
        descricao: "",
        hora: "19:00",
        duracao_minutos: 120,
        local: "",
        pregador: "",
        tema: "",
        status: "planejado",
      });
    }
  }, [culto, form]);

  const onSubmit = async (data: CultoFormData) => {
    setLoading(true);
    try {
      // Combinar data e hora
      const [horas, minutos] = data.hora.split(":").map(Number);
      const dataHoraCompleta = new Date(data.data_culto);
      dataHoraCompleta.setHours(horas, minutos, 0, 0);

      const cultoData = {
        tipo: data.tipo,
        titulo: data.titulo,
        descricao: data.descricao || null,
        data_culto: dataHoraCompleta.toISOString(),
        duracao_minutos: data.duracao_minutos || null,
        local: data.local || null,
        pregador: data.pregador || null,
        tema: data.tema || null,
        status: data.status,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("cultos")
          .update(cultoData)
          .eq("id", culto.id);

        if (error) throw error;
        toast.success("Evento atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("cultos")
          .insert([cultoData]);

        if (error) throw error;
        toast.success("Evento criado com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao salvar evento", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Evento" : "Novo Evento"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <SelectItem value="Culto de Celebração">Culto de Celebração</SelectItem>
                        <SelectItem value="Culto de Oração">Culto de Oração</SelectItem>
                        <SelectItem value="Culto de Ensino">Culto de Ensino</SelectItem>
                        <SelectItem value="Culto de Jovens">Culto de Jovens</SelectItem>
                        <SelectItem value="Santa Ceia">Santa Ceia</SelectItem>
                        <SelectItem value="Batismo">Batismo</SelectItem>
                        <SelectItem value="Evento Especial">Evento Especial</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    <Input placeholder="Ex: Culto de Celebração Dominical" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Data */}
              <FormField
                control={form.control}
                name="data_culto"
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
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="pointer-events-auto"
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
      </DialogContent>
    </Dialog>
  );
}
