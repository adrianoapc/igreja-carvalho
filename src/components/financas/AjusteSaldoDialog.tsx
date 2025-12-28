import { useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AjusteSaldoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: {
    id: string | number;
    nome: string;
    saldo_atual: number;
    observacoes?: string | null;
  };
}

export function AjusteSaldoDialog({ open, onOpenChange, conta }: AjusteSaldoDialogProps) {
  const [valor, setValor] = useState("");
  const [tipoAjuste, setTipoAjuste] = useState<"entrada" | "saida">("entrada");
  const [data, setData] = useState<Date>(new Date());
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const valorNumerico = parseFloat(valor.replace(',', '.')) || 0;
      const novoSaldo = tipoAjuste === "entrada" 
        ? conta.saldo_atual + valorNumerico
        : conta.saldo_atual - valorNumerico;

      const { error } = await supabase
        .from('contas')
        .update({
          saldo_atual: novoSaldo,
          observacoes: conta.observacoes 
            ? `${conta.observacoes}\n\nAjuste ${format(data, 'dd/MM/yyyy', { locale: ptBR })}: ${tipoAjuste === "entrada" ? "+" : "-"}R$ ${valor} - ${descricao}`
            : `Ajuste ${format(data, 'dd/MM/yyyy', { locale: ptBR })}: ${tipoAjuste === "entrada" ? "+" : "-"}R$ ${valor} - ${descricao}`
        })
        .eq('id', String(conta.id));

      if (error) throw error;

      toast.success("Saldo ajustado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['contas-resumo'] });
      onOpenChange(false);
      
      // Reset form
      setValor("");
      setTipoAjuste("entrada");
      setData(new Date());
      setDescricao("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao ajustar saldo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title={`Ajuste de saldo - ${conta?.nome}`}
    >
      <div className="flex flex-col h-full">
        {/* Description */}
        <div className="px-4 pt-2 pb-0 md:px-6">
          <p className="text-sm text-muted-foreground">
            Um ajuste de saldo é necessário sempre que houver uma disparidade significativa entre o saldo contábil e o saldo real da conta.
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
            <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="valor">Valor do ajuste *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="R$ 0,00"
                required
              />
            </div>

            <div>
              <Label htmlFor="tipo">Tipo do ajuste *</Label>
              <Select value={tipoAjuste} onValueChange={(value: "entrada" | "saida") => setTipoAjuste(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (+)</SelectItem>
                  <SelectItem value="saida">Saída (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data do ajuste *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !data && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {data ? format(data, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={data}
                    onSelect={(date) => date && setData(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Digite aqui o motivo do ajuste"
              rows={3}
            />
          </div>
          </div>
          </div>

          {/* Footer */}
          <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-primary">
              {loading ? "Ajustando..." : "Ajustar saldo"}
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveDialog>
  );
}
