import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Save } from "lucide-react";

type ValoresPorTipo = {
  oferta: number;
  dizimo: number;
  missoes: number;
};

export function MinhaContagemDialog({
  open,
  onOpenChange,
  defaultValores,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultValores?: Partial<ValoresPorTipo>;
  onSubmit: (valores: ValoresPorTipo) => Promise<void> | void;
  loading?: boolean;
}) {
  const [oferta, setOferta] = useState<string>(
    String(defaultValores?.oferta ?? "")
  );
  const [dizimo, setDizimo] = useState<string>(
    String(defaultValores?.dizimo ?? "")
  );
  const [missoes, setMissoes] = useState<string>(
    String(defaultValores?.missoes ?? "")
  );

  const parse = (v: string) => {
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const total = parse(oferta) + parse(dizimo) + parse(missoes);

  const handleConfirm = async () => {
    await onSubmit({ oferta: parse(oferta), dizimo: parse(dizimo), missoes: parse(missoes) });
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Minha Contagem</h2>
          <p className="text-sm text-muted-foreground">Informe os totais que você contou.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Oferta</Label>
              <Input value={oferta} onChange={(e) => setOferta(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Dízimo</Label>
              <Input value={dizimo} onChange={(e) => setDizimo(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Missões</Label>
              <Input value={missoes} onChange={(e) => setMissoes(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-3 bg-muted/50 rounded">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 border-t bg-muted/50 px-4 py-3 md:px-6">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={loading} className="w-full sm:w-auto bg-gradient-primary">
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Enviando..." : "Salvar Contagem"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
