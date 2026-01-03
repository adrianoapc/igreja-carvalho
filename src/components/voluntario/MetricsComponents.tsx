import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Timer,
  Award,
} from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  color,
  description,
}: MetricCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden">
        <div className={`h-1 ${color}`} />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardDescription className="text-xs mb-1">{title}</CardDescription>
              <CardTitle className="text-3xl font-bold">{value}</CardTitle>
            </div>
            <div className={`p-2.5 rounded-lg ${color} bg-opacity-10`}>
              <Icon className={`w-5 h-5 ${color.replace("bg-", "text-")}`} />
            </div>
          </div>
        </CardHeader>
        {(change !== undefined || description) && (
          <CardContent className="pt-0">
            {change !== undefined && (
              <div className="flex items-center gap-2">
                {isPositive && <TrendingUp className="w-4 h-4 text-green-600" />}
                {isNegative && <TrendingDown className="w-4 h-4 text-red-600" />}
                <span
                  className={`text-sm font-medium ${
                    isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-muted-foreground"
                  }`}
                >
                  {change > 0 ? "+" : ""}
                  {change}%
                </span>
                {changeLabel && (
                  <span className="text-xs text-muted-foreground">{changeLabel}</span>
                )}
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-2">{description}</p>
            )}
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}

interface InsightCardProps {
  tipo: "alerta" | "meta" | "tempo" | "conquista";
  titulo: string;
  descricao: string;
  valor?: string;
}

export function InsightCard({ tipo, titulo, descricao, valor }: InsightCardProps) {
  const config = {
    alerta: {
      icon: AlertTriangle,
      color: "bg-amber-500",
      badge: "Ação Necessária",
    },
    meta: {
      icon: Target,
      color: "bg-blue-500",
      badge: "Objetivo",
    },
    tempo: {
      icon: Timer,
      color: "bg-purple-500",
      badge: "Tempo Médio",
    },
    conquista: {
      icon: Award,
      color: "bg-green-500",
      badge: "Conquista",
    },
  };

  const { icon: Icon, color, badge } = config[tipo];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: 4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-l-4" style={{ borderLeftColor: color.replace("bg-", "") }}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${color} bg-opacity-10 shrink-0`}>
              <Icon className={`w-5 h-5 ${color.replace("bg-", "text-")}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm">{titulo}</h4>
                <Badge variant="outline" className="text-xs">
                  {badge}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{descricao}</p>
              {valor && (
                <p className="text-lg font-bold mt-2" style={{ color: color.replace("bg-", "") }}>
                  {valor}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
