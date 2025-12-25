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
import { 
  Plus, Pencil, Trash2, Search, Loader2, 
  ChevronRight, ChevronDown, FolderTree, CornerDownRight, 
  ArrowUpCircle, ArrowDownCircle, AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tipos baseados em src/integrations/supabase/types.ts
interface Categoria {
  id: string;
  nome: string;
  tipo: string; 
  ativo: boolean;
  cor?: string | null;
  subcategorias?: Subcategoria[];
}

interface Subcategoria {
  id: string;
  categoria_id: string;
  nome: string;
  ativo: boolean;
}

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string>("saida");
  
  // Dialog States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'CATEGORIA' | 'SUBCATEGORIA'>('CATEGORIA');
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ nome: "", tipo: "saida" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Buscar Categorias (categorias_financeiras)
      const { data: cats, error: errCat } = await supabase
        .from("categorias_financeiras")
        .select("*")
        .order("nome");
      
      if (errCat) throw errCat;

      // 2. Buscar Subcategorias (subcategorias_financeiras)
      const { data: subs, error: errSub } = await supabase
        .from("subcategorias_financeiras")
        .select("*")
        .order("nome");

      if (errSub) throw errSub;

      // 3. Montar Árvore
      console.info('[categorias_financeiras] total', cats?.length || 0, cats);
      console.info('[subcategorias_financeiras] total', subs?.length || 0, subs);

      const tree = cats?.map((cat: any) => ({
        ...cat,
        // Normaliza para maiúsculo para garantir a filtragem
        tipo_normalizado: cat.tipo ? cat.tipo.toLowerCase() : "desconhecido",
        subcategorias: subs?.filter((s: any) => s.categoria_id === cat.id) || []
      })) || [];

      setCategorias(tree);
      
      // Expandir automaticamente se houver poucos itens
      if (tree.length < 15) {
        const expandAll = tree.reduce((acc: any, curr: any) => ({...acc, [curr.id]: true}), {});
        setExpandedCats(expandAll);
      }

    } catch (error: any) {
      console.error("Erro fetch:", error);
      toast.error("Erro ao carregar dados", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (catId: string) => {
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // --- HANDLERS ---

  const handleSave = async () => {
    if (!formData.nome.trim()) return toast.error("Nome obrigatório");
    
    setSaving(true);
    try {
      if (dialogType === 'CATEGORIA') {
        const payload = { 
          nome: formData.nome, 
          tipo: formData.tipo, 
          ativo: true 
        };
        
        if (editingItem) {
          const { error } = await supabase
            .from("categorias_financeiras")
            .update(payload)
            .eq("id", editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("categorias_financeiras")
            .insert([payload]);
          if (error) throw error;
        }
      } else {
        // SUBCATEGORIA
        const payload = { nome: formData.nome, categoria_id: parentId, ativo: true };
        
        if (editingItem) {
          const { error } = await supabase
            .from("subcategorias_financeiras")
            .update({ nome: formData.nome })
            .eq("id", editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("subcategorias_financeiras")
            .insert([payload]);
          if (error) throw error;
        }
      }
      toast.success("Salvo com sucesso!");
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string, type: 'CATEGORIA' | 'SUBCATEGORIA') => {
    if (!confirm("Excluir item?")) return;
    try {
      const table = type === 'CATEGORIA' ? 'categorias_financeiras' : 'subcategorias_financeiras';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success("Item excluído");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir", { description: error.message });
    }
  };

  // --- DIALOGS ---

  const openNewCategory = () => {
    setDialogType('CATEGORIA');
    setEditingItem(null);
    setParentId(null);
    setFormData({ nome: "", tipo: activeTab }); 
    setDialogOpen(true);
  };

  const openNewSub = (catId: string, tipoPai: string) => {
    setDialogType('SUBCATEGORIA');
    setEditingItem(null);
    setParentId(catId);
    setFormData({ nome: "", tipo: tipoPai });
    setDialogOpen(true);
  };

  const openEdit = (item: any, type: 'CATEGORIA' | 'SUBCATEGORIA') => {
    setDialogType(type);
    setEditingItem(item);
    setFormData({ nome: item.nome, tipo: item.tipo ? item.tipo.toLowerCase() : activeTab });
    setDialogOpen(true);
  };

  // --- RENDER DA TABELA ---
  const renderTable = (tipoFiltro: string) => {
    const filteredTree = categorias
      .filter((c: any) => c.tipo_normalizado === tipoFiltro)
      .filter(c => 
        c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.subcategorias?.some(s => s.nome?.toLowerCase().includes(searchTerm.toLowerCase()))
      );

    if (filteredTree.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <AlertCircle className="h-8 w-8 opacity-20" />
          <p>Nenhuma categoria de {tipoFiltro === 'RECEITA' ? 'entrada' : 'saída'} encontrada.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-muted/5">
            <TableHead className="w-[60%]">Nome</TableHead>
            <TableHead>Qtd. Subs</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTree.map(cat => {
            const isExpanded = expandedCats[cat.id] || searchTerm.length > 0;
            
            return (
              <>
                {/* Categoria Pai */}
                <TableRow key={cat.id} className="group hover:bg-muted/50 border-b-0">
                  <TableCell className="font-medium py-3">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleExpand(cat.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                      </Button>
                      <FolderTree className={cn(
                        "h-4 w-4",
                        cat.tipo === 'entrada' ? "text-green-600" : "text-red-600"
                      )} />
                      {cat.nome}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">
                      {cat.subcategorias?.length || 0} itens
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right py-1">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openNewSub(cat.id, cat.tipo)}>
                        <Plus className="h-3 w-3 mr-1" /> Sub
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat, 'CATEGORIA')}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItem(cat.id, 'CATEGORIA')}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Subcategorias */}
                {isExpanded && cat.subcategorias?.map((sub: any) => (
                  <TableRow key={sub.id} className="hover:bg-muted/30 border-0 bg-muted/5">
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2 pl-10 relative">
                        <CornerDownRight className="h-3 w-3 text-muted-foreground/40 absolute left-6 top-3" />
                        <span className="text-sm">{sub.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2"></TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sub, 'SUBCATEGORIA')}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItem(sub.id, 'SUBCATEGORIA')}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2"/>Carregando plano de contas...</div>;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Plano de Contas</h2>
          <p className="text-sm text-muted-foreground">Categorização de receitas e despesas.</p>
        </div>
        <Button onClick={openNewCategory} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      <Tabs defaultValue="saida" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="entrada" className="gap-2">
              <ArrowUpCircle className="h-4 w-4 text-green-600" />
              Entradas
            </TabsTrigger>
            <TabsTrigger value="saida" className="gap-2">
              <ArrowDownCircle className="h-4 w-4 text-red-600" />
              Saídas
            </TabsTrigger>
          </TabsList>

          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filtrar..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        <Card className="border shadow-sm overflow-hidden min-h-[300px]">
          <TabsContent value="entrada" className="m-0 border-none p-0">
            <div className="overflow-x-auto">
              {renderTable("entrada")}
            </div>
          </TabsContent>
          
          <TabsContent value="saida" className="m-0 border-none p-0">
            <div className="overflow-x-auto">
              {renderTable("saida")}
            </div>
          </TabsContent>
        </Card>
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar" : "Nova"} {dialogType === 'CATEGORIA' ? "Categoria" : "Subcategoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input 
                value={formData.nome} 
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                placeholder={dialogType === 'CATEGORIA' ? "Ex: Dízimos, Aluguel" : "Ex: Manutenção Predial"}
              />
            </div>
            
            {dialogType === 'CATEGORIA' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Movimentação</label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={(val) => setFormData({...formData, tipo: val})}
                  // Bloqueia mudança de tipo se estiver criando (força a aba atual) ou se estiver editando (para não quebrar histórico)
                  disabled={!editingItem} 
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada (Receita)</SelectItem>
                    <SelectItem value="saida">Saída (Despesa)</SelectItem>
                  </SelectContent>
                </Select>
                {!editingItem && (
                  <p className="text-[11px] text-muted-foreground">
                    Vinculado à aba atual para evitar erros.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}