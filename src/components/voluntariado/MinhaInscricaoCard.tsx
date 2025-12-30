import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, BookOpen, XCircle, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Candidatura {
  id: string;
  ministerio: string;
  disponibilidade: string;
  experiencia: string;
  status: string;
  created_at: string;
}

interface MinhaInscricaoCardProps {
  candidatura: Candidatura;
  onNovaInscricao?: () => void;
}

export default function MinhaInscricaoCard({ candidatura, onNovaInscricao }: MinhaInscricaoCardProps) {
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pendente":
        return {
          icon: Clock,
          label: "Aguardando Análise",
          description: "Sua inscrição foi recebida e está aguardando avaliação da liderança.",
          badgeClass: "bg-yellow-50 text-yellow-700 border-yellow-200",
          iconClass: "text-yellow-600",
        };
      case "em_analise":
        return {
          icon: RefreshCw,
          label: "Em Análise",
          description: "A liderança está analisando seu perfil e disponibilidade.",
          badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
          iconClass: "text-blue-600",
        };
      case "aprovado":
        return {
          icon: CheckCircle,
          label: "Aprovado",
          description: "Parabéns! Você foi aprovado para servir. Aguarde contato da equipe.",
          badgeClass: "bg-green-50 text-green-700 border-green-200",
          iconClass: "text-green-600",
        };
      case "em_trilha":
        return {
          icon: BookOpen,
          label: "Em Trilha de Capacitação",
          description: "Você foi direcionado para uma trilha de capacitação. Acesse 'Meus Cursos' para iniciar.",
          badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
          iconClass: "text-purple-600",
        };
      case "rejeitado":
        return {
          icon: XCircle,
          label: "Não Aprovado",
          description: "Sua inscrição não foi aprovada no momento. Entre em contato para mais informações.",
          badgeClass: "bg-red-50 text-red-700 border-red-200",
          iconClass: "text-red-600",
        };
      default:
        return {
          icon: Clock,
          label: status,
          description: "",
          badgeClass: "",
          iconClass: "",
        };
    }
  };

  const statusInfo = getStatusInfo(candidatura.status);
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Sua Inscrição</CardTitle>
            <CardDescription>
              Enviada {formatDistanceToNow(new Date(candidatura.created_at), { addSuffix: true, locale: ptBR })}
            </CardDescription>
          </div>
          <Badge variant="outline" className={statusInfo.badgeClass}>
            <StatusIcon className={`h-3 w-3 mr-1 ${statusInfo.iconClass}`} />
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Ministério</p>
            <p className="font-medium">{candidatura.ministerio}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Disponibilidade</p>
            <p className="font-medium">{candidatura.disponibilidade}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Experiência</p>
            <p className="font-medium">{candidatura.experiencia}</p>
          </div>
        </div>

        <div className={`p-3 rounded-lg ${statusInfo.badgeClass.replace('text-', 'bg-').replace('-700', '-50/50')}`}>
          <p className="text-sm">{statusInfo.description}</p>
        </div>

        {candidatura.status === "rejeitado" && onNovaInscricao && (
          <Button variant="outline" onClick={onNovaInscricao} className="w-full">
            Fazer nova inscrição
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
