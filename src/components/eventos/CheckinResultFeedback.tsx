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

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-200",
        config.bgClass
      )}
      onClick={onClose}
    >
      <Icon className={cn("w-24 h-24 mb-6", config.iconClass)} />
      
      <h2 className="text-2xl font-bold mb-2 text-center">{config.title}</h2>
      
      {personName && (
        <p className="text-xl font-medium text-center mb-1">{personName}</p>
      )}
      
      {eventName && (
        <p className="text-lg opacity-90 text-center mb-4">{eventName}</p>
      )}
      
      {message && (
        <p className="text-base opacity-80 text-center">{message}</p>
      )}
      
      <p className="mt-8 text-sm opacity-70">Toque para continuar</p>
    </div>
  );
}
