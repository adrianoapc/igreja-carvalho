import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

interface TagMidiaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: {
    id: string;
    nome: string;
    cor: string;
  };
  onSuccess: () => void;
}

const CORES_PREDEFINIDAS = [
  { nome: "Azul", valor: "#3B82F6" },
  { nome: "Roxo", valor: "#8B5CF6" },
  { nome: "Rosa", valor: "#EC4899" },
  { nome: "Verde", valor: "#10B981" },
  { nome: "Laranja", valor: "#F59E0B" },
  { nome: "Vermelho", valor: "#EF4444" },
  { nome: "Índigo", valor: "#6366F1" },
  { nome: "Ciano", valor: "#14B8A6" },
  { nome: "Cinza", valor: "#6B7280" },
];

export function TagMidiaDialog({ open, onOpenChange, tag, onSuccess }: TagMidiaDialogProps) {
  const [nome, setNome] = useState(tag?.nome || "");
  const [cor, setCor] = useState(tag?.cor || "#8B5CF6");
  const [saving, setSaving] = useState(false);
  const { igrejaId } = useIgrejaId();
  const { filialId, isAllFiliais } = useFilialId();

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }
      if (tag) {
        // Editar
        let updateQuery = supabase
          .from('tags_midias')
          .update({ nome: nome.trim(), cor })
          .eq('id', tag.id)
          .eq('igreja_id', igrejaId);
        if (!isAllFiliais && filialId) {
          updateQuery = updateQuery.eq('filial_id', filialId);
        }
        const { error } = await updateQuery;

        if (error) throw error;
        toast.success("Tag atualizada com sucesso!");
      } else {
        // Criar
        const { error } = await supabase
          .from('tags_midias')
          .insert({ nome: nome.trim(), cor, igreja_id: igrejaId, filial_id: !isAllFiliais ? filialId : null });

        if (error) throw error;
        toast.success("Tag criada com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      console.error('Erro ao salvar tag:', error);
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao salvar tag");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setNome("");
    setCor("#8B5CF6");
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title={`${tag ? "Editar" : "Nova"} Tag`}
    >
      <div className="flex flex-col h-full">
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Abertura"
              />
            </div>

            <div>
              <Label>Cor</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {CORES_PREDEFINIDAS.map((corPredefinida) => (
                  <button
                    key={corPredefinida.valor}
                    type="button"
                    onClick={() => setCor(corPredefinida.valor)}
                    className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all hover:scale-105 ${
                      cor === corPredefinida.valor 
                        ? 'border-primary shadow-md' 
                        : 'border-transparent hover:border-border'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: corPredefinida.valor }}
                    />
                    <span className="text-xs font-medium">{corPredefinida.nome}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="cor-custom">Cor personalizada:</Label>
              <input
                id="cor-custom"
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">{cor}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
