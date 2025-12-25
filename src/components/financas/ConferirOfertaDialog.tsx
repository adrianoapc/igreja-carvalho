import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import * as React from "react";

interface DadosOferta {
  dataCulto: Date;
  valores: Record<string, { nome: string; valor: number }>;
  total: number;
  lancadoPor: string;
  conferente: string;
}

interface ConferirOfertaDialogProps {
  dados: DadosOferta;
  onConfirmar: () => void;
  onRejeitar: () => void;
  loading: boolean;
}

export function ConferirOfertaDialog({
  dados,
  onConfirmar,
  onRejeitar,
  loading,
}: ConferirOfertaDialogProps) {
  const [open, setOpen] = React.useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
      >
        Conferir
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <div className="flex flex-col h-full">
          <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
            <h2 className="text-lg font-semibold leading-none tracking-tight">Conferência de Oferta</h2>
            <p className="text-sm text-muted-foreground">Revise os valores e confirme o lançamento</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data do Culto:</span>
                <span className="font-medium">{formatDate(dados.dataCulto)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lançado por:</span>
                <span className="font-medium">{dados.lancadoPor}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Conferente:</span>
                <span className="font-medium">{dados.conferente}</span>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Valores por Forma de Pagamento:</p>
              <div className="space-y-2">
                {Object.entries(dados.valores).map(([id, { nome, valor }]) => (
                  <div key={id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{nome}:</span>
                    <span className="font-medium">{formatCurrency(valor)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold">Total:</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(dados.total)}
                </span>
              </div>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground text-center">
                Como conferente, você está validando que os valores acima estão corretos.
                Ao confirmar, o relatório será salvo definitivamente.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 border-t bg-muted/50 px-4 py-3 md:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onRejeitar();
                setOpen(false);
              }}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Rejeitar
            </Button>
            <Button
              type="button"
              onClick={() => {
                onConfirmar();
                setOpen(false);
              }}
              disabled={loading}
              className="w-full sm:w-auto bg-gradient-primary"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {loading ? 'Confirmando...' : 'Confirmar Valores'}
            </Button>
          </div>
          </div>
        </div>
      </ResponsiveDialog>
    </>
  );
}
