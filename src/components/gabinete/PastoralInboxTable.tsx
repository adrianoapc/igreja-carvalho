import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar, ClipboardList, User, Users, AlertTriangle, ChevronRight } from "lucide-react";
import { format, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type GravidadeEnum = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
type StatusEnum = "PENDENTE" | "TRIAGEM" | "AGENDADO" | "EM_ACOMPANHAMENTO" | "CONCLUIDO";

interface AtendimentoPastoral {
  id: string;
  created_at: string;
  pessoa_id: string | null;
  visitante_id: string | null;
  origem: string | null;
  motivo_resumo: string | null;
  conteudo_original: string | null;
  gravidade: GravidadeEnum | null;
  status: StatusEnum | null;
  pastor_responsavel_id: string | null;
  data_agendamento: string | null;
  local_atendimento: string | null;
  observacoes_internas: string | null;
  historico_evolucao: any[] | null;
  pessoa?: { nome: string | null; telefone: string | null } | null;
  visitante?: { nome: string | null; telefone: string | null } | null;
  pastor?: { nome: string | null } | null;
}

const GRAVIDADE_COLORS: Record<GravidadeEnum, string> = {
  BAIXA: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  MEDIA: "bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-400",
  ALTA: "bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-400",
  CRITICA: "bg-destructive/20 text-destructive border-destructive/30",
};

const GRAVIDADE_LABELS: Record<GravidadeEnum, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

const STATUS_LABELS: Record<StatusEnum, string> = {
  PENDENTE: "Pendente",
  TRIAGEM: "Triagem",
  EM_ACOMPANHAMENTO: "Acompanhando",
  AGENDADO: "Agendado",
  CONCLUIDO: "Concluído",
};

const STATUS_COLORS: Record<StatusEnum, string> = {
  PENDENTE: "bg-muted text-muted-foreground",
  TRIAGEM: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  EM_ACOMPANHAMENTO: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  AGENDADO: "bg-sky-500/20 text-sky-700 dark:text-sky-400",
  CONCLUIDO: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
};

interface PastoralInboxTableProps {
  atendimentos: AtendimentoPastoral[];
  onAgendar: (atendimento: AtendimentoPastoral) => void;
}

export function PastoralInboxTable({
  atendimentos,
  onAgendar,
}: PastoralInboxTableProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const getInitials = (nome: string | null) => {
    if (!nome) return "?";
    const parts = nome.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  if (atendimentos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Nenhum atendimento</p>
        <p className="text-sm">Ajuste os filtros ou aguarde novos</p>
      </div>
    );
  }

  // Mobile: Card List
  if (isMobile) {
    return (
      <div className="space-y-2">
        {atendimentos.map((atendimento) => {
          const nome = atendimento.pessoa?.nome || atendimento.visitante?.nome || "Não identificado";
          const isMembro = !!atendimento.pessoa_id;
          const isCritico = atendimento.gravidade === "CRITICA";
          const status = atendimento.status || "PENDENTE";

          return (
            <Card
              key={atendimento.id}
              className={cn(
                "cursor-pointer active:scale-[0.98] transition-transform",
                isCritico && "border-destructive/50 bg-destructive/5"
              )}
              onClick={() => navigate(`/gabinete/atendimento/${atendimento.id}`)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className={cn(
                      "text-xs",
                      isMembro ? "bg-primary/20 text-primary" : "bg-muted"
                    )}>
                      {getInitials(nome)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isCritico && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate">{nome}</span>
                    </div>
                    
                    {atendimento.motivo_resumo && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {atendimento.motivo_resumo}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[status])}>
                        {STATUS_LABELS[status]}
                      </Badge>
                      {atendimento.gravidade && (
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", GRAVIDADE_COLORS[atendimento.gravidade])}>
                          {GRAVIDADE_LABELS[atendimento.gravidade]}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {format(new Date(atendimento.created_at), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0 self-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAgendar(atendimento);
                      }}
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Desktop: Table
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[80px]">Ações</TableHead>
            <TableHead className="w-[80px]">Data</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead className="w-[90px]">Gravidade</TableHead>
            <TableHead className="w-[110px]">Status</TableHead>
            <TableHead className="w-[130px]">Pastor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {atendimentos.map((atendimento) => {
            const nome = atendimento.pessoa?.nome || atendimento.visitante?.nome || "Não identificado";
            const isMembro = !!atendimento.pessoa_id;
            const isCritico = atendimento.gravidade === "CRITICA";
            const isNovo = differenceInHours(new Date(), new Date(atendimento.created_at)) < 24;
            const status = atendimento.status || "PENDENTE";

            return (
              <TableRow
                key={atendimento.id}
                className={cn(
                  "cursor-pointer",
                  isCritico && "bg-destructive/5"
                )}
                onClick={() => navigate(`/gabinete/atendimento/${atendimento.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAgendar(atendimento);
                          }}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Agendar</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navigate(`/gabinete/atendimento/${atendimento.id}`)}
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Prontuário</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {isCritico && (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className="text-sm">
                      {format(new Date(atendimento.created_at), "dd/MM", { locale: ptBR })}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className={cn(
                        "text-[10px]",
                        isMembro ? "bg-primary/20 text-primary" : "bg-muted"
                      )}>
                        {getInitials(nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">{nome}</span>
                        {isNovo && (
                          <Badge className="text-[9px] px-1 py-0 h-4">Novo</Badge>
                        )}
                        {!isMembro && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                            Visitante
                          </Badge>
                        )}
                      </div>
                      {atendimento.motivo_resumo && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {atendimento.motivo_resumo}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {atendimento.gravidade && (
                    <Badge variant="outline" className={cn("text-[10px]", GRAVIDADE_COLORS[atendimento.gravidade])}>
                      {GRAVIDADE_LABELS[atendimento.gravidade]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[status])}>
                    {STATUS_LABELS[status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground truncate block">
                    {atendimento.pastor?.nome || "—"}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
