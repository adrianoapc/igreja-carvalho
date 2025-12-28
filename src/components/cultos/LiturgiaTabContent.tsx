import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LiturgiaTimeline from "./LiturgiaTimeline";
import LiturgiaWorkspace from "./LiturgiaWorkspace";
import { AplicarLiturgiaTemplateDialog } from "./AplicarLiturgiaTemplateDialog";
import { SalvarLiturgiaTemplateDialog } from "./SalvarLiturgiaTemplateDialog";
import { LiturgiaItemDialog } from "./LiturgiaItemDialog";

interface ItemLiturgia {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  duracao_minutos: number | null;
  responsavel_id: string | null;
  responsavel_externo: string | null;
  permite_multiplo?: boolean;
  responsavel?: {
    nome: string;
  };
}

interface Membro {
  id: string;
  nome: string;
}

interface LiturgiaTabContentProps {
  eventoId: string;
}

export default function LiturgiaTabContent({ eventoId }: LiturgiaTabContentProps) {
  const [itens, setItens] = useState<ItemLiturgia[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemLiturgia | null>(null);
  const [recursosCount, setRecursosCount] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadItens(), loadMembros(), loadRecursosCount()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [eventoId]);

  const loadItens = async () => {
    try {
      const { data, error } = await supabase
        .from("liturgias")
        .select(`
          *,
          responsavel:profiles!responsavel_id(nome)
        `)
        .eq("evento_id", eventoId)
        .order("ordem", { ascending: true });

      if (error) throw error;
      setItens(data || []);
      
      // Atualizar seleção se item ainda existe
      if (selectedItem) {
        const stillExists = data?.find(i => i.id === selectedItem.id);
        if (stillExists) {
          setSelectedItem(stillExists);
        } else {
          setSelectedItem(null);
        }
      }
    } catch (error: unknown) {
      toast.error("Erro ao carregar liturgia", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const loadMembros = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("status", "membro")
        .order("nome", { ascending: true });

      if (error) throw error;
      setMembros(data || []);
    } catch (error: unknown) {
      console.error("Erro ao carregar membros:", error instanceof Error ? error.message : String(error));
    }
  };

  const loadRecursosCount = async () => {
    try {
      const { data: itensData } = await supabase
        .from("liturgias")
        .select("id")
        .eq("evento_id", eventoId);

      if (!itensData || itensData.length === 0) return;

      const itensIds = itensData.map(i => i.id);

      const { data, error } = await supabase
        .from("liturgia_recursos")
        .select("liturgia_item_id")
        .in("liturgia_item_id", itensIds);

      if (error) throw error;

      const countMap = new Map<string, number>();
      (data || []).forEach(r => {
        countMap.set(r.liturgia_item_id, (countMap.get(r.liturgia_item_id) || 0) + 1);
      });
      
      setRecursosCount(countMap);
    } catch (error: unknown) {
      console.error("Erro ao carregar contagem de recursos:", error instanceof Error ? error.message : String(error));
    }
  };

  const handleReorder = async (newItens: ItemLiturgia[]) => {
    setItens(newItens);
    
    try {
      for (const item of newItens) {
        const { error } = await supabase
          .from("liturgias")
          .update({ ordem: item.ordem })
          .eq("id", item.id);
        
        if (error) throw error;
      }
    } catch (error: unknown) {
      toast.error("Erro ao reordenar", { description: error instanceof Error ? error.message : String(error) });
      await loadItens();
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Deseja remover este item da liturgia?")) return;

    try {
      // Primeiro remove os recursos associados
      await supabase
        .from("liturgia_recursos")
        .delete()
        .eq("liturgia_item_id", id);

      // Depois remove o item
      const { error } = await supabase
        .from("liturgias")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Item removido!");
      setSelectedItem(null);
      await loadData();
    } catch (error: unknown) {
      toast.error("Erro ao remover item", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleTemplateApplied = () => {
    setShowTemplateDialog(false);
    loadData();
  };

  const handleItemAdded = () => {
    setShowAddDialog(false);
    loadData();
  };

  if (loading) {
    return (
      <div className="h-[500px] flex items-center justify-center">
        <div className="text-muted-foreground">Carregando liturgia...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-280px)] min-h-[500px]">
      <div className="grid grid-cols-12 gap-4 h-full">
        {/* Timeline Column */}
        <div className="col-span-12 md:col-span-4 h-full overflow-hidden bg-muted/30 rounded-lg p-4">
          <LiturgiaTimeline
            itens={itens}
            selectedItemId={selectedItem?.id || null}
            recursosCount={recursosCount}
            onSelectItem={setSelectedItem}
            onReorder={handleReorder}
            onAddItem={() => setShowAddDialog(true)}
            onApplyTemplate={() => setShowTemplateDialog(true)}
            onSaveTemplate={() => setShowSaveTemplateDialog(true)}
          />
        </div>

        {/* Workspace Column */}
        <div className="col-span-12 md:col-span-8 h-full overflow-hidden bg-card rounded-lg border p-4">
          <LiturgiaWorkspace
            item={selectedItem}
            membros={membros}
            onSave={() => loadData()}
            onDelete={handleDeleteItem}
          />
        </div>
      </div>

      {/* Dialogs */}
      <AplicarLiturgiaTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        eventoId={eventoId}
        onSuccess={handleTemplateApplied}
      />

      <SalvarLiturgiaTemplateDialog
        open={showSaveTemplateDialog}
        onOpenChange={setShowSaveTemplateDialog}
        eventoId={eventoId}
      />

      <LiturgiaItemDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        eventoId={eventoId}
        membros={membros}
        onSaved={handleItemAdded}
      />
    </div>
  );
}
