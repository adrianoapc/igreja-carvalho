import { Card, CardContent } from "@/components/ui/card";
import { Clock, FileCheck, Layers, Percent } from "lucide-react";

interface ConciliacaoStatsCardsProps {
  pendentes: number;
  reconciliados: number;
  lotes: number;
  cobertura: number;
}

/** Os 4 cards de estatística do topo do dashboard de conciliação. */
export function ConciliacaoStatsCards({
  pendentes,
  reconciliados,
  lotes,
  cobertura,
}: ConciliacaoStatsCardsProps) {
  const items = [
    {
      icon: Clock,
      iconClass: "text-orange-600",
      bgClass: "bg-orange-100 dark:bg-orange-900/30",
      value: pendentes,
      label: "Pendentes",
    },
    {
      icon: FileCheck,
      iconClass: "text-green-600",
      bgClass: "bg-green-100 dark:bg-green-900/30",
      value: reconciliados,
      label: "Conciliados",
    },
    {
      icon: Layers,
      iconClass: "text-purple-600",
      bgClass: "bg-purple-100 dark:bg-purple-900/30",
      value: lotes,
      label: "Em Lote",
    },
    {
      icon: Percent,
      iconClass: "text-blue-600",
      bgClass: "bg-blue-100 dark:bg-blue-900/30",
      value: `${cobertura}%`,
      label: "Cobertura",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bgClass}`}>
                <item.icon className={`w-5 h-5 ${item.iconClass}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
