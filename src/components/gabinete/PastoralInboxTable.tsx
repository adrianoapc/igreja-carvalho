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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar, ClipboardList, User, Users, AlertTriangle } from "lucide-react";
import { format, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  BAIXA: "bg-green-500/20 text-green-700 border-green-500/30",
  MEDIA: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  ALTA: "bg-orange-500/20 text-orange-700 border-orange-500/30",
  CRITICA: "bg-red-500/20 text-red-700 border-red-500/30",
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
  EM_ACOMPANHAMENTO: "Em Acompanhamento",
  AGENDADO: "Agendado",
  CONCLUIDO: "Concluído",
};

const STATUS_COLORS: Record<StatusEnum, string> = {
  PENDENTE: "bg-gray-500/20 text-gray-700 border-gray-500/30",
  TRIAGEM: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  EM_ACOMPANHAMENTO: "bg-purple-500/20 text-purple-700 border-purple-500/30",
  AGENDADO: "bg-sky-500/20 text-sky-700 border-sky-500/30",
  CONCLUIDO: "bg-green-500/20 text-green-700 border-green-500/30",
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
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum atendimento encontrado</p>
        <p className="text-sm">Ajuste os filtros ou aguarde novos atendimentos</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Data</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead className="w-[100px]">Tipo</TableHead>
            <TableHead className="w-[100px]">Gravidade</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[150px]">Pastor</TableHead>
            <TableHead className="w-[120px] text-right">Ações</TableHead>
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
                  "cursor-pointer hover:bg-muted/50",
                  isCritico && "bg-red-500/5"
                )}
                onClick={() => navigate(`/gabinete/atendimento/${atendimento.id}`)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1">
                    {isCritico && (
                      <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                    )}
                    <span className="text-sm">
                      {format(new Date(atendimento.created_at), "dd/MM", { locale: ptBR })}
                    </span>
                    {isNovo && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-primary/20 text-primary">
                        Novo
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={cn(
                        "text-xs",
                        isMembro ? "bg-primary/20 text-primary" : "bg-muted"
                      )}>
                        {getInitials(nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{nome}</p>
                      {atendimento.motivo_resumo && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {atendimento.motivo_resumo}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    isMembro 
                      ? "bg-primary/10 text-primary border-primary/30" 
                      : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                  )}>
                    <User className="h-3 w-3 mr-1" />
                    {isMembro ? "Membro" : "Visitante"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {atendimento.gravidade && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs", GRAVIDADE_COLORS[atendimento.gravidade])}
                    >
                      {GRAVIDADE_LABELS[atendimento.gravidade]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", STATUS_COLORS[status])}
                  >
                    {STATUS_LABELS[status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {atendimento.pastor?.nome || "Não atribuído"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
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
                      </TooltipTrigger>
                      <TooltipContent>Agendar</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/gabinete/atendimento/${atendimento.id}`)}
                        >
                          <ClipboardList className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Prontuário</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
