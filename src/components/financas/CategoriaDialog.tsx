import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface CategoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria?: any;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (categoria) {
        const { error } = await supabase
          .from('categorias_financeiras')
          .update({
            nome,
            tipo,
            secao_dre: secaoDre,
          })
          .eq('id', categoria.id);

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
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar categoria");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Tipo de categoria *</Label>
              <RadioGroup value={tipo} onValueChange={(value: any) => setTipo(value)}>
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
      </DialogContent>
    </Dialog>
  );
}
