import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, MoreHorizontal, Trash2, CheckCircle2, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

  const diasNaFase = inscricao.data_mudanca_fase
    ? differenceInDays(new Date(), new Date(inscricao.data_mudanca_fase))
    : 0;

  const isStagnant = diasNaFase > 15;

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const handleRemover = async () => {
    const { error } = await supabase
      .from("inscricoes_jornada")
      .delete()
      .eq("id", inscricao.id);

    if (error) {
      toast.error("Erro ao remover");
      return;
    }

    toast.success("Removido da jornada");
    onRefetch?.();
  };

  const handleConcluir = async () => {
    const { error } = await supabase
      .from("inscricoes_jornada")
      .update({ concluido: !inscricao.concluido })
      .eq("id", inscricao.id);

    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }

    toast.success(inscricao.concluido ? "Reaberto" : "Marcado como concluído");
    onRefetch?.();
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className={`group cursor-grab active:cursor-grabbing transition-all bg-card border shadow-sm hover:shadow-md ${
          isDragging || isSortableDragging
            ? "opacity-50 shadow-lg ring-2 ring-primary rotate-2"
            : ""
        } ${inscricao.concluido ? "bg-green-50/50 dark:bg-green-950/10 border-green-200/50" : ""}`}
        {...attributes}
        {...listeners}
      >
        <CardContent className="p-3">
          {/* Top: Avatar + Nome + Menu */}
          <div className="flex items-start gap-3">
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarImage src={pessoa?.avatar_url} />
              <AvatarFallback className="text-xs bg-muted">
                {pessoa?.nome ? getInitials(pessoa.nome) : "?"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-sm truncate">
                  {pessoa?.nome || "Pessoa"}
                </p>
                {inscricao.concluido && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                )}
              </div>
              
              {/* Tempo na fase */}
              {tempoNaFase && (
                <Badge 
                  variant={isStagnant ? "destructive" : "secondary"} 
                  className="mt-1 text-[10px] font-normal px-1.5 py-0"
                >
                  <Clock className="w-2.5 h-2.5 mr-1" />
                  {tempoNaFase}
                </Badge>
              )}
            </div>

            {/* Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleConcluir}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {inscricao.concluido ? "Reabrir" : "Concluir"}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleRemover}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bottom: Responsável + Progress */}
          <div className="flex items-center justify-between mt-3 pt-2">
            {/* Responsável */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowResponsavelSelector(true);
              }}
              className="flex items-center gap-1.5 hover:bg-muted rounded-full transition-colors"
            >
              {responsavel ? (
                <Avatar className="w-6 h-6 border border-background">
                  <AvatarImage src={responsavel.avatar_url} />
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                    {getInitials(responsavel.nome)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <UserPlus className="w-3 h-3 text-muted-foreground/50" />
                </div>
              )}
            </button>

            {/* Progress */}
            <div className="flex-1 ml-3">
              <Progress value={progress} className="h-1" />
            </div>
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
