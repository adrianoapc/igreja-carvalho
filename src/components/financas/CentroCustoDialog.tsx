import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

interface CentroCustoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centro?: {
    id: string | number;
    nome: string;
    descricao?: string | null;
    base_ministerial_id?: string | null;
  };
}

export function CentroCustoDialog({ open, onOpenChange, centro }: CentroCustoDialogProps) {
  const [nome, setNome] = useState(centro?.nome || "");
  const [descricao, setDescricao] = useState(centro?.descricao || "");
  const [baseMinisterialId, setBaseMinisterialId] = useState(centro?.base_ministerial_id || "");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();

  const { data: bases } = useQuery({
    queryKey: ['bases-ministeriais-select', igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from('bases_ministeriais')
        .select('id, titulo')
        .eq('ativo', true)
        .eq('igreja_id', igrejaId)
        .order('titulo');
      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId);
      }
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }
      if (centro) {
        let updateQuery = supabase
          .from('centros_custo')
          .update({
            nome,
            descricao,
            base_ministerial_id: baseMinisterialId || null,
          })
          .eq('id', String(centro.id))
          .eq('igreja_id', igrejaId);
        if (!isAllFiliais && filialId) {
          updateQuery = updateQuery.eq('filial_id', filialId);
        }

        const { error } = await updateQuery;

        if (error) throw error;
        toast.success("Centro de custo atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from('centros_custo')
          .insert({
            nome,
            descricao,
            base_ministerial_id: baseMinisterialId || null,
            ativo: true,
            igreja_id: igrejaId,
            filial_id: !isAllFiliais ? filialId : null,
          });

        if (error) throw error;
        toast.success("Centro de custo criado com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ['centros-custo'] });
      onOpenChange(false);
      
      if (!centro) {
        setNome("");
        setDescricao("");
        setBaseMinisterialId("");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao salvar centro de custo");
    } finally {
      setLoading(false);
    }
  };

  const title = centro ? "Editar Centro de Custo" : "Novo Centro de Custo";

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
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Ministério Infantil, Mídia"
                required
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva este centro de custo"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="base">Base Ministerial</Label>
              <Select value={baseMinisterialId} onValueChange={setBaseMinisterialId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {bases?.map((base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
