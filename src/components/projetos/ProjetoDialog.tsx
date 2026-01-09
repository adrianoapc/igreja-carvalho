import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useFilialId } from "@/hooks/useFilialId";

interface ProjetoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto?: {
    id: string;
    titulo: string;
    descricao: string | null;
    status: string;
    data_inicio: string | null;
    data_fim: string | null;
    lider_id: string | null;
  } | null;
  onSuccess: () => void;
}

export default function ProjetoDialog({ open, onOpenChange, projeto, onSuccess }: ProjetoDialogProps) {
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("ativo");
  const [liderId, setLiderId] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

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
    if (projeto) {
      setTitulo(projeto.titulo);
      setDescricao(projeto.descricao || "");
      setStatus(projeto.status);
      setLiderId(projeto.lider_id);
      setDataInicio(projeto.data_inicio ? new Date(projeto.data_inicio) : undefined);
      setDataFim(projeto.data_fim ? new Date(projeto.data_fim) : undefined);
    } else {
      setTitulo("");
      setDescricao("");
      setStatus("ativo");
      setLiderId(null);
      setDataInicio(undefined);
      setDataFim(undefined);
    }
  }, [projeto, open]);

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        status,
        lider_id: liderId || null,
        data_inicio: dataInicio ? dataInicio.toISOString().split("T")[0] : null,
        data_fim: dataFim ? dataFim.toISOString().split("T")[0] : null,
        igreja_id: igrejaId,
        filial_id: isAllFiliais ? null : filialId,
      };

      if (projeto) {
        const { error } = await supabase.from("projetos").update(payload).eq("id", projeto.id);
        if (error) throw error;
        toast.success("Projeto atualizado");
      } else {
        const { error } = await supabase.from("projetos").insert(payload);
        if (error) throw error;
        toast.success("Projeto criado");
      }

      onSuccess();
    } catch (error) {
      toast.error("Erro ao salvar projeto");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title={projeto ? "Editar Projeto" : "Novo Projeto"}
    >
      <div className="flex flex-col h-full">
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Nome do projeto" />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do projeto" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Líder</Label>
              <Select value={liderId || "none"} onValueChange={v => setLiderId(v === "none" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {projeto ? "Salvar" : "Criar"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
