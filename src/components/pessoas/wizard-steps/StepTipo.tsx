import { UserPlus, UserCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type TipoPessoa = "visitante" | "frequentador" | "membro";

const tipos = [
  {
    value: "visitante" as TipoPessoa,
    label: "Visitante",
    description: "Primeira vez na igreja",
    icon: UserPlus,
  },
  {
    value: "frequentador" as TipoPessoa,
    label: "Frequentador",
    description: "Já frequenta regularmente",
    icon: UserCheck,
  },
  {
    value: "membro" as TipoPessoa,
    label: "Membro",
    description: "Membro oficial da igreja",
    icon: Users,
  },
];

interface Props {
  onSelect: (tipo: TipoPessoa) => void;
}

export function StepTipo({ onSelect }: Props) {
  return (
    <div className="space-y-3">
      {tipos.map((tipo) => {
        const Icon = tipo.icon;
        return (
          <Card
            key={tipo.value}
            className="cursor-pointer hover:bg-accent/50 transition-colors border-2 hover:border-primary/30"
            onClick={() => onSelect(tipo.value)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-full bg-primary/10 flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{tipo.label}</p>
                <p className="text-sm text-muted-foreground">{tipo.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
