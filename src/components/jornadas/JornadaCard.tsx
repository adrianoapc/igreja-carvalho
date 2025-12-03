import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GripVertical, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import ResponsavelSelector from "./ResponsavelSelector";

interface JornadaCardProps {
  inscricao: any;
  totalEtapas: number;
  etapaIndex: number;
  isDragging?: boolean;
  onRefetch?: () => void;
}

export default function JornadaCard({
  inscricao,
  totalEtapas,
  etapaIndex,
  isDragging,
  onRefetch,
}: JornadaCardProps) {
  const [showResponsavelSelector, setShowResponsavelSelector] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: inscricao.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const pessoa = inscricao.pessoa;
  const responsavel = inscricao.responsavel;
  const progress = totalEtapas > 0 ? (etapaIndex / totalEtapas) * 100 : 0;

  const tempoNaFase = inscricao.data_mudanca_fase
    ? formatDistanceToNow(new Date(inscricao.data_mudanca_fase), {
        addSuffix: false,
        locale: ptBR,
      })
    : null;

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className={`cursor-grab active:cursor-grabbing ${
          isDragging || isSortableDragging
            ? "opacity-50 shadow-lg ring-2 ring-primary"
            : ""
        } ${inscricao.concluido ? "bg-green-50 dark:bg-green-950/20" : ""}`}
      >
        <CardContent className="p-3">
          {/* Handle + Avatar + Nome */}
          <div className="flex items-start gap-2">
            <div
              {...attributes}
              {...listeners}
              className="mt-1 text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="w-4 h-4" />
            </div>

            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={pessoa?.avatar_url} />
              <AvatarFallback className="text-xs">
                {pessoa?.nome ? getInitials(pessoa.nome) : "?"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="font-medium text-sm truncate">
                  {pessoa?.nome || "Pessoa"}
                </p>
                {inscricao.concluido && (
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                )}
              </div>

              {/* Progresso */}
              <div className="mt-1">
                <Progress value={progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-0.5">
                  {etapaIndex}/{totalEtapas} etapas
                </p>
              </div>
            </div>
          </div>

          {/* Footer: Responsável + Tempo */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t">
            {/* Responsável */}
            <button
              onClick={() => setShowResponsavelSelector(true)}
              className="flex items-center gap-1.5 hover:bg-muted rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
            >
              {responsavel ? (
                <>
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={responsavel.avatar_url} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(responsavel.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                    {responsavel.nome.split(" ")[0]}
                  </span>
                </>
              ) : (
                <Badge variant="outline" className="text-xs py-0">
                  + Responsável
                </Badge>
              )}
            </button>

            {/* Tempo na fase */}
            {tempoNaFase && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{tempoNaFase}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ResponsavelSelector
        open={showResponsavelSelector}
        onOpenChange={setShowResponsavelSelector}
        inscricaoId={inscricao.id}
        currentResponsavelId={responsavel?.id}
        onSuccess={onRefetch}
      />
    </>
  );
}
