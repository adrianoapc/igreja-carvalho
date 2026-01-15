import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
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
import { useFilialId } from "@/hooks/useFilialId";

interface TarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  tarefa?: {
    id: string;
    titulo: string;
    descricao: string | null;
    status: string;
    prioridade: string;
    data_vencimento: string | null;
    responsavel_id: string | null;
  } | null;
  onSuccess: () => void;
}

export default function TarefaDialog({
  open,
  onOpenChange,
  projetoId,
  tarefa,
  onSuccess,
}: TarefaDialogProps) {
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("todo");
  const [prioridade, setPrioridade] = useState("media");
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();

  const { data: profiles } = useQuery({
    queryKey: ["profiles-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("status", ["membro", "frequentador"])
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (tarefa) {
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao || "");
      setStatus(tarefa.status);
      setPrioridade(tarefa.prioridade);
      setResponsavelId(tarefa.responsavel_id);
      setDataVencimento(
        tarefa.data_vencimento ? new Date(tarefa.data_vencimento) : undefined
      );
    } else {
      setTitulo("");
      setDescricao("");
      setStatus("todo");
      setPrioridade("media");
      setResponsavelId(null);
      setDataVencimento(undefined);
    }
  }, [tarefa, open]);

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        projeto_id: projetoId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        status,
        prioridade,
        responsavel_id: responsavelId || null,
        data_vencimento: dataVencimento
          ? dataVencimento.toISOString().split("T")[0]
          : null,
        igreja_id: igrejaId,
        filial_id: isAllFiliais ? null : filialId,
      };

      if (tarefa) {
        const { error } = await supabase
          .from("tarefas")
          .update(payload)
          .eq("id", tarefa.id);
        if (error) throw error;
        toast.success("Tarefa atualizada");
      } else {
        const { error } = await supabase.from("tarefas").insert(payload);
        if (error) throw error;
        toast.success("Tarefa criada");
      }

      onSuccess();
    } catch (error) {
      toast.error("Erro ao salvar tarefa");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!tarefa) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("tarefas")
        .delete()
        .eq("id", tarefa.id);
      if (error) throw error;
      toast.success("Tarefa excluída");
      onSuccess();
    } catch (error) {
      toast.error("Erro ao excluir tarefa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            {tarefa ? "Editar Tarefa" : "Nova Tarefa"}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Nome da tarefa"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes da tarefa"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Não Iniciado</SelectItem>
                  <SelectItem value="doing">Em Execução</SelectItem>
                  <SelectItem value="done">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select
                value={responsavelId || "none"}
                onValueChange={(v) => setResponsavelId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataVencimento
                      ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dataVencimento}
                    onSelect={setDataVencimento}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="border-t bg-muted/50 px-4 py-3 md:px-6">
          <div className="flex justify-between pt-0">
            {tarefa && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. A tarefa será excluída
                      permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {tarefa ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
