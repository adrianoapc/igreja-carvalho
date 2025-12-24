import { useState, useEffect } from "react";
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
import { Plus, Pencil, Trash2, Search, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CentroCusto {
  id: string;
  nome: string;
  codigo: string | null;
  ativo: boolean;
}

export default function CentrosCusto() {
  const [items, setItems] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CentroCusto | null>(null);
  const [formData, setFormData] = useState({ nome: "", codigo: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      // TENTATIVA 1: Nome padrão "centros_custo"
      const { data, error } = await supabase
        .from("centros_custo") 
        .select("*")
        .order("nome");

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      console.error("Erro fetch:", error);
      toast.error("Erro ao carregar centros de custo", { description: "Verifique se a tabela 'centros_custo' existe." });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) return toast.error("O nome é obrigatório");

    setSaving(true);
    try {
      const payload = {
        nome: formData.nome,
        codigo: formData.codigo || null,
        ativo: true
      };

      if (editingItem) {
        const { error } = await supabase.from("centros_custo").update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Atualizado com sucesso");
      } else {
        const { error } = await supabase.from("centros_custo").insert([payload]);
        if (error) throw error;
        toast.success("Criado com sucesso");
      }
      setIsDialogOpen(false);
      fetchItems();
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este centro de custo?")) return;
    try {
      const { error } = await supabase.from("centros_custo").delete().eq("id", id);
      if (error) throw error;
      toast.success("Removido com sucesso");
      fetchItems();
    } catch (error: any) {
      toast.error("Erro ao excluir", { description: error.message });
    }
  };

  const openNew = () => {
    setEditingItem(null);
    setFormData({ nome: "", codigo: "" });
    setIsDialogOpen(true);
  };

  const openEdit = (item: CentroCusto) => {
    setEditingItem(item);
    setFormData({ nome: item.nome, codigo: item.codigo || "" });
    setIsDialogOpen(true);
  };

  const filteredItems = items.filter(i => 
    i.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.codigo && i.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2"/>Carregando dados...</div>;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Centros de Custo</h2>
          <p className="text-sm text-muted-foreground">Unidades orçamentárias e projetos.</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-2"/> Novo</Button>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        <div className="p-3 border-b bg-muted/5 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="max-w-xs h-8 text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/5">
                <TableHead className="w-[100px]">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Nenhum registro encontrado.</TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell>{item.codigo ? <Badge variant="outline" className="font-mono text-[10px]">{item.codigo}</Badge> : <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5"/></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="h-3.5 w-3.5"/></Button>
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
          <DialogHeader><DialogTitle>{editingItem ? "Editar Centro" : "Novo Centro"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1 space-y-2"><label className="text-sm font-medium">Código</label><Input value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} className="font-mono"/></div>
              <div className="col-span-3 space-y-2"><label className="text-sm font-medium">Nome</label><Input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} /></div>
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