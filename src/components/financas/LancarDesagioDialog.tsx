import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilialId } from "@/hooks/useFilialId";
import { useHideValues } from "@/hooks/useHideValues";
import { lancarDesagioAntecipacao } from "@/features/financeiro/core/api/getnetRecebivel.api";
import { calcularDesagio, type LoteAntecipacao } from "@/features/financeiro/core/hooks/useLotesAntecipacao";
import { Loader2, TrendingDown } from "lucide-react";

interface LancarDesagioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lote: LoteAntecipacao;
  onLancado: () => void;
}

export function LancarDesagioDialog({ open, onOpenChange, lote, onLancado }: LancarDesagioDialogProps) {
  const { formatValue } = useHideValues();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [contaId, setContaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [loading, setLoading] = useState(false);

  const desagio = calcularDesagio(lote) ?? 0;

  // Filial efetiva do fluxo é a do extrato JÁ VINCULADO ao lote — não a do
  // lote em si. Espelha fin_lancar_desagio_antecipacao (20260731110000) à
  // risca: o backend só olha extrato.filial_id, nunca lote.filial_id.
  // Cair pra lote.filial_id aqui (versão anterior) divergia do backend numa
  // situação real: getnet_antecipacao_lotes.filial_id não tem FK (diferente
  // de extratos_bancarios/contas, que têm ON DELETE SET NULL) — deletar uma
  // filial depois do vínculo zera o filial_id do extrato/contas mas deixa o
  // do lote como UUID solto; usá-lo aqui filtraria contas por um valor que
  // não bate com nenhuma (dropdown vazio), mesmo o backend aceitando
  // qualquer conta nesse caso (achado do /code-review).
  const filialEfetivaLote = lote.extratos_bancarios?.filial_id ?? null;

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-desagio", igrejaId, filialId, isAllFiliais, filialEfetivaLote],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase.from("contas").select("id, nome").eq("ativo", true).eq("igreja_id", igrejaId).order("nome");
      if (filialEfetivaLote) {
        query = query.eq("filial_id", filialEfetivaLote);
      } else if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && !!igrejaId,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-saida-desagio", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("tipo", "saida")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: open && !!igrejaId,
  });

  const handleLancar = async () => {
    if (!contaId || !categoriaId) {
      toast.error("Selecione conta e categoria");
      return;
    }
    setLoading(true);
    try {
      await lancarDesagioAntecipacao(lote.id, categoriaId, contaId);
      toast.success("Deságio lançado como saída");
      onLancado();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao lançar deságio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={null}
      dialogContentProps={{ className: "max-w-md" }}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-destructive" />
          <h2 className="text-lg font-semibold">Lançar Deságio como Saída</h2>
        </div>

        <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
          <p className="text-xs text-muted-foreground">Contrato {lote.contrato_registradora}</p>
          <p className="text-sm">
            Valor do contrato: <span className="font-medium">{formatValue(lote.valor_atual_contrato ?? 0)}</span>
          </p>
          <p className="text-sm">
            Creditado no banco:{" "}
            <span className="font-medium">{formatValue(lote.extratos_bancarios?.valor ?? 0)}</span>
          </p>
          <p className="text-sm font-bold text-destructive">Deságio: {formatValue(desagio)}</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label>Conta *</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria (saída) *</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categorias.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Nenhuma categoria de saída cadastrada — crie uma (ex. "Custo de Antecipação de Recebíveis") na tela
                de categorias antes de lançar.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleLancar} disabled={loading || !contaId || !categoriaId} variant="destructive">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Lançar Saída
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
