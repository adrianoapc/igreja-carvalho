import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface SubcategoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoriaId: string;
  categoriaNome: string;
  subcategoria?: {
    id: string | number;
    nome: string;
  };
}

export function SubcategoriaDialog({ 
  open, 
  onOpenChange, 
  categoriaId, 
  categoriaNome,
  subcategoria 
}: SubcategoriaDialogProps) {
  const [nome, setNome] = useState(subcategoria?.nome || "");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (subcategoria) {
        const { error } = await supabase
          .from('subcategorias_financeiras')
          .update({ nome })
          .eq('id', subcategoria.id);

        if (error) throw error;
        toast.success("Subcategoria atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('subcategorias_financeiras')
          .insert({
            nome,
            categoria_id: categoriaId,
            ativo: true,
          });

        if (error) throw error;
        toast.success("Subcategoria criada com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ['categorias-financeiras'] });
      onOpenChange(false);
      
      if (!subcategoria) {
        setNome("");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao salvar subcategoria");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{
        className: "max-w-lg max-h-[90vh] overflow-hidden flex flex-col",
      }}
      drawerContentProps={{
        className: "max-h-[95vh]",
      }}
    >
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            {subcategoria ? "Editar Subcategoria" : "Nova Subcategoria"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Categoria: {categoriaNome}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome da subcategoria *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Aluguel, Gratificações, Energia Elétrica"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-gradient-primary">
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
