import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  ChevronRight,
  ChevronDown,
  FolderTree,
  CornerDownRight,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
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

interface CategoriasProps {
  onBack?: () => void;
}

export default function Categorias({ onBack }: CategoriasProps = {}) {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("saida");

  // Dialog States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"CATEGORIA" | "SUBCATEGORIA">("CATEGORIA");
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
      const { data: cats, error: errCat } = await supabase.from("categorias_financeiras").select("*").order("nome");
      if (errCat) throw errCat;

      const { data: subs, error: errSub } = await supabase.from("subcategorias_financeiras").select("*").order("nome");
      if (errSub) throw errSub;

      const tree =
        cats?.map((cat: any) => ({
          ...cat,
          tipo_normalizado: cat.tipo ? cat.tipo.toLowerCase() : "desconhecido",
          subcategorias: subs?.filter((s: any) => s.categoria_id === cat.id) || [],
        })) || [];

      setCategorias(tree);

      if (tree.length < 15) {
        setExpandedCats(new Set(tree.map((curr: any) => curr.id)));
      }
    } catch (error: any) {
      console.error("Erro fetch:", error);
      toast.error("Erro ao carregar dados", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (catId: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const matchesSearch = (categoria: Categoria) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      categoria.nome?.toLowerCase().includes(term) ||
      categoria.subcategorias?.some((sub) => sub.nome?.toLowerCase().includes(term))
    );
  };

  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) return;
    const matchedIds = categorias.filter(matchesSearch).map((cat) => cat.id);
    setExpandedCats(new Set(matchedIds));
  }, [searchTerm, categorias]);

  // --- HANDLERS ---

  const handleSave = async () => {
    if (!formData.nome.trim()) return toast.error("Nome obrigatório");

    setSaving(true);
    try {
      if (dialogType === "CATEGORIA") {
        const payload = { nome: formData.nome, tipo: formData.tipo, ativo: true };

        if (editingItem) {
          const { error } = await supabase.from("categorias_financeiras").update(payload).eq("id", editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("categorias_financeiras").insert([payload]);
          if (error) throw error;
        }
      } else {
        const payload = { nome: formData.nome, categoria_id: parentId, ativo: true };

        if (editingItem) {
          const { error } = await supabase.from("subcategorias_financeiras").update({ nome: formData.nome }).eq("id", editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("subcategorias_financeiras").insert([payload]);
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

  const deleteItem = async (id: string, type: "CATEGORIA" | "SUBCATEGORIA") => {
    if (!confirm("Excluir item?")) return;
    try {
      const table = type === "CATEGORIA" ? "categorias_financeiras" : "subcategorias_financeiras";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Item excluído");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir", { description: error.message });
    }
  };

  // --- DIALOGS ---

  const openNewCategory = () => {
    setDialogType("CATEGORIA");
    setEditingItem(null);
    setParentId(null);
    setFormData({ nome: "", tipo: activeTab });
    setDialogOpen(true);
  };

  const openNewSub = (catId: string, tipoPai: string) => {
    setDialogType("SUBCATEGORIA");
    setEditingItem(null);
    setParentId(catId);
    setFormData({ nome: "", tipo: tipoPai });
    setDialogOpen(true);
  };

  const openEdit = (item: any, type: "CATEGORIA" | "SUBCATEGORIA") => {
    setDialogType(type);
    setEditingItem(item);
    setFormData({ nome: item.nome, tipo: item.tipo ? item.tipo.toLowerCase() : activeTab });
    setDialogOpen(true);
  };

  // --- RENDER DA LISTA ---
  const getFilteredTree = (tipoFiltro: string) => categorias.filter((c: any) => c.tipo_normalizado === tipoFiltro).filter(matchesSearch);

  const renderAccordionList = (tipoFiltro: string, isMobile = false) => {
    const filteredTree = getFilteredTree(tipoFiltro);

    if (filteredTree.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <AlertCircle className="h-8 w-8 opacity-20" />
          <p>Nenhuma categoria de {tipoFiltro === "entrada" ? "entrada" : "saída"} encontrada.</p>
        </div>
      );
    }

    return (
      <div className="divide-y border-border/60">
        {filteredTree.map((cat) => {
          const isExpanded = expandedCats.has(cat.id) || !!searchTerm.trim();
          const subcategorias = cat.subcategorias || [];

          return (
            <div key={cat.id} className="group bg-card">
              <button
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted/50",
                  isMobile && "px-3 py-3"
                )}
                onClick={() => toggleExpand(cat.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderTree className={cn("h-4 w-4 flex-shrink-0", cat.tipo === "entrada" ? "text-green-600" : "text-red-600")} />
                    <span className="font-medium truncate">{cat.nome}</span>
                    <Badge variant="secondary" className="text-[11px] font-normal px-2 py-0 h-5">
                      {subcategorias.length} sub
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size={isMobile ? "sm" : "icon"}
                    className={cn("h-8", !isMobile && "w-8")}
                    onClick={(e) => {
                      e.stopPropagation();
                      openNewSub(cat.id, cat.tipo);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size={isMobile ? "sm" : "icon"}
                    className={cn("h-8", !isMobile && "w-8")}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(cat, "CATEGORIA");
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size={isMobile ? "sm" : "icon"}
                    className={cn("h-8 text-destructive", !isMobile && "w-8")}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(cat.id, "CATEGORIA");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </button>

              {isExpanded && (
                <div className={cn("bg-muted/40 px-4 pb-4 pt-2 space-y-2", isMobile && "px-3 pb-3")}>                  {subcategorias.length ? (
                    subcategorias.map((sub: any) => (
                      <div key={sub.id} className="flex items-center justify-between rounded-lg bg-background border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <CornerDownRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{sub.nome}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sub, "SUBCATEGORIA")}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteItem(sub.id, "SUBCATEGORIA")}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma subcategoria cadastrada.</p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="secondary" size="sm" onClick={() => openNewSub(cat.id, cat.tipo)}>
                      <Plus className="h-3 w-3 mr-1" /> Nova subcategoria
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(cat, "CATEGORIA")}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar categoria
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        Carregando plano de contas...
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => onBack ? onBack() : navigate("/financas")} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-semibold tracking-tight">Plano de Contas</h2>
            <p className="text-sm text-muted-foreground">Categorização de receitas e despesas.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end w-full md:w-auto">
          <Button variant="ghost" size="sm" onClick={fetchData} className="text-xs">
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>
          <Button onClick={openNewCategory} size="sm" className="text-xs">
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
        </div>
      </div>

      <Tabs defaultValue="saida" value={activeTab} onValueChange={setActiveTab} className="w-full space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="entrada" className="gap-2">
              <ArrowUpCircle className="h-4 w-4 text-green-600" />
              Entradas
            </TabsTrigger>
            <TabsTrigger value="saida" className="gap-2">
              <ArrowDownCircle className="h-4 w-4 text-red-600" />
              Saídas
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        <TabsContent value="entrada" className="m-0 border-none p-0 space-y-3">
          <Card className="border shadow-sm overflow-hidden min-h-[300px] hidden md:block">
            {renderAccordionList("entrada")}
          </Card>
          <div className="md:hidden">
            {renderAccordionList("entrada", true)}
          </div>
        </TabsContent>

        <TabsContent value="saida" className="m-0 border-none p-0 space-y-3">
          <Card className="border shadow-sm overflow-hidden min-h-[300px] hidden md:block">
            {renderAccordionList("saida")}
          </Card>
          <div className="md:hidden">
            {renderAccordionList("saida", true)}
          </div>
        </TabsContent>
      </Tabs>

      <ResponsiveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dialogContentProps={{ className: "sm:max-w-[480px]" }}
        drawerContentProps={{ className: "max-h-[90vh]" }}
      >
        <div className="p-4 sm:p-6 space-y-4">
          <DialogTitle className="text-base font-semibold">
            {editingItem ? "Editar" : "Nova"} {dialogType === "CATEGORIA" ? "Categoria" : "Subcategoria"}
          </DialogTitle>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder={dialogType === "CATEGORIA" ? "Ex: Dízimos, Aluguel" : "Ex: Manutenção Predial"}
              />
            </div>

            {dialogType === "CATEGORIA" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Movimentação</label>
                <Select value={formData.tipo} onValueChange={(val) => setFormData({ ...formData, tipo: val })} disabled={!editingItem}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada (Receita)</SelectItem>
                    <SelectItem value="saida">Saída (Despesa)</SelectItem>
                  </SelectContent>
                </Select>
                {!editingItem && (
                  <p className="text-[11px] text-muted-foreground">Vinculado à aba atual para evitar erros.</p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
