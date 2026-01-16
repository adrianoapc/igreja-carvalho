import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

interface ContaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta?: {
    id: string | number;
    nome: string;
    tipo: "bancaria" | "fisica" | "virtual";
    saldo_inicial?: number | null;
    banco?: string | null;
    agencia?: string | null;
    conta_numero?: string | null;
    cnpj_banco?: string | null;
    observacoes?: string | null;
  };
}

export function ContaDialog({ open, onOpenChange, conta }: ContaDialogProps) {
  const [nome, setNome] = useState(conta?.nome || "");
  const [tipo, setTipo] = useState<"bancaria" | "fisica" | "virtual">(conta?.tipo || "bancaria");
  const [saldoInicial, setSaldoInicial] = useState(conta?.saldo_inicial?.toString() || "0");
  const [banco, setBanco] = useState(conta?.banco || "");
  const [agencia, setAgencia] = useState(conta?.agencia || "");
  const [contaNumero, setContaNumero] = useState(conta?.conta_numero || "");
  const [cnpjBanco, setCnpjBanco] = useState(conta?.cnpj_banco || "");
  const [observacoes, setObservacoes] = useState(conta?.observacoes || "");
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
      const saldoValue = parseFloat(saldoInicial.replace(',', '.')) || 0;

      if (conta) {
        let updateQuery = supabase
          .from('contas')
          .update({
            nome,
            tipo,
            banco: tipo === 'bancaria' ? banco : null,
            agencia: tipo === 'bancaria' ? agencia : null,
            conta_numero: tipo === 'bancaria' ? contaNumero : null,
            cnpj_banco: tipo === 'bancaria' ? cnpjBanco : null,
            observacoes,
          })
          .eq('id', String(conta.id))
          .eq('igreja_id', igrejaId);
        if (!isAllFiliais && filialId) {
          updateQuery = updateQuery.eq('filial_id', filialId);
        }

        const { error } = await updateQuery;

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
            cnpj_banco: tipo === 'bancaria' ? cnpjBanco : null,
            observacoes,
            ativo: true,
            igreja_id: igrejaId,
            filial_id: !isAllFiliais ? filialId : null,
          });

        if (error) throw error;
        toast.success("Conta criada com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['contas-resumo'] });
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao salvar conta");
    } finally {
      setLoading(false);
    }
  };

  const title = conta ? "Editar Conta" : "Nova Conta";

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
              <Label className="text-sm font-medium mb-2 block">Tipo de conta *</Label>
              <RadioGroup value={tipo} onValueChange={(value: "bancaria" | "fisica" | "virtual") => setTipo(value)}>
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

                <div>
                  <Label htmlFor="cnpj-banco">CNPJ do Banco (para integrações)</Label>
                  <Input
                    id="cnpj-banco"
                    value={cnpjBanco}
                    onChange={(e) => setCnpjBanco(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex: 90400888000142 (Santander)"
                    maxLength={14}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado para conectar com APIs bancárias
                  </p>
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
        </div>
      </div>
    </ResponsiveDialog>
  );
}
