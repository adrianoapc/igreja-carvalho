import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Calendar, Clock, Trash2, Edit2 } from "lucide-react";

interface CompromissoCalendar {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  tipo: string | null;
  cor: string | null;
  pastor_id: string;
  pastor?: { nome: string | null } | null;
}

interface CompromissoDetailsDialogProps {
  compromisso: CompromissoCalendar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPOS_COMPROMISSO = [
  { value: "COMPROMISSO", label: "Compromisso", cor: "blue" },
  { value: "BLOQUEIO", label: "Bloqueio de Agenda", cor: "gray" },
  { value: "FERIAS", label: "Férias/Afastamento", cor: "green" },
  { value: "OUTRO", label: "Outro", cor: "purple" },
];

const TIPO_COLORS: Record<string, string> = {
  COMPROMISSO: "bg-blue-100 text-blue-800",
  BLOQUEIO: "bg-gray-100 text-gray-800",
  FERIAS: "bg-green-100 text-green-800",
  OUTRO: "bg-purple-100 text-purple-800",
};

export function CompromissoDetailsDialog({
  compromisso,
  open,
  onOpenChange,
}: CompromissoDetailsDialogProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoCompromisso, setTipoCompromisso] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");

  const startEditing = () => {
    if (!compromisso) return;
    setTitulo(compromisso.titulo);
    setDescricao(compromisso.descricao || "");
    setTipoCompromisso(compromisso.tipo || "COMPROMISSO");
    setHoraInicio(format(parseISO(compromisso.data_inicio), "HH:mm"));
    setHoraFim(format(parseISO(compromisso.data_fim), "HH:mm"));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!compromisso) throw new Error("Sem compromisso");

      const dataOriginal = parseISO(compromisso.data_inicio);
      const [horaIni, minIni] = horaInicio.split(":").map(Number);
      const [horaF, minF] = horaFim.split(":").map(Number);

      const dataInicio = new Date(dataOriginal);
      dataInicio.setHours(horaIni, minIni, 0, 0);

      const dataFim = new Date(dataOriginal);
      dataFim.setHours(horaF, minF, 0, 0);

      const tipoInfo = TIPOS_COMPROMISSO.find((t) => t.value === tipoCompromisso);

      const { error } = await supabase
        .from("agenda_pastoral")
        .update({
          titulo,
          descricao: descricao || null,
          tipo: tipoCompromisso,
          cor: tipoInfo?.cor || "blue",
          data_inicio: dataInicio.toISOString(),
          data_fim: dataFim.toISOString(),
        })
        .eq("id", compromisso.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compromissos-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-pastor"] });
      toast.success("Compromisso atualizado!");
      setIsEditing(false);
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao atualizar compromisso");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!compromisso) throw new Error("Sem compromisso");

      const { error } = await supabase
        .from("agenda_pastoral")
        .delete()
        .eq("id", compromisso.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compromissos-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-pastor"] });
      toast.success("Compromisso excluído!");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao excluir compromisso");
    },
  });

  if (!compromisso) return null;

  const dataInicio = parseISO(compromisso.data_inicio);
  const dataFim = parseISO(compromisso.data_fim);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Compromisso" : "Detalhes do Compromisso"}
          </DialogTitle>
          <DialogDescription>
            {format(dataInicio, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipoCompromisso} onValueChange={setTipoCompromisso}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_COMPROMISSO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Início
                </Label>
                <Input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Fim
                </Label>
                <Input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{compromisso.titulo}</h3>
              <Badge className={TIPO_COLORS[compromisso.tipo || "COMPROMISSO"]}>
                {TIPOS_COMPROMISSO.find((t) => t.value === compromisso.tipo)?.label || "Compromisso"}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {format(dataInicio, "HH:mm")} - {format(dataFim, "HH:mm")}
            </div>

            {compromisso.pastor?.nome && (
              <div className="text-sm">
                <span className="text-muted-foreground">Pastor:</span>{" "}
                {compromisso.pastor.nome}
              </div>
            )}

            {compromisso.descricao && (
              <div className="text-sm">
                <span className="text-muted-foreground">Descrição:</span>
                <p className="mt-1">{compromisso.descricao}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEditing}>
                Cancelar
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </>
          ) : (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir compromisso?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Excluir"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button variant="outline" onClick={startEditing}>
                <Edit2 className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
