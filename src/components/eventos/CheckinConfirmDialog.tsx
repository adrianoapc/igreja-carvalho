import { Button } from "@/components/ui/button";
import { User, Mail, Phone, IdCard, CheckCircle2, XCircle } from "lucide-react";

interface Pessoa {
  id?: string;
  nome?: string;
  email?: string;
  telefone?: string;
}

interface Evento {
  id?: string;
  titulo?: string;
}

interface CheckinConfirmDialogProps {
  pessoa?: Pessoa | null;
  evento?: Evento | null;
  onConfirm: () => void;
  onReject: () => void;
  onCancel: () => void;
}

export function CheckinConfirmDialog({
  pessoa,
  evento,
  onConfirm,
  onReject,
  onCancel,
}: CheckinConfirmDialogProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
          <IdCard className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold">Verificar Identidade</h2>
        <p className="text-sm text-muted-foreground">
          Confira os dados abaixo com o documento do participante
        </p>
      </div>

      {/* Dados do Participante */}
      <div className="bg-muted/30 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <User className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Nome</p>
            <p className="text-lg font-semibold">{pessoa?.nome || "—"}</p>
          </div>
        </div>

        {pessoa?.email && (
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
              <p className="text-sm">{pessoa.email}</p>
            </div>
          </div>
        )}

        {pessoa?.telefone && (
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Telefone</p>
              <p className="text-sm">{pessoa.telefone}</p>
            </div>
          </div>
        )}
      </div>

      {/* Evento */}
      {evento?.titulo && (
        <p className="text-center text-sm text-muted-foreground">
          Evento: <span className="font-medium text-foreground">{evento.titulo}</span>
        </p>
      )}

      {/* Instruções */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
        <p className="font-medium mb-1">📋 Solicite um documento com foto</p>
        <p className="text-xs opacity-80">
          Verifique se o nome e a foto correspondem ao documento apresentado.
        </p>
      </div>

      {/* Ações */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={onReject}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Recusar
        </Button>
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={onConfirm}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Confirmar
        </Button>
      </div>

      <Button
        variant="ghost"
        className="w-full text-muted-foreground"
        onClick={onCancel}
      >
        Cancelar e voltar ao scanner
      </Button>
    </div>
  );
}
