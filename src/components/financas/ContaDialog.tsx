import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ContaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta?: any;
}

export function ContaDialog({ open, onOpenChange, conta }: ContaDialogProps) {
  const [nome, setNome] = useState(conta?.nome || "");
  const [tipo, setTipo] = useState<"bancaria" | "fisica" | "virtual">(conta?.tipo || "bancaria");
  const [saldoInicial, setSaldoInicial] = useState(conta?.saldo_inicial?.toString() || "0");
  const [banco, setBanco] = useState(conta?.banco || "");
  const [agencia, setAgencia] = useState(conta?.agencia || "");
  const [contaNumero, setContaNumero] = useState(conta?.conta_numero || "");
  const [observacoes, setObservacoes] = useState(conta?.observacoes || "");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const saldoValue = parseFloat(saldoInicial.replace(',', '.')) || 0;

      if (conta) {
        const { error } = await supabase
          .from('contas')
          .update({
            nome,
            tipo,
            banco: tipo === 'bancaria' ? banco : null,
            agencia: tipo === 'bancaria' ? agencia : null,
            conta_numero: tipo === 'bancaria' ? contaNumero : null,
            observacoes,
          })
          .eq('id', conta.id);

        if (error) throw error;
        toast.success("Conta atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('contas')
          .insert({
            nome,
            tipo,
            saldo_inicial: saldoValue,
            saldo_atual: saldoValue,
            banco: tipo === 'bancaria' ? banco : null,
            agencia: tipo === 'bancaria' ? agencia : null,
            conta_numero: tipo === 'bancaria' ? contaNumero : null,
            observacoes,
            ativo: true,
          });

        if (error) throw error;
        toast.success("Conta criada com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['contas-resumo'] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{conta ? "Editar Conta" : "Nova Conta"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Tipo de conta *</Label>
              <RadioGroup value={tipo} onValueChange={(value: any) => setTipo(value)}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bancaria" id="bancaria" />
                    <Label htmlFor="bancaria" className="cursor-pointer">Bancária</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fisica" id="fisica" />
                    <Label htmlFor="fisica" className="cursor-pointer">Física (Caixa)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="virtual" id="virtual" />
                    <Label htmlFor="virtual" className="cursor-pointer">Virtual</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="nome">Nome da conta *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Caixa Geral, Banco do Brasil"
                required
              />
            </div>

            {!conta && (
              <div>
                <Label htmlFor="saldo-inicial">Saldo inicial</Label>
                <Input
                  id="saldo-inicial"
                  type="number"
                  step="0.01"
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            )}

            {tipo === 'bancaria' && (
              <>
                <div>
                  <Label htmlFor="banco">Banco</Label>
                  <Input
                    id="banco"
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    placeholder="Ex: Banco do Brasil, Santander"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="agencia">Agência</Label>
                    <Input
                      id="agencia"
                      value={agencia}
                      onChange={(e) => setAgencia(e.target.value)}
                      placeholder="0000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="conta">Conta</Label>
                    <Input
                      id="conta"
                      value={contaNumero}
                      onChange={(e) => setContaNumero(e.target.value)}
                      placeholder="00000-0"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais sobre a conta"
                rows={3}
              />
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
