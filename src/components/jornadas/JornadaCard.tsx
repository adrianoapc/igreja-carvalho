import { useState, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, MoreHorizontal, Trash2, CheckCircle2, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  isDragging?: boolean;
  onRefetch?: () => void;
  etapasOrdenadas?: Array<{ id: string; ordem: number; titulo: string }>;
}

export default function JornadaCard({ 
  inscricao, 
  totalEtapas, 
  isDragging, 
  onRefetch,
  etapasOrdenadas = []
}: JornadaCardProps) {
  const [showResponsavelSelector, setShowResponsavelSelector] = useState(false);
  const isPromotingRef = useRef(false);

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
  
  // Calcular progresso baseado nas etapas CONCLUÍDAS (presencas_aula com status='concluido')
  const etapasConcluidas = inscricao.etapas_concluidas || 0;
  const etapasConcluidasIds: string[] = inscricao.etapas_concluidas_ids || [];
  const progress = totalEtapas > 0 ? (etapasConcluidas / totalEtapas) * 100 : 0;

  // Promoção automática: verificar se a etapa atual já foi concluída
  useEffect(() => {
    if (isPromotingRef.current || !etapasOrdenadas.length || !onRefetch) return;
    if (inscricao.concluido) return;

    const etapaAtualId = inscricao.etapa_atual_id;
    
    // Se não tem etapa atual definida e tem etapas concluídas, definir a primeira não concluída
    if (!etapaAtualId && etapasConcluidas > 0) {
      const primeiraEtapaNaoConcluida = etapasOrdenadas.find(
        e => !etapasConcluidasIds.includes(e.id)
      );
      if (primeiraEtapaNaoConcluida) {
        promoverParaEtapa(primeiraEtapaNaoConcluida.id);
      }
      return;
    }

    // Se a etapa atual está nas etapas concluídas, avançar para próxima
    if (etapaAtualId && etapasConcluidasIds.includes(etapaAtualId)) {
      // Encontrar índice da etapa atual
      const indexAtual = etapasOrdenadas.findIndex(e => e.id === etapaAtualId);
      
      // Encontrar próxima etapa não concluída
      const proximaEtapa = etapasOrdenadas.slice(indexAtual + 1).find(
        e => !etapasConcluidasIds.includes(e.id)
      );

      if (proximaEtapa) {
        promoverParaEtapa(proximaEtapa.id);
      }
    }
  }, [etapasConcluidasIds.length, inscricao.etapa_atual_id, etapasOrdenadas.length, inscricao.concluido]);

  const promoverParaEtapa = async (novaEtapaId: string) => {
    if (isPromotingRef.current) return;
    isPromotingRef.current = true;

    try {
      const { error } = await supabase
        .from("inscricoes_jornada")
        .update({
          etapa_atual_id: novaEtapaId,
          data_mudanca_fase: new Date().toISOString(),
        })
        .eq("id", inscricao.id);

      if (error) throw error;

      toast.success("Etapa atualizada automaticamente");
      onRefetch?.();
    } catch (error) {
      console.error("Erro ao promover etapa:", error);
    } finally {
      // Reset após um delay para evitar loops
      setTimeout(() => {
        isPromotingRef.current = false;
      }, 2000);
    }
  };

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
    const { error } = await supabase.from("inscricoes_jornada").delete().eq("id", inscricao.id);

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
        className={`group w-full cursor-grab active:cursor-grabbing transition-all bg-card border shadow-sm hover:shadow-md hover:border-primary/30 relative ${
          isDragging || isSortableDragging ? "opacity-50 shadow-lg ring-2 ring-primary rotate-1 z-10" : ""
        } ${inscricao.concluido ? "bg-green-50/50 dark:bg-green-950/10 border-green-200/50" : ""}`}
        {...attributes}
        {...listeners}
      >
        <div className="p-3">
          {/* Top: Avatar + Nome + Menu */}
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8 shrink-0 border border-border/50">
              <AvatarImage src={pessoa?.avatar_url} />
              <AvatarFallback className="text-[10px] bg-muted font-medium">
                {pessoa?.nome ? getInitials(pessoa.nome) : "?"}
              </AvatarFallback>
            </Avatar>

            {/* Container de texto com min-w-0 para forçar quebra de linha */}
            <div className="flex-1 min-w-0 flex flex-col justify-start">
              <div className="flex items-start justify-between gap-1 w-full">
                {/* Texto com break-words para não estourar lateralmente */}
                <p className="font-medium text-sm leading-tight break-words text-left line-clamp-2">
                  {pessoa?.nome || "Pessoa"}
                </p>
                {inscricao.concluido && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />}
              </div>

              {/* Tempo na fase */}
              {tempoNaFase && (
                <div className="flex mt-1">
                  <Badge
                    variant={isStagnant ? "destructive" : "secondary"}
                    className="text-[10px] font-normal h-5 px-1.5 whitespace-nowrap"
                  >
                    <Clock className="w-2.5 h-2.5 mr-1" />
                    {tempoNaFase}
                  </Badge>
                </div>
              )}
            </div>

            {/* Menu - shrink-0 garante que ele nunca será esmagado/cortado */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mr-1"
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
                <DropdownMenuItem onClick={handleRemover} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bottom: Responsável + Progress */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
            {/* Responsável */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowResponsavelSelector(true);
              }}
              className="flex items-center hover:opacity-80 transition-opacity shrink-0"
            >
              {responsavel ? (
                <Avatar className="h-5 w-5 border border-background ring-1 ring-border/20">
                  <AvatarImage src={responsavel.avatar_url} />
                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">
                    {getInitials(responsavel.nome)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary/50 transition-colors bg-muted/20">
                  <UserPlus className="w-2.5 h-2.5 text-muted-foreground/60" />
                </div>
              )}
            </button>

            {/* Progress */}
            <div className="flex-1 ml-3 flex items-center gap-2">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground font-medium min-w-[28px] text-right">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        </div>
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
