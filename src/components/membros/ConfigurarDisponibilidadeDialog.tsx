import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, Loader2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisponibilidadeDia {
  ativo: boolean;
  inicio?: string;
  fim?: string;
}

interface DisponibilidadeAgenda {
  [key: string]: DisponibilidadeDia;
}

interface ConfigurarDisponibilidadeDialogProps {
  profileId: string;
  initialData?: DisponibilidadeAgenda | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const DIAS_SEMANA = [
  { key: "0", label: "Domingo", short: "Dom" },
  { key: "1", label: "Segunda-feira", short: "Seg" },
  { key: "2", label: "Terça-feira", short: "Ter" },
  { key: "3", label: "Quarta-feira", short: "Qua" },
  { key: "4", label: "Quinta-feira", short: "Qui" },
  { key: "5", label: "Sexta-feira", short: "Sex" },
  { key: "6", label: "Sábado", short: "Sáb" },
];

const DEFAULT_INICIO = "09:00";
const DEFAULT_FIM = "18:00";

function parseInitialData(data: DisponibilidadeAgenda | null | undefined): DisponibilidadeAgenda {
  const defaultConfig: DisponibilidadeAgenda = {};
  
  DIAS_SEMANA.forEach(dia => {
    if (data && data[dia.key]) {
      defaultConfig[dia.key] = {
        ativo: data[dia.key].ativo ?? false,
        inicio: data[dia.key].inicio || DEFAULT_INICIO,
        fim: data[dia.key].fim || DEFAULT_FIM,
      };
    } else {
      defaultConfig[dia.key] = {
        ativo: false,
        inicio: DEFAULT_INICIO,
        fim: DEFAULT_FIM,
      };
    }
  });
  
  return defaultConfig;
}

export function ConfigurarDisponibilidadeDialog({
  profileId,
  initialData,
  open,
  onOpenChange,
  onSuccess,
}: ConfigurarDisponibilidadeDialogProps) {
  const queryClient = useQueryClient();
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeAgenda>(() => 
    parseInitialData(initialData)
  );

  // Reset quando o dialog abre com novos dados
  useEffect(() => {
    if (open) {
      setDisponibilidade(parseInitialData(initialData));
    }
  }, [open, initialData]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      // Limpa os campos inicio/fim de dias inativos para manter o JSON limpo
      const cleanedData: DisponibilidadeAgenda = {};
      
      Object.entries(disponibilidade).forEach(([key, value]) => {
        if (value.ativo) {
          cleanedData[key] = {
            ativo: true,
            inicio: value.inicio,
            fim: value.fim,
          };
        } else {
          cleanedData[key] = { ativo: false };
        }
      });

      const { error } = await supabase
        .from("profiles")
        .update({ disponibilidade_agenda: JSON.parse(JSON.stringify(cleanedData)) })
        .eq("id", profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["pastores-gabinete"] });
      toast.success("Disponibilidade salva com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Erro ao salvar disponibilidade:", error);
      toast.error("Erro ao salvar disponibilidade");
    },
  });

  const handleToggleDia = (diaKey: string, checked: boolean) => {
    setDisponibilidade(prev => ({
      ...prev,
      [diaKey]: {
        ...prev[diaKey],
        ativo: checked,
      },
    }));
  };

  const handleChangeHorario = (diaKey: string, field: "inicio" | "fim", value: string) => {
    setDisponibilidade(prev => ({
      ...prev,
      [diaKey]: {
        ...prev[diaKey],
        [field]: value,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação: se um dia está ativo, deve ter início e fim
    const diasAtivos = Object.entries(disponibilidade).filter(([_, v]) => v.ativo);
    
    for (const [key, dia] of diasAtivos) {
      if (!dia.inicio || !dia.fim) {
        const diaLabel = DIAS_SEMANA.find(d => d.key === key)?.label;
        toast.error(`${diaLabel}: preencha início e fim`);
        return;
      }
      if (dia.inicio >= dia.fim) {
        const diaLabel = DIAS_SEMANA.find(d => d.key === key)?.label;
        toast.error(`${diaLabel}: horário de início deve ser antes do fim`);
        return;
      }
    }
    
    salvarMutation.mutate();
  };

  const diasAtivosCount = Object.values(disponibilidade).filter(d => d.ativo).length;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
            <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Configurar Disponibilidade
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Defina os dias e horários disponíveis para atendimento pastoral
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-3">
            <div className="space-y-3">
              {DIAS_SEMANA.map((dia) => {
                const config = disponibilidade[dia.key];
                const isAtivo = config?.ativo ?? false;

                return (
                  <div
                    key={dia.key}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-colors",
                      isAtivo ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                    )}
                  >
                    {/* Checkbox e Label */}
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <Checkbox
                        id={`dia-${dia.key}`}
                        checked={isAtivo}
                        onCheckedChange={(checked) => 
                          handleToggleDia(dia.key, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`dia-${dia.key}`}
                        className={cn(
                          "font-medium cursor-pointer",
                          !isAtivo && "text-muted-foreground"
                        )}
                      >
                        {dia.label}
                      </Label>
                    </div>

                    {/* Horários (só mostra se ativo) */}
                    {isAtivo && (
                      <div className="flex items-center gap-2 flex-1 ml-7 sm:ml-0">
                        <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="time"
                            value={config?.inicio || DEFAULT_INICIO}
                            onChange={(e) => 
                              handleChangeHorario(dia.key, "inicio", e.target.value)
                            }
                            className="w-[110px] text-sm"
                          />
                          <span className="text-muted-foreground text-sm">até</span>
                          <Input
                            type="time"
                            value={config?.fim || DEFAULT_FIM}
                            onChange={(e) => 
                              handleChangeHorario(dia.key, "fim", e.target.value)
                            }
                            className="w-[110px] text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Placeholder quando inativo */}
                    {!isAtivo && (
                      <div className="flex-1 ml-7 sm:ml-0">
                        <span className="text-sm text-muted-foreground italic">
                          Indisponível
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 text-sm text-muted-foreground">
              {diasAtivosCount === 0 ? (
                <span className="text-amber-600">Nenhum dia configurado</span>
              ) : (
                <span>{diasAtivosCount} dia(s) disponível(is)</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvarMutation.isPending}>
                {salvarMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </div>
    </ResponsiveDialog>
  );
}
