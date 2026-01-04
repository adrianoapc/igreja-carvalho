import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

interface CategoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria?: {
    id: string | number;
    nome: string;
    tipo: "entrada" | "saida";
    secao_dre?: string | null;
  };
}

const secoesDRE = [
  { value: "Não faz parte do DRE", label: "Não faz parte do DRE" },
  { value: "Receitas Operacionais", label: "Receitas Operacionais" },
  { value: "Outras receitas não operacionais", label: "Outras receitas não operacionais" },
  { value: "Receitas Financeiras", label: "Receitas Financeiras" },
  { value: "Deduções da receita", label: "Deduções da receita" },
  { value: "Custos Operacionais", label: "Custos Operacionais" },
  { value: "Despesas Operacionais", label: "Despesas Operacionais" },
  { value: "Despesas gerais e administrativas", label: "Despesas gerais e administrativas" },
  { value: "Despesas Financeiras", label: "Despesas Financeiras" },
];

export function CategoriaDialog({ open, onOpenChange, categoria }: CategoriaDialogProps) {
  const [nome, setNome] = useState(categoria?.nome || "");
  const [tipo, setTipo] = useState<"entrada" | "saida">(categoria?.tipo || "entrada");
  const [secaoDre, setSecaoDre] = useState(categoria?.secao_dre || "Não faz parte do DRE");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { igrejaId } = useIgrejaId();
  const { filialId, isAllFiliais } = useFilialId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }
      if (categoria) {
        let updateQuery = supabase
          .from('categorias_financeiras')
          .update({
            nome,
            tipo,
            secao_dre: secaoDre,
          })
          .eq('id', String(categoria.id))
          .eq('igreja_id', igrejaId);
        if (!isAllFiliais && filialId) {
          updateQuery = updateQuery.eq('filial_id', filialId);
        }

        const { error } = await updateQuery;

        if (error) throw error;
        toast.success("Categoria atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('categorias_financeiras')
          .insert({
            nome,
            tipo,
            secao_dre: secaoDre,
            ativo: true,
            igreja_id: igrejaId,
            filial_id: !isAllFiliais ? filialId : null,
          });

        if (error) throw error;
        toast.success("Categoria criada com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ['categorias-financeiras'] });
      onOpenChange(false);
      
      // Reset form
      if (!categoria) {
        setNome("");
        setTipo("entrada");
        setSecaoDre("Não faz parte do DRE");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao salvar categoria");
    } finally {
      setLoading(false);
    }
  };

  const title = categoria ? "Editar Categoria" : "Nova Categoria";

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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Tipo de categoria *</Label>
                <RadioGroup value={tipo} onValueChange={(value: "entrada" | "saida") => setTipo(value)}>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="entrada" id="entrada" />
                      <Label htmlFor="entrada" className="cursor-pointer">Recebimento</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="saida" id="saida" />
                      <Label htmlFor="saida" className="cursor-pointer">Pagamento</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="nome">Nome da categoria *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Doação, Despesas Administrativas"
                  required
                  maxLength={150}
                />
                <p className="text-xs text-muted-foreground mt-1">{nome.length}/150</p>
              </div>

              <div>
                <Label htmlFor="secao-dre">Seção do DRE</Label>
                <Select value={secaoDre} onValueChange={setSecaoDre}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {secoesDRE.map((secao) => (
                      <SelectItem key={secao.value} value={secao.value}>
                        {secao.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  As categorias organizam todo o financeiro da igreja, facilitando acompanhamento e análise.
                </p>
              </div>
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
