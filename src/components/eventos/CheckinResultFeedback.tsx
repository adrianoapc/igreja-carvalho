import { useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackType = "success" | "error" | "already_used" | "pending_payment";

interface CheckinResultFeedbackProps {
  type: FeedbackType;
  personName?: string;
  eventName?: string;
  message?: string;
  onClose?: () => void;
}

const feedbackConfig: Record<FeedbackType, {
  icon: typeof CheckCircle2;
  bgClass: string;
  iconClass: string;
  title: string;
}> = {
  success: {
    icon: CheckCircle2,
    bgClass: "bg-green-500",
    iconClass: "text-white",
    title: "Check-in Confirmado!",
  },
  error: {
    icon: XCircle,
    bgClass: "bg-destructive",
    iconClass: "text-white",
    title: "Inscrição Não Encontrada",
  },
  already_used: {
    icon: AlertTriangle,
    bgClass: "bg-yellow-500",
    iconClass: "text-white",
    title: "Já Utilizado",
  },
  pending_payment: {
    icon: Banknote,
    bgClass: "bg-orange-500",
    iconClass: "text-white",
    title: "Pagamento Pendente",
  },
};

export function CheckinResultFeedback({
  type,
  personName,
  eventName,
  message,
  onClose,
}: CheckinResultFeedbackProps) {
  const config = feedbackConfig[type];
  const Icon = config.icon;

  // Auto-close after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-white text-center rounded-lg",
        config.bgClass
      )}
      onClick={onClose}
      role="dialog"
      aria-label="Resultado do check-in"
    >
      <Icon className={cn("w-20 h-20 mb-4", config.iconClass)} />
      
      <h2 className="text-2xl font-bold mb-2">{config.title}</h2>
      
      {personName && (
        <p className="text-lg font-medium mb-1">{personName}</p>
      )}
      
      {eventName && (
        <p className="text-base opacity-90 mb-3">{eventName}</p>
      )}
      
      {message && (
        <p className="text-sm opacity-80 mb-4">{message}</p>
      )}
      
      <p className="text-xs opacity-70 mt-4">Fechando automaticamente...</p>
    </div>
  );
}
