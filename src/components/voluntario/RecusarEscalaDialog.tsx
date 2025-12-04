import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Escala {
  id: string;
  culto: {
    titulo: string;
    data_culto: string;
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar Escala</DialogTitle>
          <DialogDescription>
            {escala && (
              <>
                Você está recusando a escala de <strong>{escala.time.nome}</strong> para{" "}
                <strong>{escala.culto.titulo}</strong> em{" "}
                {format(new Date(escala.culto.data_culto), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
