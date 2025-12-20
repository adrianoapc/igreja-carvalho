import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Clock, Calendar, AlertTriangle } from "lucide-react";
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
  BAIXA: "bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400",
  MEDIA: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  ALTA: "bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-400",
  CRITICA: "bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-400",
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

interface PastoralListViewProps {
  atendimentosPorStatus: Record<StatusEnum, AtendimentoPastoral[]>;
  onCardClick: (atendimento: AtendimentoPastoral) => void;
}

export function PastoralListView({
  atendimentosPorStatus,
  onCardClick,
}: PastoralListViewProps) {
  const statusOrder: StatusEnum[] = [
    "PENDENTE",
    "EM_ACOMPANHAMENTO",
    "AGENDADO",
    "CONCLUIDO",
  ];

  return (
    <Accordion type="multiple" defaultValue={["PENDENTE", "EM_ACOMPANHAMENTO"]} className="space-y-2">
      {statusOrder.map((status) => {
        const atendimentos = atendimentosPorStatus[status] || [];
        const hasCriticos = atendimentos.some((a) => a.gravidade === "CRITICA");

        return (
          <AccordionItem key={status} value={status} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="font-medium">{STATUS_LABELS[status]}</span>
                <Badge
                  variant={hasCriticos ? "destructive" : "secondary"}
                  className={cn(hasCriticos && "animate-pulse")}
                >
                  {atendimentos.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pb-2">
                {atendimentos.map((atendimento) => {
                  const nome =
                    atendimento.pessoa?.nome ||
                    atendimento.visitante?.nome ||
                    "Não identificado";
                  const isCritico = atendimento.gravidade === "CRITICA";
                  const isNovo =
                    differenceInHours(new Date(), new Date(atendimento.created_at)) < 24;

                  return (
                    <Card
                      key={atendimento.id}
                      onClick={() => onCardClick(atendimento)}
                      className={cn(
                        "cursor-pointer hover:shadow-md transition-all",
                        isCritico && "ring-2 ring-red-500"
                      )}
                    >
                      <CardContent className="p-3 flex items-center gap-4">
                        {isCritico && (
                          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 animate-bounce" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{nome}</span>
                            {isNovo && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary"
                              >
                                Novo
                              </Badge>
                            )}
                          </div>
                          {atendimento.motivo_resumo && (
                            <p className="text-xs text-muted-foreground truncate">
                              {atendimento.motivo_resumo}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(atendimento.created_at), "dd/MM", {
                              locale: ptBR,
                            })}
                          </div>

                          {atendimento.data_agendamento && (
                            <div className="text-xs text-primary flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(atendimento.data_agendamento), "dd/MM HH:mm", {
                                locale: ptBR,
                              })}
                            </div>
                          )}

                          {atendimento.gravidade && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                GRAVIDADE_COLORS[atendimento.gravidade]
                              )}
                            >
                              {GRAVIDADE_LABELS[atendimento.gravidade]}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {atendimentos.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Nenhum atendimento neste status
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
