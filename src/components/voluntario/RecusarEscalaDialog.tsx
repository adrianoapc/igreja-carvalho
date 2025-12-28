import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface Escala {
  id: string;
  culto: {
    titulo: string;
    data_evento: string;
  };
  time: {
    nome: string;
  };
}

interface RecusarEscalaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string) => void;
  escala: Escala | null;
}

export function RecusarEscalaDialog({
  open,
  onOpenChange,
  onConfirm,
  escala,
}: RecusarEscalaDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!motivo.trim()) return;
    
    setLoading(true);
    await onConfirm(motivo);
    setLoading(false);
    setMotivo("");
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setMotivo("");
    }
    onOpenChange(open);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Recusar Escala</h2>
          {escala && (
            <p className="text-sm text-muted-foreground mt-1">
              Escala de <strong>{escala.time.nome}</strong> para <strong>{escala.culto.titulo}</strong> em{" "}
              {format(new Date(escala.culto.data_evento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da recusa *</Label>
            <Textarea
              id="motivo"
              placeholder="Por favor, informe o motivo pelo qual não poderá participar..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              O líder do ministério será notificado para encontrar um substituto.
            </p>
          </div>
          </div>
        </div>

        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2 justify-end">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={!motivo.trim() || loading}
          >
            {loading ? "Enviando..." : "Confirmar Recusa"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
