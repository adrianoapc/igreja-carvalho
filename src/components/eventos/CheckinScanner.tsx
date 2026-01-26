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
import { Camera, X, RefreshCw } from "lucide-react";
import { extractEdgeFunctionPayload } from "./edgeFunctionPayload";

interface CheckinScannerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type FeedbackState = {
  type: "success" | "error" | "already_used" | "pending_payment";
  personName?: string;
  eventName?: string;
  message?: string;
} | null;

const extractToken = (input: string): string | null => {
  // Remove whitespace
  const cleaned = input.trim();

  // Try to extract from URL patterns
  const urlMatch =
    cleaned.match(/\/inscricao\/([a-f0-9-]+)/i) ||
    cleaned.match(/\/checkin\/([a-f0-9-]+)/i);

  if (urlMatch) {
    return urlMatch[1];
  }

  // Check if it's a direct UUID
  const uuidMatch = cleaned.match(
    /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i
  );

  if (uuidMatch) {
    return uuidMatch[1];
  }

  return null;
};

export function CheckinScanner({ open, onClose, onSuccess }: CheckinScannerProps) {
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const checkinMutation = useMutation({
    mutationFn: async (qrToken: string) => {
      const { data, error } = await supabase.functions.invoke(
        "checkin-inscricao",
        {
          body: { qr_token: qrToken },
        }
      );

      const payload = extractEdgeFunctionPayload(data, error);
      if (payload) return payload;
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const pessoa = Array.isArray(data.pessoa) ? data.pessoa[0] : data.pessoa;
      const evento = Array.isArray(data.evento) ? data.evento[0] : data.evento;

      if (data.success) {
        setFeedback({
          type: "success",
          personName: pessoa?.nome,
          eventName: evento?.titulo,
          message: "Entrada liberada",
        });
        queryClient.invalidateQueries({ queryKey: ["checkins-recentes"] });
        queryClient.invalidateQueries({ queryKey: ["checkin-stats"] });
        onSuccess?.();
      } else if (data.code === "ALREADY_USED") {
        setFeedback({
          type: "already_used",
          personName: pessoa?.nome,
          eventName: evento?.titulo,
          message: "Esta inscrição já foi utilizada",
        });
      } else if (data.code === "PENDENTE") {
        setFeedback({
          type: "pending_payment",
          personName: pessoa?.nome,
          eventName: evento?.titulo,
          message: "Pagamento não confirmado",
        });
      } else {
        setFeedback({
          type: "error",
          message: data.message || "Erro desconhecido",
        });
      }
    },
    onError: (error: Error) => {
      setFeedback({
        type: "error",
        message: error.message || "Erro ao processar check-in",
      });
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  const handleScan = useCallback(
    (result: string) => {
      if (isProcessing || feedback) return;

      const token = extractToken(result);
      if (token) {
        setIsProcessing(true);
        checkinMutation.mutate(token);
      }
    },
    [isProcessing, feedback, checkinMutation]
  );

  const handleCloseFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const handleClose = useCallback(() => {
    setFeedback(null);
    setIsProcessing(false);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {feedback ? (
          <CheckinResultFeedback
            type={feedback.type}
            personName={feedback.personName}
            eventName={feedback.eventName}
            message={feedback.message}
            onClose={handleCloseFeedback}
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
