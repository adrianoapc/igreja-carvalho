import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useIgrejaId } from "@/hooks/useIgrejaId";

interface EdgeFunctionConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  functionName: string;
  currentSchedule: string;
  onUpdate: () => void;
}

// Horários predefinidos em UTC (considerando Brasília UTC-3)
const scheduleOptions = [
  { value: "0 9 * * *", label: "6h da manhã (Brasília)" },
  { value: "0 10 * * *", label: "7h da manhã (Brasília)" },
  { value: "0 11 * * *", label: "8h da manhã (Brasília)" },
  { value: "0 12 * * *", label: "9h da manhã (Brasília)" },
  { value: "0 13 * * *", label: "10h da manhã (Brasília)" },
  { value: "0 14 * * *", label: "11h da manhã (Brasília)" },
  { value: "0 15 * * *", label: "12h (meio-dia Brasília)" },
  { value: "0 18 * * *", label: "15h da tarde (Brasília)" },
  { value: "0 21 * * *", label: "18h da tarde (Brasília)" },
  { value: "0 0 * * *", label: "21h da noite (Brasília)" },
];

export default function EdgeFunctionConfigDialog({
  open,
  onOpenChange,
  functionName,
  currentSchedule,
  onUpdate
}: EdgeFunctionConfigDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(currentSchedule);
  const { igrejaId } = useIgrejaId();

  useEffect(() => {
    setSelectedSchedule(currentSchedule);
  }, [currentSchedule]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      if (!igrejaId) {
        throw new Error("Igreja não identificada.");
      }
      const selectedOption = scheduleOptions.find(opt => opt.value === selectedSchedule);
      
      const { error } = await supabase
        .from('edge_function_config')
        .update({
          schedule_cron: selectedSchedule,
          schedule_description: selectedOption?.label || selectedSchedule
        })
        .eq('function_name', functionName)
        .eq('igreja_id', igrejaId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Horário atualizado. A alteração será aplicada na próxima execução agendada.",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Erro ao atualizar horário:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Erro",
        description: message || "Não foi possível atualizar o horário",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title="Configurar Horário de Execução"
    >
      <div className="flex flex-col h-full">
        {/* Description */}
        <div className="px-4 pt-2 pb-0 md:px-6">
          <p className="text-sm text-muted-foreground">
            Escolha o horário em que esta função será executada automaticamente.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule">Horário de Execução</Label>
            <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
              <SelectTrigger id="schedule">
                <SelectValue placeholder="Selecione o horário" />
              </SelectTrigger>
              <SelectContent>
                {scheduleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O horário será aplicado diariamente. As alterações entram em vigor na próxima execução.
            </p>
          </div>
        </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
