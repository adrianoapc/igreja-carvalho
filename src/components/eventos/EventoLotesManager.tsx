import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  Calendar as CalendarIcon,
  Ticket,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContextProvider";

interface Lote {
  id: string;
  evento_id: string;
  nome: string;
  descricao: string | null;
  valor: number;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  vagas_limite: number | null;
  vagas_utilizadas: number;
  ordem: number;
  ativo: boolean;
}

interface EventoLotesManagerProps {
  eventoId: string;
  categoriaFinanceiraId?: string | null;
  contaFinanceiraId?: string | null;
}

export function EventoLotesManager({ 
  eventoId, 
  categoriaFinanceiraId, 
  contaFinanceiraId 
}: EventoLotesManagerProps) {
  const { igrejaId, filialId } = useAuthContext();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLote, setEditingLote] = useState<Lote | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState<number>(0);
  const [vigenciaInicio, setVigenciaInicio] = useState<Date | undefined>();
  const [vigenciaFim, setVigenciaFim] = useState<Date | undefined>();
  const [vagasLimite, setVagasLimite] = useState<number | null>(null);
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    loadLotes();
  }, [eventoId]);

  const loadLotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("evento_lotes")
        .select("*")
        .eq("evento_id", eventoId)
        .order("ordem", { ascending: true });

      if (error) throw error;
      setLotes((data as Lote[]) || []);
    } catch (error) {
      console.error("Erro ao carregar lotes:", error);
      toast.error("Erro ao carregar lotes");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNome("");
    setDescricao("");
    setValor(0);
    setVigenciaInicio(undefined);
    setVigenciaFim(undefined);
    setVagasLimite(null);
    setAtivo(true);
    setEditingLote(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (lote: Lote) => {
    setEditingLote(lote);
    setNome(lote.nome);
    setDescricao(lote.descricao || "");
    setValor(lote.valor);
    setVigenciaInicio(lote.vigencia_inicio ? new Date(lote.vigencia_inicio) : undefined);
    setVigenciaFim(lote.vigencia_fim ? new Date(lote.vigencia_fim) : undefined);
    setVagasLimite(lote.vagas_limite);
    setAtivo(lote.ativo);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome do lote é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        evento_id: eventoId,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        valor,
        vigencia_inicio: vigenciaInicio?.toISOString() || null,
        vigencia_fim: vigenciaFim?.toISOString() || null,
        vagas_limite: vagasLimite,
        ativo,
        igreja_id: igrejaId,
        filial_id: filialId,
        ordem: editingLote ? editingLote.ordem : lotes.length,
      };

      if (editingLote) {
        const { error } = await supabase
          .from("evento_lotes")
          .update(payload)
          .eq("id", editingLote.id);

        if (error) throw error;
        toast.success("Lote atualizado!");
      } else {
        const { error } = await supabase
          .from("evento_lotes")
          .insert(payload);

        if (error) throw error;
        toast.success("Lote criado!");
      }

      setDialogOpen(false);
      resetForm();
      loadLotes();
    } catch (error) {
      toast.error("Erro ao salvar lote");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loteId: string) => {
    const lote = lotes.find(l => l.id === loteId);
    if (lote && lote.vagas_utilizadas > 0) {
      toast.error("Não é possível excluir um lote com inscrições");
      return;
    }

    if (!confirm("Deseja excluir este lote?")) return;

    try {
      const { error } = await supabase
        .from("evento_lotes")
        .delete()
        .eq("id", loteId);

      if (error) throw error;
      toast.success("Lote excluído");
      loadLotes();
    } catch (error) {
      toast.error("Erro ao excluir lote");
      console.error(error);
    }
  };

  const toggleAtivo = async (lote: Lote) => {
    try {
      const { error } = await supabase
        .from("evento_lotes")
        .update({ ativo: !lote.ativo })
        .eq("id", lote.id);

      if (error) throw error;
      loadLotes();
    } catch (error) {
      toast.error("Erro ao atualizar lote");
    }
  };

  const getLoteStatus = (lote: Lote) => {
    if (!lote.ativo) return { label: "Inativo", color: "bg-gray-100 text-gray-800" };
    
    const now = new Date();
    if (lote.vigencia_inicio && new Date(lote.vigencia_inicio) > now) {
      return { label: "Agendado", color: "bg-blue-100 text-blue-800" };
    }
    if (lote.vigencia_fim && new Date(lote.vigencia_fim) < now) {
      return { label: "Encerrado", color: "bg-red-100 text-red-800" };
    }
    if (lote.vagas_limite && lote.vagas_utilizadas >= lote.vagas_limite) {
      return { label: "Esgotado", color: "bg-orange-100 text-orange-800" };
    }
    return { label: "Disponível", color: "bg-green-100 text-green-800" };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Lotes / Categorias de Ingresso</h3>
        </div>
        <Button size="sm" onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lote
        </Button>
      </div>

      {lotes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Ticket className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum lote configurado</p>
            <p className="text-sm">Crie lotes para ter preços diferenciados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {lotes.map((lote) => {
            const status = getLoteStatus(lote);
            return (
              <Card key={lote.id} className={cn(!lote.ativo && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lote.nome}</span>
                        <Badge className={status.color}>{status.label}</Badge>
                      </div>
                      {lote.descricao && (
                        <p className="text-sm text-muted-foreground">{lote.descricao}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lote.valor)}
                        </span>
                        {lote.vagas_limite && (
                          <span>
                            {lote.vagas_utilizadas}/{lote.vagas_limite} vagas
                          </span>
                        )}
                        {lote.vigencia_inicio && (
                          <span>
                            De {format(new Date(lote.vigencia_inicio), "dd/MM", { locale: ptBR })}
                            {lote.vigencia_fim && ` até ${format(new Date(lote.vigencia_fim), "dd/MM", { locale: ptBR })}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch 
                        checked={lote.ativo} 
                        onCheckedChange={() => toggleAtivo(lote)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(lote)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(lote.id)}
                        disabled={lote.vagas_utilizadas > 0}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de Criação/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLote ? "Editar Lote" : "Novo Lote"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Lote *</Label>
              <Input
                placeholder="Ex: Lote 1, Infantil, Casal..."
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Descrição opcional..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início da Vigência</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !vigenciaInicio && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {vigenciaInicio ? format(vigenciaInicio, "dd/MM/yy") : "Imediato"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={vigenciaInicio}
                      onSelect={setVigenciaInicio}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Fim da Vigência</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !vigenciaFim && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {vigenciaFim ? format(vigenciaFim, "dd/MM/yy") : "Sem limite"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={vigenciaFim}
                      onSelect={setVigenciaFim}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Limite de Vagas</Label>
              <Input
                type="number"
                placeholder="Ilimitado"
                value={vagasLimite ?? ""}
                onChange={(e) => setVagasLimite(e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <Label>Lote ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLote ? "Salvar" : "Criar Lote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
