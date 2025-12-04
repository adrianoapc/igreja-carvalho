import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, CheckCircle2 } from "lucide-react";
import KidsSecurityLabel from "./KidsSecurityLabel";

interface PrintLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crianca: {
    id: string;
    nome: string;
    alergias?: string;
    necessidades_especiais?: string;
  } | null;
  responsavel: {
    nome: string;
    telefone?: string;
  };
  sala: string;
  checkinId: string;
  checkinTime: Date;
}

export default function PrintLabelDialog({
  open,
  onOpenChange,
  crianca,
  responsavel,
  sala,
  checkinId,
  checkinTime,
}: PrintLabelDialogProps) {
  const labelRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  if (!crianca) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            Check-in Realizado!
          </DialogTitle>
          <DialogDescription>
            {crianca.nome} foi registrado(a) na sala {sala}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Criança:</span>
              <span className="font-medium">{crianca.nome}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Responsável:</span>
              <span className="font-medium">{responsavel.nome}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sala:</span>
              <span className="font-medium">{sala}</span>
            </div>
            {(crianca.alergias || crianca.necessidades_especiais) && (
              <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                <span className="text-xs font-medium text-destructive">
                  ⚠️ {crianca.alergias || crianca.necessidades_especiais}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir Etiquetas
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Componente de etiquetas para impressão */}
      <KidsSecurityLabel
        ref={labelRef}
        crianca={crianca}
        responsavel={responsavel}
        sala={sala}
        checkinId={checkinId}
        checkinTime={checkinTime}
      />
    </Dialog>
  );
}
