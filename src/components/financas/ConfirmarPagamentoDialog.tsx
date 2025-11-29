import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ConfirmarPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacaoId: string;
  tipo: "entrada" | "saida";
}

export function ConfirmarPagamentoDialog({
  open,
  onOpenChange,
  transacaoId,
  tipo,
}: ConfirmarPagamentoDialogProps) {
  const queryClient = useQueryClient();
  const [dataPagamento, setDataPagamento] = useState<Date>(new Date());
  const [juros, setJuros] = useState("");
  const [multas, setMultas] = useState("");
  const [desconto, setDesconto] = useState("");
  const [taxasAdministrativas, setTaxasAdministrativas] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);

      const updateData: any = {
        status: "pago",
        data_pagamento: format(dataPagamento, "yyyy-MM-dd"),
        juros: juros ? parseFloat(juros) : 0,
        multas: multas ? parseFloat(multas) : 0,
        desconto: desconto ? parseFloat(desconto) : 0,
        taxas_administrativas: taxasAdministrativas ? parseFloat(taxasAdministrativas) : 0,
      };

      const { error } = await supabase
        .from("transacoes_financeiras")
        .update(updateData)
        .eq("id", transacaoId);

      if (error) throw error;

      toast.success(tipo === "entrada" ? "Recebimento confirmado" : "Pagamento confirmado");
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao confirmar:", error);
      toast.error("Erro ao confirmar");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDataPagamento(new Date());
    setJuros("");
    setMultas("");
    setDesconto("");
    setTaxasAdministrativas("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Confirmar {tipo === "entrada" ? "Recebimento" : "Pagamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Data de {tipo === "entrada" ? "Recebimento" : "Pagamento"}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataPagamento ? format(dataPagamento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataPagamento}
                  onSelect={(date) => date && setDataPagamento(date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="juros">Juros (R$)</Label>
              <Input
                id="juros"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={juros}
                onChange={(e) => setJuros(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="multas">Multas (R$)</Label>
              <Input
                id="multas"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={multas}
                onChange={(e) => setMultas(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="desconto">Desconto (R$)</Label>
              <Input
                id="desconto"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxas">Taxas Admin (R$)</Label>
              <Input
                id="taxas"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={taxasAdministrativas}
                onChange={(e) => setTaxasAdministrativas(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1"
            disabled={loading}
          >
            {loading ? "Confirmando..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
