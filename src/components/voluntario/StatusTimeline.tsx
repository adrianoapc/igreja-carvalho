import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";

interface StatusTimelineProps {
  status: "pendente" | "em_analise" | "aprovado" | "em_trilha" | "rejeitado";
  dataInscricao: string;
}

const statusConfig = {
  pendente: {
    label: "Aguardando Análise",
    icon: Clock,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    badge: "bg-amber-100 text-amber-800",
    step: 1,
  },
  em_analise: {
    label: "Em Análise",
    icon: AlertCircle,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    badge: "bg-blue-100 text-blue-800",
    step: 2,
  },
  aprovado: {
    label: "Aprovado",
    icon: CheckCircle2,
    color: "bg-green-100 text-green-700 border-green-200",
    badge: "bg-green-100 text-green-800",
    step: 3,
  },
  em_trilha: {
    label: "Em Processo de Integração",
    icon: CheckCircle2,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    badge: "bg-purple-100 text-purple-800",
    step: 4,
  },
  rejeitado: {
    label: "Rejeitado",
    icon: X,
    color: "bg-red-100 text-red-700 border-red-200",
    badge: "bg-red-100 text-red-800",
    step: 0,
  },
};

const timeline = ["Análise", "Aprovação", "Integração"];

export default function StatusTimeline({ status, dataInscricao }: StatusTimelineProps) {
  const config = statusConfig[status];
  const IconComponent = config.icon;
  const currentStep = config.step;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={`border ${config.color.split(" ").pop()}`}>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Status Atual */}
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${config.badge}`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{config.label}</p>
                <p className="text-xs text-muted-foreground">
                  Desde{" "}
                  {new Date(dataInscricao).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {currentStep > 0 ? `Etapa ${currentStep}` : "Não prosseguiu"}
              </Badge>
            </div>

            {/* Timeline Visual */}
            {status !== "rejeitado" && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">
                  Progresso
                </p>
                <div className="flex items-center gap-2">
                  {timeline.map((step, idx) => (
                    <motion.div
                      key={step}
                      className="flex-1 flex items-center gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                          idx + 1 <= currentStep
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      {idx < timeline.length - 1 && (
                        <div
                          className={`flex-1 h-1 rounded-full transition-all ${
                            idx + 1 < currentStep ? "bg-primary" : "bg-muted"
                          }`}
                        />
                      )}
                    </motion.div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  {timeline.map((step) => (
                    <span key={step}>{step}</span>
                  ))}
                </div>
              </div>
            )}

            {status === "rejeitado" && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">
                  Sua candidatura foi rejeitada. Você pode se candidatar a outros ministérios ou
                  entrar em contato para mais informações.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
