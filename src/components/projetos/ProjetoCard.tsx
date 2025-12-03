import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProjetoCardProps {
  projeto: {
    id: string;
    titulo: string;
    descricao: string | null;
    status: string;
    data_fim: string | null;
    lider?: { id: string; nome: string; avatar_url: string | null };
  };
  progresso: number;
  totalTarefas: number;
  tarefasConcluidas: number;
  onClick: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  ativo: { label: "Ativo", variant: "default" },
  concluido: { label: "Concluído", variant: "secondary" },
  pausado: { label: "Pausado", variant: "outline" },
};

export default function ProjetoCard({ projeto, progresso, totalTarefas, tarefasConcluidas, onClick }: ProjetoCardProps) {
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const config = statusConfig[projeto.status] || statusConfig.ativo;

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow bg-card"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{projeto.titulo}</h3>
            {projeto.descricao && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{projeto.descricao}</p>
            )}
          </div>
          <Badge variant={config.variant} className="ml-2 shrink-0">{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Líder */}
        {projeto.lider && (
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={projeto.lider.avatar_url || undefined} />
              <AvatarFallback className="text-xs">{getInitials(projeto.lider.nome)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground truncate">{projeto.lider.nome}</span>
          </div>
        )}

        {/* Data fim */}
        {projeto.data_fim && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Prazo: {format(new Date(projeto.data_fim), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        )}

        {/* Progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Progresso
            </span>
            <span className="font-medium text-foreground">{tarefasConcluidas}/{totalTarefas}</span>
          </div>
          <Progress value={progresso} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{progresso}% concluído</p>
        </div>
      </CardContent>
    </Card>
  );
}
