import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Membro {
  user_id: string;
  nome: string;
}

interface AgendarContatoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitanteId: string;
  visitanteNome: string;
  onSuccess: () => void;
}

export function AgendarContatoDialog({ 
  open, 
  onOpenChange, 
  visitanteId, 
  visitanteNome,
  onSuccess 
}: AgendarContatoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [dataContato, setDataContato] = useState<Date>();
  const [formData, setFormData] = useState({
    membro_responsavel_id: "",
    tipo_contato: "telefonico",
    observacoes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchMembros();
    }
  }, [open]);

  const fetchMembros = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .eq("status", "membro")
        .not("user_id", "is", null)
        .order("nome");

      if (error) throw error;
      setMembros(data || []);
    } catch (error) {
      console.error("Erro ao buscar membros:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dataContato) {
      toast({
        title: "Erro",
        description: "Selecione a data do contato",
        variant: "destructive"
      });
      return;
    }

    if (!formData.membro_responsavel_id) {
      toast({
        title: "Erro",
        description: "Selecione um membro responsável",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("visitante_contatos")
        .insert({
          visitante_id: visitanteId,
          data_contato: dataContato.toISOString(),
          membro_responsavel_id: formData.membro_responsavel_id,
          tipo_contato: formData.tipo_contato,
          observacoes: formData.observacoes.trim() || null,
          status: "agendado",
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato agendado com sucesso"
      });

      setDataContato(undefined);
      setFormData({
        membro_responsavel_id: "",
        tipo_contato: "telefonico",
        observacoes: "",
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao agendar contato:", error);
      toast({
        title: "Erro",
        description: "Não foi possível agendar o contato",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Agendar Contato</h2>
          <p className="text-sm text-muted-foreground">Agendar contato com {visitanteNome}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Data do Contato *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataContato && "text-muted-foreground"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataContato ? format(dataContato, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataContato}
                  onSelect={setDataContato}
                  initialFocus
                  className="pointer-events-auto"
                  locale={ptBR}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo_contato">Tipo de Contato *</Label>
            <Select
              value={formData.tipo_contato}
              onValueChange={(value) => setFormData({ ...formData, tipo_contato: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telefonico">Telefônico</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="membro_responsavel">Responsável *</Label>
            <Select
              value={formData.membro_responsavel_id}
              onValueChange={(value) => setFormData({ ...formData, membro_responsavel_id: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um membro" />
              </SelectTrigger>
              <SelectContent>
                {membros.map((membro) => (
                  <SelectItem key={membro.user_id} value={membro.user_id}>
                    {membro.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Adicione observações sobre o contato..."
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Agendando...
                </>
              ) : (
                "Agendar"
              )}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
