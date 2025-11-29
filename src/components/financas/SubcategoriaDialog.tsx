import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SubcategoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoriaId: string;
  categoriaNome: string;
  subcategoria?: any;
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
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar subcategoria");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {subcategoria ? "Editar Subcategoria" : "Nova Subcategoria"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Categoria: {categoriaNome}
          </p>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
