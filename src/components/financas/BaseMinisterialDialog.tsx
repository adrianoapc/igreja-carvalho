import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface BaseMinisterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  base?: {
    id: string | number;
    titulo: string;
    descricao?: string | null;
  };
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
          .eq('id', String(base.id));

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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao salvar base ministerial");
    } finally {
      setLoading(false);
    }
  };

  const title = base ? "Editar Base Ministerial" : "Nova Base Ministerial";

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{
        className: "max-w-2xl max-h-[90vh] overflow-hidden flex flex-col",
      }}
      drawerContentProps={{
        className: "max-h-[95vh]",
      }}
    >
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
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
        </div>
      </div>
    </ResponsiveDialog>
  );
}
