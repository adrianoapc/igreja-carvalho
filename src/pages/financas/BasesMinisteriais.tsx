import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

// Interface ajustada para o banco real (conforme print)
interface BaseMinisterial {
  id: string;
  titulo: string; // ✅ Ajustado de 'nome' para 'titulo'
  descricao: string | null;
  // Removi 'cor' e 'ativo' pois não aparecem no print, para evitar novos erros.
  // Se existirem no banco, podemos readicionar.
}

interface Props {
  onBack?: () => void;
}

export default function BasesMinisteriais({ onBack }: Props) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate('/financas'));
  const [bases, setBases] = useState<BaseMinisterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBase, setEditingBase] = useState<BaseMinisterial | null>(null);
  
  // Form Data ajustado
  const [formData, setFormData] = useState({ titulo: "", descricao: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBases();
  }, []);

  const fetchBases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bases_ministeriais")
        .select("*")
        .order("titulo"); // ✅ Ordenar por titulo

      if (error) throw error;
      setBases(data || []);
    } catch (error: unknown) {
      console.error("Erro ao buscar bases:", error);
      toast.error("Erro ao carregar dados", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.titulo.trim()) return toast.error("O título é obrigatório");

    setSaving(true);
    try {
      const payload = {
        titulo: formData.titulo, // ✅ Payload usa titulo
        descricao: formData.descricao,
      };

      if (editingBase) {
        const { error } = await supabase
          .from("bases_ministeriais")
          .update(payload)
          .eq("id", editingBase.id);
        if (error) throw error;
        toast.success("Atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from("bases_ministeriais")
          .insert([payload]);
        if (error) throw error;
        toast.success("Criado com sucesso");
      }
      setIsDialogOpen(false);
      fetchBases();
    } catch (error: unknown) {
      toast.error("Erro ao salvar", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir registro?")) return;
    try {
      const { error } = await supabase.from("bases_ministeriais").delete().eq("id", id);
      if (error) throw error;
      toast.success("Removido com sucesso");
      fetchBases();
    } catch (error: unknown) {
      toast.error("Erro ao excluir", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const openNew = () => {
    setEditingBase(null);
    setFormData({ titulo: "", descricao: "" });
    setIsDialogOpen(true);
  };

  const openEdit = (base: BaseMinisterial) => {
    setEditingBase(base);
    setFormData({ titulo: base.titulo, descricao: base.descricao || "" });
    setIsDialogOpen(true);
  };

  // Filtro ajustado para titulo
  const filteredBases = bases.filter(b => 
    b.titulo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2"/>Carregando bases...</div>;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-semibold tracking-tight">Bases Ministeriais</h2>
            <p className="text-sm text-muted-foreground">Grandes áreas de atuação.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar base..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-9 text-base h-10"
          />
        </div>
        <Button onClick={openNew} size="sm" className="text-xs">
          <Plus className="h-4 w-4 mr-2"/> Nova Base
        </Button>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/5">
                <TableHead>Título</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Nenhuma base encontrada.</TableCell>
                </TableRow>
              ) : (
                filteredBases.map((base) => (
                  <TableRow key={base.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{base.titulo}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{base.descricao}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(base)}><Pencil className="h-3.5 w-3.5"/></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(base.id)}><Trash2 className="h-3.5 w-3.5"/></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingBase ? "Editar Base" : "Nova Base"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <Input 
                value={formData.titulo} 
                onChange={e => setFormData({...formData, titulo: e.target.value})} 
                placeholder="Ex: Base de Adoração"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Input 
                value={formData.descricao} 
                onChange={e => setFormData({...formData, descricao: e.target.value})} 
                placeholder="Descrição opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}