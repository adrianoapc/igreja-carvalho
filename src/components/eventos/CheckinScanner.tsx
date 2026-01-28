import { useState, useCallback } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckinResultFeedback } from "./CheckinResultFeedback";
import { CheckinConfirmDialog } from "./CheckinConfirmDialog";
import { Camera, X, RefreshCw } from "lucide-react";
import { extractEdgeFunctionPayload } from "./edgeFunctionPayload";

interface CheckinScannerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  eventoId: string; // Garantir que o QR pertence ao evento atual
}

type FeedbackState = {
  type: "success" | "error" | "already_used" | "pending_payment";
  personName?: string;
  eventName?: string;
  message?: string;
} | null;

type ScanStage = "scanning" | "confirming" | "feedback";

interface PendingCheckinData {
  pessoa?: { id?: string; nome?: string; email?: string; telefone?: string } | null;
  evento?: { id?: string; titulo?: string } | null;
}

const extractToken = (input: string): string | null => {
  const cleaned = input.trim();

  const urlMatch =
    cleaned.match(/\/inscricao\/([a-f0-9-]+)/i) ||
    cleaned.match(/\/checkin\/([a-f0-9-]+)/i);

  if (urlMatch) {
    return urlMatch[1];
  }

  const uuidMatch = cleaned.match(
    /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i
  );

  if (uuidMatch) {
    return uuidMatch[1];
  }

  return null;
};

export function CheckinScanner({ open, onClose, onSuccess, eventoId }: CheckinScannerProps) {
  const [stage, setStage] = useState<ScanStage>("scanning");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [pendingData, setPendingData] = useState<PendingCheckinData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const checkinMutation = useMutation({
    mutationFn: async (qrToken: string) => {
      try {
        console.log('[CheckinScanner] Iniciando checkin com token:', qrToken);
        const { data, error } = await supabase.functions.invoke(
          "checkin-inscricao",
          {
            body: { qr_token: qrToken, contexto_evento_id: eventoId },
          }
        );

        console.log('[CheckinScanner] Response:', { data, error });

        const payload = extractEdgeFunctionPayload(data, error);
        if (payload) return payload;
        if (error) throw new Error(error.message || 'Erro na resposta do servidor');
        return data;
      } catch (err) {
        console.error('[CheckinScanner] Error:', err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log('[CheckinScanner] Success response:', data);
      const pessoa = Array.isArray(data.pessoa) ? data.pessoa[0] : data.pessoa;
      const evento = Array.isArray(data.evento) ? data.evento[0] : data.evento;

      if (data.success) {
        console.log('[CheckinScanner] Check-in bem-sucedido');
        // Check if document verification is required
        if (data.exigir_documento) {
          setPendingData({ pessoa, evento });
          setStage("confirming");
        } else {
          // Direct success - no document verification needed
          setFeedback({
            type: "success",
            personName: pessoa?.nome,
            eventName: evento?.titulo,
            message: "Entrada liberada",
          });
          setStage("feedback");
          queryClient.invalidateQueries({ queryKey: ["checkins-recentes"] });
          queryClient.invalidateQueries({ queryKey: ["checkin-stats"] });
          onSuccess?.();
        }
      } else if (data.code === "ALREADY_USED") {
        console.log('[CheckinScanner] Inscrição já utilizada');
        setFeedback({
          type: "already_used",
          personName: pessoa?.nome,
          eventName: evento?.titulo,
          message: "Esta inscrição já foi utilizada",
        });
        setStage("feedback");
      } else if (data.code === "PENDENTE") {
        console.log('[CheckinScanner] Pagamento pendente');
        setFeedback({
          type: "pending_payment",
          personName: pessoa?.nome,
          eventName: evento?.titulo,
          message: "Pagamento não confirmado",
        });
        setStage("feedback");
      } else if (data.code === "WRONG_EVENT") {
        console.log('[CheckinScanner] QR de outro evento');
        setFeedback({
          type: "error",
          personName: pessoa?.nome,
          eventName: evento?.titulo,
          message: "Este QR Code pertence a outro evento.",
        });
        setStage("feedback");
      } else {
        console.log('[CheckinScanner] Erro desconhecido:', data.message);
        setFeedback({
          type: "error",
          message: data.message || "Erro desconhecido",
        });
        setStage("feedback");
      }
    },
    onError: (error: Error) => {
      console.error('[CheckinScanner] Mutation error:', error);
      setFeedback({
        type: "error",
        message: error.message || "Erro ao processar check-in. Tente novamente.",
      });
      setStage("feedback");
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  const handleScan = useCallback(
    (result: string) => {
      if (isProcessing || stage !== "scanning") return;

      const token = extractToken(result);
      if (token) {
        setIsProcessing(true);
        checkinMutation.mutate(token);
      }
    },
    [isProcessing, stage, checkinMutation]
  );

  const handleConfirmDocument = useCallback(() => {
    // Document verified - show success feedback
    setFeedback({
      type: "success",
      personName: pendingData?.pessoa?.nome,
      eventName: pendingData?.evento?.titulo,
      message: "Entrada liberada",
    });
    setStage("feedback");
    queryClient.invalidateQueries({ queryKey: ["checkins-recentes"] });
    queryClient.invalidateQueries({ queryKey: ["checkin-stats"] });
    onSuccess?.();
  }, [pendingData, queryClient, onSuccess]);

  const handleRejectDocument = useCallback(() => {
    // Document rejected - go back to scanning
    setPendingData(null);
    setStage("scanning");
  }, []);

  const handleCancelConfirm = useCallback(() => {
    // Cancel verification - go back to scanning
    setPendingData(null);
    setStage("scanning");
  }, []);

  const handleCloseFeedback = useCallback(() => {
    setFeedback(null);
    setStage("scanning");
  }, []);

  const handleClose = useCallback(() => {
    setFeedback(null);
    setPendingData(null);
    setStage("scanning");
    setIsProcessing(false);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {stage === "feedback" && feedback ? (
          <CheckinResultFeedback
            type={feedback.type}
            personName={feedback.personName}
            eventName={feedback.eventName}
            message={feedback.message}
            onClose={handleCloseFeedback}
          />
        ) : stage === "confirming" && pendingData ? (
          <CheckinConfirmDialog
            pessoa={pendingData.pessoa}
            evento={pendingData.evento}
            onConfirm={handleConfirmDocument}
            onReject={handleRejectDocument}
            onCancel={handleCancelConfirm}
          />
        ) : (
          <>
            <DialogHeader className="p-4 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Scanner de QR Code
              </DialogTitle>
            </DialogHeader>

            <div className="relative aspect-square bg-black">
              <Scanner
                onScan={(result) => {
                  if (result && result.length > 0) {
                    handleScan(result[0].rawValue);
                  }
                }}
                onError={(error) => {
                  console.error("Scanner error:", error);
                }}
                styles={{
                  container: {
                    width: "100%",
                    height: "100%",
                  },
                  video: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  },
                }}
              />

              {/* Overlay com guia visual */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white/80 rounded-lg" />
                </div>
              </div>

              {/* Loading indicator */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
            </div>

            <div className="p-4 pt-2">
              <p className="text-sm text-muted-foreground text-center mb-3">
                Aponte a câmera para o QR Code da inscrição
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleClose}
              >
                <X className="h-4 w-4 mr-2" />
                Fechar Scanner
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
