import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BaseMinisterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  base?: any;
}

export function BaseMinisterialDialog({ open, onOpenChange, base }: BaseMinisterialDialogProps) {
  const [titulo, setTitulo] = useState(base?.titulo || "");
  const [descricao, setDescricao] = useState(base?.descricao || "");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (base) {
        const { error } = await supabase
          .from('bases_ministeriais')
          .update({ titulo, descricao })
          .eq('id', base.id);

        if (error) throw error;
        toast.success("Base ministerial atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('bases_ministeriais')
          .insert({
            titulo,
            descricao,
            ativo: true,
          });

        if (error) throw error;
        toast.success("Base ministerial criada com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ['bases-ministeriais'] });
      onOpenChange(false);
      
      if (!base) {
        setTitulo("");
        setDescricao("");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar base ministerial");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {base ? "Editar Base Ministerial" : "Nova Base Ministerial"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Base de Evangelismo"
              required
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Ministério Base de Evangelismo"
              rows={3}
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
